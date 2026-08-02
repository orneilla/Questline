import { QUOTA_QUETES, SEUIL_QUETE_COURTE_MIN } from "./constantes";
import { ecartJours } from "./dates";
import type { Creneau, Pilier, Quete, TypeJour } from "@/db/schema";

export type QueteProposable = Quete & {
  pilier: Pilier;
  arcNom: string;
};

export type ContexteSelection = {
  date: string;
  jourSemaine: number;
  typeJour: TypeJour;
  modeBas: boolean;
  quetes: QueteProposable[];
  momentumParPilier: Record<Pilier, number>;
  /** Quêtes déjà cochées aujourd'hui : elles ne reviennent pas. */
  validesAujourdhui: ReadonlySet<number>;
  /** Piliers déjà servis aujourd'hui : on n'y revient pas non plus. */
  piliersValidesAujourdhui: ReadonlySet<Pilier>;
  /** Dernière fois que chaque quête a été validée, pour tenir la récurrence. */
  derniereValidationParQuete: ReadonlyMap<number, string>;
};

/**
 * La charge de la journée se lit dans les créneaux, pas dans une case à cocher.
 * Un shift écrase tout ; à défaut, des cours allègent la journée ; sinon libre.
 * Les créneaux de prière structurent la journée sans la charger.
 */
export function deduireTypeJour(creneauxDuJour: Creneau[]): TypeJour {
  if (creneauxDuJour.some((c) => c.type === "shift")) return "shift";
  if (creneauxDuJour.some((c) => c.type === "cours")) return "cours";
  return "libre";
}

function recurrenceRespectee(
  quete: QueteProposable,
  date: string,
  derniere: string | undefined,
): boolean {
  switch (quete.recurrence) {
    case "quotidienne":
      return true;
    case "hebdomadaire":
      return !derniere || ecartJours(derniere, date) >= 7;
    case "ponctuelle":
      return !derniere;
  }
}

function estEligible(quete: QueteProposable, ctx: ContexteSelection): boolean {
  if (ctx.validesAujourdhui.has(quete.id)) return false;
  if (quete.joursExclus.includes(ctx.jourSemaine)) return false;
  return recurrenceRespectee(
    quete,
    ctx.date,
    ctx.derniereValidationParQuete.get(quete.id),
  );
}

/** Du pilier le plus silencieux au plus vivant : c'est lui qu'on sert d'abord. */
function piliersParPriorite(ctx: ContexteSelection): Pilier[] {
  const presents = [...new Set(ctx.quetes.map((q) => q.pilier))];
  return presents.sort(
    (a, b) => (ctx.momentumParPilier[a] ?? 0) - (ctx.momentumParPilier[b] ?? 0),
  );
}

function comparerDansPilier(
  a: QueteProposable,
  b: QueteProposable,
  privilegierCourt: boolean,
): number {
  // Les versions minimales restent en réserve pour les jours bas : même un
  // jour de shift mérite une vraie quête, simplement courte.
  if (a.minimale !== b.minimale) return a.minimale ? 1 : -1;
  if (privilegierCourt && a.dureeMin !== b.dureeMin) return a.dureeMin - b.dureeMin;
  if (a.poids !== b.poids) return b.poids - a.poids;
  return a.dureeMin - b.dureeMin;
}

/**
 * Sélection des quêtes du jour.
 *
 * - jour bas   → une seule quête, la version minimale ;
 * - jour shift → une seule quête, et courte ;
 * - jour cours → deux quêtes sur deux piliers ;
 * - jour libre → trois quêtes sur trois piliers.
 *
 * Dans tous les cas, les piliers au momentum le plus bas passent devant.
 */
export function selectionnerQuetes(ctx: ContexteSelection): QueteProposable[] {
  const eligibles = ctx.quetes.filter((q) => estEligible(q, ctx));
  if (eligibles.length === 0) return [];

  if (ctx.modeBas) {
    // Le geste du jour bas a déjà été posé : la journée s'arrête là.
    if (ctx.validesAujourdhui.size > 0) return [];

    const minimales = eligibles.filter((q) => q.minimale);
    // Sans quête minimale déclarée, on retombe sur la plus courte : le jour bas
    // ne doit jamais afficher un écran vide.
    const bassin = minimales.length > 0 ? minimales : eligibles;
    const choisie = [...bassin].sort((a, b) => {
      const ecart =
        (ctx.momentumParPilier[a.pilier] ?? 0) - (ctx.momentumParPilier[b.pilier] ?? 0);
      if (ecart !== 0) return ecart;
      return a.dureeMin - b.dureeMin;
    })[0];
    return [choisie];
  }

  // Ce qui a déjà été fait aujourd'hui compte dans le quota : une journée
  // n'enchaîne pas les quêtes, elle en propose un nombre arrêté.
  const quota = QUOTA_QUETES[ctx.typeJour] - ctx.validesAujourdhui.size;
  if (quota <= 0) return [];

  const privilegierCourt = ctx.typeJour === "shift";

  let bassin = eligibles;
  if (privilegierCourt) {
    const courtes = eligibles.filter((q) => q.dureeMin <= SEUIL_QUETE_COURTE_MIN);
    if (courtes.length > 0) bassin = courtes;
  }

  const parPilier = new Map<Pilier, QueteProposable[]>();
  for (const quete of bassin) {
    const liste = parPilier.get(quete.pilier);
    if (liste) liste.push(quete);
    else parPilier.set(quete.pilier, [quete]);
  }

  const retenues: QueteProposable[] = [];
  for (const pilier of piliersParPriorite({ ...ctx, quetes: bassin })) {
    if (retenues.length >= quota) break;
    if (ctx.piliersValidesAujourdhui.has(pilier)) continue;
    const liste = parPilier.get(pilier);
    if (!liste || liste.length === 0) continue;
    retenues.push([...liste].sort((a, b) => comparerDansPilier(a, b, privilegierCourt))[0]);
  }

  return retenues;
}
