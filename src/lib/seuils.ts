import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { arcs, seuilsArcs, type Pilier } from "@/db/schema";
import { chargerArcs } from "./arcs";
import { aujourdhui } from "./dates";

/**
 * Seuils d'arc.
 *
 * Franchir 10, 25, 50, 75 ou 100 % vaut un arrêt. L'écran ne s'affiche qu'une
 * fois : le franchissement est consigné, puis marqué vu. Un arc qui redescend
 * — la progression peut baisser si des quêtes changent — ne « déperd » pas son
 * seuil : ce qui a été atteint reste atteint.
 */

export const SEUILS = [10, 25, 50, 75, 100] as const;

export type SeuilAAnnoncer = {
  id: number;
  seuil: number;
  arcNom: string;
  arcVision: string;
  pilier: Pilier;
  atteintLe: string;
  /** Rang de ce franchissement dans l'histoire de l'arc. */
  progression: number;
  nombreValidations: number;
};

/**
 * Enregistre les seuils nouvellement franchis. Ne renvoie rien : la lecture se
 * fait ensuite, pour que l'écriture reste un effet de bord isolé.
 */
export async function consignerSeuils(date = aujourdhui()): Promise<void> {
  const [liste, deja] = await Promise.all([
    chargerArcs(),
    db.select().from(seuilsArcs),
  ]);

  const connus = new Set(deja.map((s) => `${s.arcId}:${s.seuil}`));

  const nouveaux = liste.flatMap((arc) =>
    SEUILS.filter(
      (seuil) => arc.progression >= seuil && !connus.has(`${arc.id}:${seuil}`),
    ).map((seuil) => ({ arcId: arc.id, seuil, atteintLe: date })),
  );

  if (nouveaux.length > 0) {
    await db.insert(seuilsArcs).values(nouveaux).onConflictDoNothing();
  }
}

/** Le prochain seuil à annoncer, s'il en reste un non vu. */
export async function seuilAAnnoncer(): Promise<SeuilAAnnoncer | null> {
  const [ligne] = await db
    .select({
      id: seuilsArcs.id,
      seuil: seuilsArcs.seuil,
      atteintLe: seuilsArcs.atteintLe,
      arcId: seuilsArcs.arcId,
      arcNom: arcs.nom,
      arcVision: arcs.vision,
      pilier: arcs.pilier,
    })
    .from(seuilsArcs)
    .innerJoin(arcs, eq(seuilsArcs.arcId, arcs.id))
    .where(eq(seuilsArcs.vu, false))
    .orderBy(asc(seuilsArcs.seuil), asc(seuilsArcs.id))
    .limit(1);

  if (!ligne) return null;

  const arc = (await chargerArcs()).find((a) => a.id === ligne.arcId);

  return {
    id: ligne.id,
    seuil: ligne.seuil,
    arcNom: ligne.arcNom,
    arcVision: ligne.arcVision,
    pilier: ligne.pilier,
    atteintLe: ligne.atteintLe,
    progression: arc?.progression ?? ligne.seuil,
    nombreValidations: arc?.nombreValidations ?? 0,
  };
}

export async function marquerSeuilVu(id: number): Promise<void> {
  await db.update(seuilsArcs).set({ vu: true }).where(eq(seuilsArcs.id, id));
}

export type LigneParcours = {
  id: number;
  seuil: number;
  atteintLe: string;
  arcNom: string;
  pilier: Pilier;
};

/** Tous les seuils franchis, du plus récent au plus ancien. */
export async function chargerParcours(): Promise<LigneParcours[]> {
  return db
    .select({
      id: seuilsArcs.id,
      seuil: seuilsArcs.seuil,
      atteintLe: seuilsArcs.atteintLe,
      arcNom: arcs.nom,
      pilier: arcs.pilier,
    })
    .from(seuilsArcs)
    .innerJoin(arcs, eq(seuilsArcs.arcId, arcs.id))
    .orderBy(desc(seuilsArcs.atteintLe), desc(seuilsArcs.seuil));
}

/** Utilisé par les tests d'intégration pour repartir d'un état propre. */
export async function oublierSeuil(arcId: number, seuil: number): Promise<void> {
  await db
    .delete(seuilsArcs)
    .where(and(eq(seuilsArcs.arcId, arcId), eq(seuilsArcs.seuil, seuil)));
}
