import "server-only";

import { and, count, eq, gt, gte, inArray, lte, max } from "drizzle-orm";

import { db } from "@/db";
import {
  arcs,
  creneauxRecurrents,
  evenements,
  journees,
  momentum,
  quetes,
  validations,
  type Journee,
  type Pilier,
} from "@/db/schema";
import { calculerCharge, type Charge } from "./charge";
import { resoudreJour, type Bloc } from "./creneaux";
import { debordement, minutesEveillees, tempsDispo } from "./temps";
import { FENETRE_FREQUENCE_JOURS, PILIERS } from "./constantes";
import {
  aujourdhui,
  decalerJours,
  ecartJours,
  heureLocale,
  jourDeLaSemaine,
  salutation,
} from "./dates";
import {
  appliquerDecroissance,
  borner,
  gainValidation,
  meriteBonusReprise,
} from "./momentum";
import { selectionnerQuetes, type QueteProposable } from "./selection";

export type EtatJour = {
  date: string;
  salutation: string;
  journee: Journee;
  charge: Charge;
  blocsDuJour: Bloc[];
  momentums: { pilier: Pilier; valeur: number }[];
  quetesDuJour: QueteProposable[];
  quetesFaites: { id: number; titre: string; pilier: Pilier }[];
};

function vide<T>(valeur: T | undefined, defaut: T): T {
  return valeur === undefined ? defaut : valeur;
}

/** Crée une ligne de momentum par pilier au premier lancement. */
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

/** Ouvre (ou rouvre) la journée du jour et enregistre son niveau de charge. */
async function assurerJournee(date: string, typeJour: Journee["typeJour"]): Promise<Journee> {
  const [ligne] = await db
    .insert(journees)
    .values({ date, typeJour })
    .onConflictDoUpdate({ target: journees.date, set: { typeJour } })
    .returning();
  return ligne;
}

/**
 * Temps disponible d'une date : 16 h d'éveil, moins ce qu'occupent les
 * créneaux résolus, moins les deux heures incompressibles. La récupération se
 * lit sur la veille : un créneau qui a mordu sur la nuit allège le lendemain.
 */
export async function calculerJournee(date: string, modeBas: boolean) {
  const jourSemaine = jourDeLaSemaine(date);
  const veille = decalerJours(date, -1);

  const [recurrents, ponctuels] = await Promise.all([
    db.select().from(creneauxRecurrents),
    db
      .select()
      .from(evenements)
      .where(inArray(evenements.date, [veille, date])),
  ]);

  const jour = resoudreJour(date, jourSemaine, recurrents, ponctuels);
  const laVeille = resoudreJour(veille, jourDeLaSemaine(veille), recurrents, ponctuels);

  const occupe = minutesEveillees(jour.blocs.map((b) => b.plage));
  const recuperation = debordement(laVeille.blocs.map((b) => b.plage)) > 0;

  return {
    blocs: jour.blocs,
    charge: calculerCharge({
      tempsDispoMin: tempsDispo(occupe),
      recuperation,
      modeBas,
    }),
  };
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
  const jourSemaine = jourDeLaSemaine(date);

  // Le mode bas est une décision de l'utilisatrice : il entre dans le calcul
  // de la charge, il n'en sort pas.
  const [deja] = await db.select().from(journees).where(eq(journees.date, date));
  const { blocs, charge } = await calculerJournee(date, deja?.modeBas ?? false);

  const journee = await assurerJournee(date, charge.niveau);
  await synchroniserMomentum(date);

  const [lignesMomentum, catalogue, validationsDuJour, comptesDeLaSemaine] =
    await Promise.all([
      db.select().from(momentum),
      db
        .select({
          id: quetes.id,
          arcId: quetes.arcId,
          titre: quetes.titre,
          poids: quetes.poids,
          dureeMin: quetes.dureeMin,
          frequenceSem: quetes.frequenceSem,
          joursExclus: quetes.joursExclus,
          minimale: quetes.minimale,
          actif: quetes.actif,
          pilier: arcs.pilier,
          arcNom: arcs.nom,
        })
        .from(quetes)
        .innerJoin(arcs, eq(quetes.arcId, arcs.id))
        // Un arc en sommeil ou une quête désactivée ne sort plus.
        .where(and(eq(arcs.actif, true), eq(quetes.actif, true)))
        // Ordre explicite : sans lui, Postgres ne garantit rien et la
        // sélection pourrait changer d'un rafraîchissement à l'autre.
        .orderBy(quetes.id),
      db
        .select({
          queteId: validations.queteId,
          titre: quetes.titre,
          dureeMin: quetes.dureeMin,
          pilier: arcs.pilier,
        })
        .from(validations)
        .innerJoin(quetes, eq(validations.queteId, quetes.id))
        .innerJoin(arcs, eq(quetes.arcId, arcs.id))
        .where(eq(validations.date, date)),
      db
        .select({ queteId: validations.queteId, combien: count() })
        .from(validations)
        .where(gte(validations.date, decalerJours(date, -(FENETRE_FREQUENCE_JOURS - 1))))
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
    charge,
    quetes: catalogue,
    momentumParPilier,
    validesAujourdhui,
    piliersValidesAujourdhui,
    validationsDeLaSemaine: new Map(
      comptesDeLaSemaine.map((l) => [l.queteId, l.combien]),
    ),
    minutesEngagees: validationsDuJour.reduce((total, v) => total + v.dureeMin, 0),
  });

  return {
    date,
    salutation: salutation(heureLocale()),
    journee,
    charge,
    blocsDuJour: blocs,
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
