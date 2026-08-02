import "server-only";

import { and, eq, gt, lte, max } from "drizzle-orm";

import { db } from "@/db";
import {
  arcs,
  creneaux,
  journees,
  momentum,
  quetes,
  validations,
  type Creneau,
  type Journee,
  type Pilier,
} from "@/db/schema";
import { PILIERS } from "./constantes";
import { aujourdhui, ecartJours, heureLocale, salutation } from "./dates";
import {
  appliquerDecroissance,
  borner,
  gainValidation,
  meriteBonusReprise,
} from "./momentum";
import {
  deduireTypeJour,
  selectionnerQuetes,
  type QueteProposable,
} from "./selection";

export type EtatJour = {
  date: string;
  salutation: string;
  journee: Journee;
  creneauxDuJour: Creneau[];
  momentums: { pilier: Pilier; valeur: number }[];
  quetesDuJour: QueteProposable[];
  quetesFaites: { id: number; titre: string; pilier: Pilier }[];
};

function vide<T>(valeur: T | undefined, defaut: T): T {
  return valeur === undefined ? defaut : valeur;
}

/** Crée les 5 lignes de momentum au premier lancement. */
async function assurerMomentum(date: string): Promise<void> {
  await db
    .insert(momentum)
    .values(PILIERS.map((pilier) => ({ pilier, valeur: 0, majLe: date })))
    .onConflictDoNothing();
}

/**
 * Applique la décroissance en attente : -5 % par jour réellement silencieux
 * depuis la dernière mise à jour. Les jours où le pilier a été nourri sont
 * exclus du décompte. Idempotent : rejouer la fonction le même jour ne fait rien.
 */
export async function synchroniserMomentum(date: string): Promise<void> {
  await assurerMomentum(date);

  const lignes = await db.select().from(momentum);
  const enRetard = lignes.filter((l) => ecartJours(l.majLe, date) > 0);
  if (enRetard.length === 0) return;

  const depuis = enRetard.reduce(
    (min, l) => (l.majLe < min ? l.majLe : min),
    enRetard[0].majLe,
  );

  const joursActifs = await db
    .selectDistinct({ pilier: arcs.pilier, date: validations.date })
    .from(validations)
    .innerJoin(quetes, eq(validations.queteId, quetes.id))
    .innerJoin(arcs, eq(quetes.arcId, arcs.id))
    .where(and(gt(validations.date, depuis), lte(validations.date, date)));

  for (const ligne of enRetard) {
    const joursEcoules = ecartJours(ligne.majLe, date);
    const actifs = joursActifs.filter(
      (a) => a.pilier === ligne.pilier && a.date > ligne.majLe && a.date <= date,
    ).length;
    const inactifs = Math.max(0, joursEcoules - actifs);

    await db
      .update(momentum)
      .set({ valeur: appliquerDecroissance(ligne.valeur, inactifs), majLe: date })
      .where(eq(momentum.pilier, ligne.pilier));
  }
}

/** Ouvre (ou rouvre) la journée du jour et met à jour sa charge. */
async function assurerJournee(date: string, creneauxDuJour: Creneau[]): Promise<Journee> {
  const typeJour = deduireTypeJour(creneauxDuJour);
  const [ligne] = await db
    .insert(journees)
    .values({ date, typeJour })
    .onConflictDoUpdate({ target: journees.date, set: { typeJour } })
    .returning();
  return ligne;
}

async function derniereValidationParPilier(): Promise<Map<Pilier, string>> {
  const lignes = await db
    .select({ pilier: arcs.pilier, derniere: max(validations.date) })
    .from(validations)
    .innerJoin(quetes, eq(validations.queteId, quetes.id))
    .innerJoin(arcs, eq(quetes.arcId, arcs.id))
    .groupBy(arcs.pilier);

  return new Map(
    lignes.filter((l) => l.derniere !== null).map((l) => [l.pilier, l.derniere as string]),
  );
}

/** Tout ce dont l'écran du jour a besoin, en une passe. */
export async function chargerJour(): Promise<EtatJour> {
  const date = aujourdhui();
  const jourSemaine = new Date(`${date}T00:00:00Z`).getUTCDay();

  const creneauxDuJour = await db
    .select()
    .from(creneaux)
    .where(eq(creneaux.jourSemaine, jourSemaine));

  const journee = await assurerJournee(date, creneauxDuJour);
  await synchroniserMomentum(date);

  const [lignesMomentum, catalogue, validationsDuJour, dernieresParQuete] =
    await Promise.all([
      db.select().from(momentum),
      db
        .select({
          id: quetes.id,
          arcId: quetes.arcId,
          titre: quetes.titre,
          poids: quetes.poids,
          dureeMin: quetes.dureeMin,
          recurrence: quetes.recurrence,
          joursExclus: quetes.joursExclus,
          minimale: quetes.minimale,
          pilier: arcs.pilier,
          arcNom: arcs.nom,
        })
        .from(quetes)
        .innerJoin(arcs, eq(quetes.arcId, arcs.id))
        .where(eq(arcs.actif, true)),
      db
        .select({
          queteId: validations.queteId,
          titre: quetes.titre,
          pilier: arcs.pilier,
        })
        .from(validations)
        .innerJoin(quetes, eq(validations.queteId, quetes.id))
        .innerJoin(arcs, eq(quetes.arcId, arcs.id))
        .where(eq(validations.date, date)),
      db
        .select({ queteId: validations.queteId, derniere: max(validations.date) })
        .from(validations)
        .groupBy(validations.queteId),
    ]);

  const momentumParPilier = Object.fromEntries(
    PILIERS.map((p) => [p, lignesMomentum.find((l) => l.pilier === p)?.valeur ?? 0]),
  ) as Record<Pilier, number>;

  const validesAujourdhui = new Set(validationsDuJour.map((v) => v.queteId));
  const piliersValidesAujourdhui = new Set(validationsDuJour.map((v) => v.pilier));

  const quetesDuJour = selectionnerQuetes({
    date,
    jourSemaine,
    typeJour: journee.typeJour,
    modeBas: journee.modeBas,
    quetes: catalogue,
    momentumParPilier,
    validesAujourdhui,
    piliersValidesAujourdhui,
    derniereValidationParQuete: new Map(
      dernieresParQuete
        .filter((l) => l.derniere !== null)
        .map((l) => [l.queteId, l.derniere as string]),
    ),
  });

  return {
    date,
    salutation: salutation(heureLocale()),
    journee,
    creneauxDuJour,
    momentums: PILIERS.map((pilier) => ({
      pilier,
      valeur: vide(momentumParPilier[pilier], 0),
    })),
    quetesDuJour,
    quetesFaites: validationsDuJour.map((v) => ({
      id: v.queteId,
      titre: v.titre,
      pilier: v.pilier,
    })),
  };
}

/**
 * Valide une quête : trace la validation puis fait monter le pilier de son
 * poids — doublé si le pilier sortait de deux jours de silence.
 */
export async function validerQuete(queteId: number): Promise<void> {
  const date = aujourdhui();
  await synchroniserMomentum(date);

  const [cible] = await db
    .select({ poids: quetes.poids, pilier: arcs.pilier })
    .from(quetes)
    .innerJoin(arcs, eq(quetes.arcId, arcs.id))
    .where(eq(quetes.id, queteId))
    .limit(1);
  if (!cible) return;

  const [deja] = await db
    .select({ id: validations.id })
    .from(validations)
    .where(and(eq(validations.queteId, queteId), eq(validations.date, date)))
    .limit(1);
  if (deja) return;

  const derniere = (await derniereValidationParPilier()).get(cible.pilier) ?? null;
  const bonusReprise = meriteBonusReprise(derniere, date);

  await db.insert(validations).values({ queteId, date, bonusReprise });

  const [ligne] = await db
    .select()
    .from(momentum)
    .where(eq(momentum.pilier, cible.pilier))
    .limit(1);

  await db
    .update(momentum)
    .set({
      valeur: borner((ligne?.valeur ?? 0) + gainValidation(cible.poids, bonusReprise)),
      majLe: date,
    })
    .where(eq(momentum.pilier, cible.pilier));
}

/** Bascule la journée en mode bas (ou en sort). */
export async function definirModeBas(modeBas: boolean): Promise<void> {
  const date = aujourdhui();
  await db
    .insert(journees)
    .values({ date, modeBas })
    .onConflictDoUpdate({ target: journees.date, set: { modeBas } });
}

/** Phrase du soir, enregistrée au fil de la frappe. */
export async function enregistrerPhrase(phrase: string): Promise<void> {
  const date = aujourdhui();
  const texte = phrase.slice(0, 2000);
  await db
    .insert(journees)
    .values({ date, phrase: texte })
    .onConflictDoUpdate({ target: journees.date, set: { phrase: texte } });
}
