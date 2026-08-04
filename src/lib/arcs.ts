import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { arcs, etapesArc, quetes, validations, type Pilier } from "@/db/schema";
import { aujourdhui } from "@/lib/dates";

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
  /** Date de l'accomplissement, ou nulle tant que l'arc est en cours. */
  accompliLe: string | null;
  ordre: number;
  /** Étapes franchies sur étapes déclarées. */
  etapesFaites: number;
  etapesTotal: number;
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

export type EtapeAffichee = {
  id: number;
  titre: string;
  detail: string;
  ordre: number;
  atteinteLe: string | null;
};

export type DetailArc = ResumeArc & {
  etapes: EtapeAffichee[];
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
  const [lignes, capacites, activites, comptesEtapes] = await Promise.all([
    db.select().from(arcs).orderBy(asc(arcs.ordre), asc(arcs.id)),

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

    db
      .select({
        arcId: etapesArc.arcId,
        total: sql<number>`count(*)`,
        faites: sql<number>`count(${etapesArc.atteinteLe})`,
      })
      .from(etapesArc)
      .groupBy(etapesArc.arcId),
  ]);

  const etapes = new Map(comptesEtapes.map((e) => [e.arcId, e]));
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
      accompliLe: arc.accompliLe,
      ordre: arc.ordre,
      etapesFaites: Number(etapes.get(arc.id)?.faites ?? 0),
      etapesTotal: Number(etapes.get(arc.id)?.total ?? 0),
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

  const [listeQuetes, listeEtapes, parQuete, historique] = await Promise.all([
    db.select().from(quetes).where(eq(quetes.arcId, id)).orderBy(quetes.id),

    db
      .select()
      .from(etapesArc)
      .where(eq(etapesArc.arcId, id))
      .orderBy(asc(etapesArc.ordre), asc(etapesArc.id)),

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
    etapes: listeEtapes,
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

/* ─────────────────────── Écriture : créer, modifier, ranger ─────────────────────── */

/**
 * Le catalogue de départ n'est qu'un point de départ.
 *
 * Rien n'y est figé : un arc du catalogue se renomme, change de pilier,
 * s'archive et s'accomplit comme un arc créé à la main. Ce fichier ne fait donc
 * aucune distinction entre les deux — il n'existe pas de drapeau « fourni »,
 * parce qu'un tel drapeau finirait tôt ou tard par interdire quelque chose.
 */

export type SaisieArc = {
  nom: string;
  pilier: Pilier;
  vision: string;
};

export async function creerArc(saisie: SaisieArc): Promise<number> {
  const [dernier] = await db
    .select({ ordre: sql<number>`coalesce(max(${arcs.ordre}), 0)::int` })
    .from(arcs);

  const [cree] = await db
    .insert(arcs)
    .values({
      nom: saisie.nom.trim().slice(0, 120),
      pilier: saisie.pilier,
      vision: saisie.vision.trim(),
      ordre: Number(dernier?.ordre ?? 0) + 1,
    })
    .returning({ id: arcs.id });

  return cree.id;
}

export async function modifierArc(id: number, saisie: SaisieArc): Promise<void> {
  await db
    .update(arcs)
    .set({
      nom: saisie.nom.trim().slice(0, 120),
      pilier: saisie.pilier,
      vision: saisie.vision.trim(),
    })
    .where(eq(arcs.id, id));
}

/**
 * Archive un arc, ou le sort de l'archive.
 *
 * Rien n'est effacé : les quêtes, les validations, les seuils et l'historique
 * restent. L'arc cesse simplement d'alimenter la sélection du jour. C'est ce qui
 * permet de mettre un chantier de côté sans avoir à choisir entre le garder
 * ouvert et perdre ce qu'il a produit.
 */
export async function archiverArc(id: number, archive: boolean): Promise<void> {
  await db.update(arcs).set({ actif: !archive }).where(eq(arcs.id, id));
}

/**
 * Déclare un arc accompli, ou le rouvre.
 *
 * Un arc accompli rejoint la page des arcs accomplis et quitte la sélection.
 * Le rouvrir efface la date d'accomplissement et le remet en circulation :
 * un chantier qu'on croyait fini peut toujours reprendre.
 */
export async function accomplirArc(id: number, accompli: boolean): Promise<void> {
  await db
    .update(arcs)
    .set({ accompliLe: accompli ? aujourdhui() : null, actif: !accompli })
    .where(eq(arcs.id, id));
}

/** Range les arcs dans l'ordre donné. */
export async function reordonnerArcs(ids: number[]): Promise<void> {
  for (const [rang, id] of ids.entries()) {
    await db.update(arcs).set({ ordre: rang + 1 }).where(eq(arcs.id, id));
  }
}

/* ───────────────────────────── Étapes ───────────────────────────── */

export async function ajouterEtape(arcId: number, titre: string): Promise<void> {
  const propre = titre.trim();
  if (propre.length === 0) return;

  const [dernier] = await db
    .select({ ordre: sql<number>`coalesce(max(${etapesArc.ordre}), 0)::int` })
    .from(etapesArc)
    .where(eq(etapesArc.arcId, arcId));

  await db.insert(etapesArc).values({
    arcId,
    titre: propre.slice(0, 200),
    ordre: Number(dernier?.ordre ?? 0) + 1,
  });
}

export async function modifierEtape(
  id: number,
  titre: string,
  detail: string,
): Promise<void> {
  await db
    .update(etapesArc)
    .set({ titre: titre.trim().slice(0, 200), detail: detail.trim() })
    .where(eq(etapesArc.id, id));
}

export async function supprimerEtape(id: number): Promise<void> {
  await db.delete(etapesArc).where(eq(etapesArc.id, id));
}

/** Franchit une étape, ou revient dessus. La date de franchissement reste. */
export async function franchirEtape(id: number, atteinte: boolean): Promise<void> {
  await db
    .update(etapesArc)
    .set({ atteinteLe: atteinte ? aujourdhui() : null })
    .where(eq(etapesArc.id, id));
}

/**
 * Déplace une étape d'un cran.
 *
 * L'échange se fait sur deux voisines plutôt que par une renumérotation
 * complète : c'est le geste qu'on fait réellement — remonter une étape d'une
 * ligne — et il reste juste même si les ordres ont des trous.
 */
export async function deplacerEtape(id: number, sens: -1 | 1): Promise<void> {
  const [etape] = await db.select().from(etapesArc).where(eq(etapesArc.id, id)).limit(1);
  if (!etape) return;

  const fratrie = await db
    .select()
    .from(etapesArc)
    .where(eq(etapesArc.arcId, etape.arcId))
    .orderBy(asc(etapesArc.ordre), asc(etapesArc.id));

  const rang = fratrie.findIndex((e) => e.id === id);
  const cible = rang + sens;
  if (rang < 0 || cible < 0 || cible >= fratrie.length) return;

  const remise = fratrie.slice();
  [remise[rang], remise[cible]] = [remise[cible], remise[rang]];

  for (const [index, e] of remise.entries()) {
    await db.update(etapesArc).set({ ordre: index + 1 }).where(eq(etapesArc.id, e.id));
  }
}
