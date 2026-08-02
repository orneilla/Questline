import { PILIERS } from "./constantes";
import type { Charge } from "./charge";
import type { Pilier, Quete } from "@/db/schema";

export type QueteProposable = Quete & {
  pilier: Pilier;
  arcNom: string;
};

export type ContexteSelection = {
  date: string;
  jourSemaine: number;
  charge: Charge;
  quetes: QueteProposable[];
  momentumParPilier: Record<Pilier, number>;
  /** Quêtes déjà cochées aujourd'hui : elles ne reviennent pas. */
  validesAujourdhui: ReadonlySet<number>;
  /** Piliers déjà servis aujourd'hui : on n'y revient pas non plus. */
  piliersValidesAujourdhui: ReadonlySet<Pilier>;
  /**
   * Nombre de validations de chaque quête sur les sept derniers jours,
   * aujourd'hui compris : c'est ce qui tient la fréquence hebdomadaire.
   */
  validationsDeLaSemaine: ReadonlyMap<number, number>;
  /** Minutes déjà consommées par les quêtes validées aujourd'hui. */
  minutesEngagees: number;
};

/**
 * Une quête à 3 fois par semaine ne ressort pas une quatrième fois. Le compte
 * se fait sur une fenêtre glissante de sept jours, pas sur la semaine civile :
 * aucun lundi ne remet les compteurs à plat.
 */
function frequenceRespectee(quete: QueteProposable, ctx: ContexteSelection): boolean {
  return (ctx.validationsDeLaSemaine.get(quete.id) ?? 0) < quete.frequenceSem;
}

function estEligible(quete: QueteProposable, ctx: ContexteSelection): boolean {
  if (ctx.validesAujourdhui.has(quete.id)) return false;
  if (quete.joursExclus.includes(ctx.jourSemaine)) return false;
  return frequenceRespectee(quete, ctx);
}

/**
 * Du pilier le plus silencieux au plus vivant : c'est lui qu'on sert d'abord.
 * À égalité — le premier jour, tout est à zéro — on suit l'ordre déclaré des
 * piliers, pour que la journée ne se réorganise pas à chaque rafraîchissement.
 */
function piliersParPriorite(ctx: ContexteSelection): Pilier[] {
  const presents = [...new Set(ctx.quetes.map((q) => q.pilier))];
  return presents.sort((a, b) => {
    const ecart = (ctx.momentumParPilier[a] ?? 0) - (ctx.momentumParPilier[b] ?? 0);
    if (ecart !== 0) return ecart;
    return PILIERS.indexOf(a) - PILIERS.indexOf(b);
  });
}

function comparerDansPilier(a: QueteProposable, b: QueteProposable): number {
  // Les versions minimales restent en réserve pour les jours bas et les
  // journées pleines : ailleurs, une vraie quête d'abord.
  if (a.minimale !== b.minimale) return a.minimale ? 1 : -1;
  if (a.poids !== b.poids) return b.poids - a.poids;
  if (a.dureeMin !== b.dureeMin) return a.dureeMin - b.dureeMin;
  return a.id - b.id;
}

/** La quête la plus légère d'abord : sert les jours bas et les jours pleins. */
function comparerPourJourMinimal(
  a: QueteProposable,
  b: QueteProposable,
  ctx: ContexteSelection,
): number {
  const ecart =
    (ctx.momentumParPilier[a.pilier] ?? 0) - (ctx.momentumParPilier[b.pilier] ?? 0);
  if (ecart !== 0) return ecart;
  if (a.dureeMin !== b.dureeMin) return a.dureeMin - b.dureeMin;
  return a.id - b.id;
}

/**
 * Sélection des quêtes du jour.
 *
 * Le nombre vient de la charge (temps disponible, récupération, jour bas) et
 * la somme des durées proposées doit tenir dans le budget — 40 % du temps
 * disponible. Une quête qui déborde le budget restant laisse la place à une
 * plus légère du même pilier.
 *
 * Dans tous les cas, les piliers au momentum le plus bas passent devant.
 */
export function selectionnerQuetes(ctx: ContexteSelection): QueteProposable[] {
  const eligibles = ctx.quetes.filter((q) => estEligible(q, ctx));
  if (eligibles.length === 0) return [];

  const quota = ctx.charge.nombreQuetes - ctx.validesAujourdhui.size;
  if (quota <= 0) return [];

  const budget = ctx.charge.budgetMinutes - ctx.minutesEngagees;

  // Jour bas ou journée pleine : un seul geste, et c'est la version minimale.
  if (ctx.charge.exigeMinimale) {
    const minimales = eligibles.filter((q) => q.minimale);
    // Sans quête minimale déclarée, on retombe sur la plus courte : ces
    // journées-là ne doivent jamais afficher un écran vide.
    const bassin = minimales.length > 0 ? minimales : eligibles;
    const choisie = [...bassin].sort((a, b) => comparerPourJourMinimal(a, b, ctx))[0];
    return [choisie];
  }

  const parPilier = new Map<Pilier, QueteProposable[]>();
  for (const quete of eligibles) {
    const liste = parPilier.get(quete.pilier);
    if (liste) liste.push(quete);
    else parPilier.set(quete.pilier, [quete]);
  }

  const retenues: QueteProposable[] = [];
  let restant = budget;

  for (const pilier of piliersParPriorite({ ...ctx, quetes: eligibles })) {
    if (retenues.length >= quota) break;
    if (ctx.piliersValidesAujourdhui.has(pilier)) continue;

    const liste = parPilier.get(pilier);
    if (!liste || liste.length === 0) continue;

    const choisie = [...liste]
      .sort(comparerDansPilier)
      .find((q) => q.dureeMin <= restant);
    if (!choisie) continue;

    retenues.push(choisie);
    restant -= choisie.dureeMin;
  }

  return retenues;
}
