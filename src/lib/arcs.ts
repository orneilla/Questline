import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { arcs, quetes, validations, type Pilier } from "@/db/schema";

/**
 * Progression d'un arc.
 *
 * Elle ne se saisit pas : elle se lit dans les validations. Chaque validation
 * rapporte le poids de sa quête, doublé quand elle relançait un pilier
 * silencieux — exactement ce qui a nourri le momentum.
 *
 * Reste à savoir « cent pour cent de quoi ». L'objectif est déduit de l'arc
 * lui-même : ce qu'il rapporterait en tenant son rythme nominal pendant
 * l'horizon ci-dessous. Un arc exigeant demande donc plus de gestes qu'un arc
 * léger pour afficher le même pourcentage.
 */
export const HORIZON_SEMAINES = 12;

export type ResumeArc = {
  id: number;
  nom: string;
  pilier: Pilier;
  vision: string;
  actif: boolean;
  /** Poids cumulés des validations. */
  points: number;
  /** Ce que l'arc rapporterait à rythme nominal sur l'horizon. */
  objectif: number;
  progression: number;
  nombreQuetes: number;
  nombreValidations: number;
  derniereActivite: string | null;
};

export type QueteDArc = {
  id: number;
  titre: string;
  poids: number;
  dureeMin: number;
  frequenceSem: number;
  minimale: boolean;
  actif: boolean;
  nombreValidations: number;
  derniereActivite: string | null;
};

export type DetailArc = ResumeArc & {
  quetes: QueteDArc[];
  historique: { id: number; date: string; titre: string; bonusReprise: boolean }[];
};

/** Le gain d'une validation : le poids de la quête, doublé si c'était une reprise. */
const POINTS = sql<number>`coalesce(sum(${quetes.poids} * case when ${validations.bonusReprise} then 2 else 1 end), 0)`;

function progression(points: number, objectif: number): number {
  if (objectif <= 0) return 0;
  return Math.min(100, Math.round((100 * points) / objectif));
}

export async function chargerArcs(): Promise<ResumeArc[]> {
  const [lignes, capacites, activites] = await Promise.all([
    db.select().from(arcs).orderBy(arcs.id),

    // Rythme nominal de chaque arc : poids × fréquence, sur ses quêtes actives.
    db
      .select({
        arcId: quetes.arcId,
        capaciteHebdo: sql<number>`coalesce(sum(${quetes.poids} * ${quetes.frequenceSem}), 0)`,
        nombreQuetes: sql<number>`count(*)`,
      })
      .from(quetes)
      .where(eq(quetes.actif, true))
      .groupBy(quetes.arcId),

    db
      .select({
        arcId: quetes.arcId,
        points: POINTS,
        nombreValidations: sql<number>`count(*)`,
        derniere: sql<string | null>`max(${validations.date})`,
      })
      .from(validations)
      .innerJoin(quetes, eq(validations.queteId, quetes.id))
      .groupBy(quetes.arcId),
  ]);

  const parArc = new Map(capacites.map((c) => [c.arcId, c]));
  const parActivite = new Map(activites.map((a) => [a.arcId, a]));

  return lignes.map((arc) => {
    const capacite = parArc.get(arc.id);
    const activite = parActivite.get(arc.id);
    const points = Number(activite?.points ?? 0);
    const objectif = Number(capacite?.capaciteHebdo ?? 0) * HORIZON_SEMAINES;

    return {
      id: arc.id,
      nom: arc.nom,
      pilier: arc.pilier,
      vision: arc.vision,
      actif: arc.actif,
      points,
      objectif,
      progression: progression(points, objectif),
      nombreQuetes: Number(capacite?.nombreQuetes ?? 0),
      nombreValidations: Number(activite?.nombreValidations ?? 0),
      derniereActivite: activite?.derniere ?? null,
    };
  });
}

export async function chargerArc(id: number): Promise<DetailArc | null> {
  const resume = (await chargerArcs()).find((a) => a.id === id);
  if (!resume) return null;

  const [listeQuetes, parQuete, historique] = await Promise.all([
    db.select().from(quetes).where(eq(quetes.arcId, id)).orderBy(quetes.id),

    db
      .select({
        queteId: validations.queteId,
        nombre: sql<number>`count(*)`,
        derniere: sql<string | null>`max(${validations.date})`,
      })
      .from(validations)
      .innerJoin(quetes, eq(validations.queteId, quetes.id))
      .where(eq(quetes.arcId, id))
      .groupBy(validations.queteId),

    db
      .select({
        id: validations.id,
        date: validations.date,
        titre: quetes.titre,
        bonusReprise: validations.bonusReprise,
      })
      .from(validations)
      .innerJoin(quetes, eq(validations.queteId, quetes.id))
      .where(eq(quetes.arcId, id))
      .orderBy(desc(validations.date), desc(validations.id))
      .limit(120),
  ]);

  const compte = new Map(parQuete.map((p) => [p.queteId, p]));

  return {
    ...resume,
    quetes: listeQuetes.map((q) => ({
      id: q.id,
      titre: q.titre,
      poids: q.poids,
      dureeMin: q.dureeMin,
      frequenceSem: q.frequenceSem,
      minimale: q.minimale,
      actif: q.actif,
      nombreValidations: Number(compte.get(q.id)?.nombre ?? 0),
      derniereActivite: compte.get(q.id)?.derniere ?? null,
    })),
    historique,
  };
}

/** Quêtes actives d'un arc, pour les écrans qui n'ont pas besoin du reste. */
export async function quetesActives(arcId: number) {
  return db
    .select()
    .from(quetes)
    .where(and(eq(quetes.arcId, arcId), eq(quetes.actif, true)));
}
