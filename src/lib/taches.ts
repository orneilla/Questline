import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { arcs, quetes, taches, type Pilier } from "@/db/schema";
import { aujourdhui } from "@/lib/dates";
import { crediterPilier } from "@/lib/jour";

/**
 * Les tâches libres.
 *
 * Ce qui tombe sans prévenir et n'entre dans aucun arc. C'est une liste, pas un
 * système : on ajoute une ligne, on la coche, on la supprime. Il n'y a
 * délibérément ni priorité, ni étiquette, ni échéance — ajouter l'un des trois
 * transformerait la liste en chose à tenir, et une chose à tenir finit par être
 * une dette.
 *
 * ── Pourquoi rien ne « passe au lendemain »
 *
 * Une tâche ouverte n'a pas de date de réalisation prévue : elle a une date de
 * création, et c'est tout. Elle reste donc dans la liste jusqu'à ce qu'elle soit
 * faite ou retirée. Il n'y a aucun report à opérer, et surtout aucun moyen de
 * calculer un retard — c'est le seul moyen sûr de ne jamais en afficher un.
 * L'ancienneté est lisible si on la cherche, jamais soulignée.
 *
 * ── Ce que crédite une tâche
 *
 * Rien, par défaut. Rattachée à un pilier, elle lui apporte un gain modeste et
 * une seule fois : c'est un geste réel, il compte, mais il ne vient d'aucun arc
 * et ne doit pas peser autant qu'une quête choisie.
 */

/** Le gain d'une tâche cochée. Volontairement plus léger qu'une quête. */
const GAIN_TACHE = 2;

/** À partir de combien de fois une tâche répétée mérite qu'on propose une quête. */
const SEUIL_RECURRENCE = 3;

export type TacheOuverte = {
  id: number;
  texte: string;
  pilier: Pilier | null;
  creeeLe: string;
  /** Jours écoulés depuis la création. Informatif, jamais un reproche. */
  age: number;
  /**
   * Nombre de fois où une tâche du même intitulé a déjà été faite. Au-delà du
   * seuil, l'écran propose d'en faire une quête — c'est le signe d'un geste
   * régulier déguisé en imprévu.
   */
  repetitions: number;
};

export type TacheFaite = {
  id: number;
  texte: string;
  pilier: Pilier | null;
  faiteLe: string;
};

export type EtatTaches = {
  ouvertes: TacheOuverte[];
  /** Ce qui a été coché aujourd'hui, pour que cocher laisse une trace visible. */
  faitesAujourdhui: TacheFaite[];
};

/**
 * Deux tâches sont « la même » si leurs intitulés ne diffèrent que par la casse
 * et les blancs de bord. `unaccent` demanderait une extension Postgres qui peut
 * manquer à l'hébergement : la comparaison reste donc en minuscules sur le
 * texte brut, moins fine mais suffisante pour repérer un geste qui revient.
 */
const CLE_REPETITION = sql<string>`lower(btrim(${taches.texte}))`;

export async function chargerTaches(): Promise<EtatTaches> {
  const date = aujourdhui();

  const [ouvertes, faites, repetitions] = await Promise.all([
    db
      .select()
      .from(taches)
      .where(isNull(taches.faiteLe))
      .orderBy(asc(taches.ordre), asc(taches.id)),

    db
      .select()
      .from(taches)
      .where(eq(taches.faiteLe, date))
      .orderBy(desc(taches.id)),

    db
      .select({ cle: CLE_REPETITION, combien: sql<number>`count(*)::int` })
      .from(taches)
      .where(sql`${taches.faiteLe} is not null`)
      .groupBy(CLE_REPETITION),
  ]);

  const comptes = new Map(repetitions.map((r) => [r.cle, Number(r.combien)]));

  return {
    ouvertes: ouvertes.map((t) => ({
      id: t.id,
      texte: t.texte,
      pilier: t.pilier,
      creeeLe: t.creeeLe,
      age: joursEntre(t.creeeLe, date),
      repetitions: comptes.get(t.texte.trim().toLowerCase()) ?? 0,
    })),
    faitesAujourdhui: faites.map((t) => ({
      id: t.id,
      texte: t.texte,
      pilier: t.pilier,
      faiteLe: t.faiteLe ?? date,
    })),
  };
}

function joursEntre(depuis: string, jusqua: string): number {
  const a = Date.parse(`${depuis}T00:00:00Z`);
  const b = Date.parse(`${jusqua}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Ajoute une tâche. Une ligne, rien d'autre à remplir. */
export async function ajouterTache(
  texte: string,
  pilier: Pilier | null,
): Promise<void> {
  const propre = texte.trim();
  if (propre.length === 0) return;

  // La nouvelle tâche se pose en fin de liste.
  const [dernier] = await db
    .select({ ordre: sql<number>`coalesce(max(${taches.ordre}), 0)::int` })
    .from(taches)
    .where(isNull(taches.faiteLe));

  await db.insert(taches).values({
    texte: propre.slice(0, 300),
    pilier,
    creeeLe: aujourdhui(),
    ordre: Number(dernier?.ordre ?? 0) + 1,
  });
}

/**
 * Coche une tâche, ou la décoche.
 *
 * Décocher ne retire pas le crédit déjà donné au pilier : le geste a eu lieu,
 * et `crediterPilier` ne compte de toute façon qu'une fois par jour et par
 * motif. Recocher ne le donne donc pas deux fois non plus.
 */
export async function cocherTache(id: number, faite: boolean): Promise<void> {
  const date = aujourdhui();

  const [ligne] = await db
    .update(taches)
    .set({ faiteLe: faite ? date : null })
    .where(eq(taches.id, id))
    .returning({ pilier: taches.pilier });

  if (faite && ligne?.pilier) {
    await crediterPilier(ligne.pilier, GAIN_TACHE, `tache:${id}`);
  }
}

export async function supprimerTache(id: number): Promise<void> {
  await db.delete(taches).where(eq(taches.id, id));
}

/** Change — ou retire — le pilier d'une tâche. */
export async function rattacherTache(
  id: number,
  pilier: Pilier | null,
): Promise<void> {
  await db.update(taches).set({ pilier }).where(eq(taches.id, id));
}

export type ArcDisponible = { id: number; nom: string; pilier: Pilier };

/** Les arcs auxquels une tâche promue peut se rattacher. */
export async function arcsPourPromotion(): Promise<ArcDisponible[]> {
  return db
    .select({ id: arcs.id, nom: arcs.nom, pilier: arcs.pilier })
    .from(arcs)
    .where(and(eq(arcs.actif, true), isNull(arcs.accompliLe)))
    .orderBy(asc(arcs.ordre), asc(arcs.id));
}

/**
 * Promeut une tâche en quête.
 *
 * Une tâche qui revient n'est pas un imprévu : c'est un geste régulier qui n'a
 * pas encore de place. La promotion lui en donne une, dans un arc choisi, et
 * retire la tâche de la liste — elle reviendra désormais par la sélection du
 * jour, avec son poids et sa fréquence.
 */
export async function promouvoirTache(
  id: number,
  arcId: number,
  frequenceSem: number,
  dureeMin: number,
): Promise<{ titre: string; arc: string }> {
  const [tache] = await db.select().from(taches).where(eq(taches.id, id)).limit(1);
  if (!tache) throw new Error("Tâche introuvable.");

  const [arc] = await db
    .select({ nom: arcs.nom })
    .from(arcs)
    .where(eq(arcs.id, arcId))
    .limit(1);
  if (!arc) throw new Error("Arc introuvable.");

  await db.insert(quetes).values({
    arcId,
    titre: tache.texte,
    frequenceSem: Math.min(7, Math.max(1, frequenceSem)),
    dureeMin: Math.max(0, dureeMin),
  });

  // La tâche a trouvé sa place : elle n'a plus à encombrer la liste libre.
  await db.delete(taches).where(eq(taches.id, id));

  return { titre: tache.texte, arc: arc.nom };
}

export { SEUIL_RECURRENCE };
