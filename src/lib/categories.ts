import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { categoriesCreneau, reglesCategorie } from "@/db/schema";
import {
  CATEGORIES_ORIGINE,
  clePropre,
  couleurValide,
  type CategorieAffichee,
  type RegleAffichee,
} from "./categories-partage";

/**
 * Les catégories de créneau, et les règles qui classent les créneaux importés.
 *
 * Comme pour les piliers : ce sont des lignes, donc elles se renomment, se
 * recolorient, se réordonnent, s'ajoutent et se suppriment. La clé ne bouge
 * jamais — les créneaux la portent, et la changer pour une correction
 * d'orthographe casserait ce qui s'y rattache.
 */

/** Ne lève jamais : une base absente rend les catégories d'origine. */
export async function chargerCategories(): Promise<CategorieAffichee[]> {
  try {
    const lignes = await db
      .select()
      .from(categoriesCreneau)
      .orderBy(asc(categoriesCreneau.ordre), asc(categoriesCreneau.cle));
    if (lignes.length === 0) return CATEGORIES_ORIGINE;
    return lignes;
  } catch {
    return CATEGORIES_ORIGINE;
  }
}

export type EtatCategories = {
  liste: CategorieAffichee[];
  regles: RegleAffichee[];
  /** La migration n'a pas encore tourné : rien n'est modifiable. */
  tableAbsente: boolean;
};

export async function etatCategories(): Promise<EtatCategories> {
  try {
    const [liste, regles] = await Promise.all([
      db
        .select()
        .from(categoriesCreneau)
        .orderBy(asc(categoriesCreneau.ordre), asc(categoriesCreneau.cle)),
      db
        .select()
        .from(reglesCategorie)
        .orderBy(asc(reglesCategorie.ordre), asc(reglesCategorie.id)),
    ]);
    if (liste.length === 0) {
      return { liste: CATEGORIES_ORIGINE, regles: [], tableAbsente: true };
    }
    return { liste, regles, tableAbsente: false };
  } catch {
    return { liste: CATEGORIES_ORIGINE, regles: [], tableAbsente: true };
  }
}

export async function clesCategories(): Promise<string[]> {
  const liste = await chargerCategories();
  return liste.map((c) => c.cle);
}

/* ────────────────────── Écriture des catégories ────────────────────── */

export async function creerCategorie(champs: {
  nom: string;
  couleur: string;
}): Promise<string | null> {
  const nom = champs.nom.trim().slice(0, 40);
  if (nom.length === 0) return null;
  if (!couleurValide(champs.couleur)) return null;

  const base = clePropre(nom);
  if (base.length === 0) return null;

  const existantes = new Set(await clesCategories());
  let cle = base;
  for (let n = 2; existantes.has(cle) && n < 50; n += 1) cle = `${base}_${n}`;
  if (existantes.has(cle)) return null;

  const [dernier] = await db
    .select({ max: sql<number | null>`max(${categoriesCreneau.ordre})` })
    .from(categoriesCreneau);

  await db
    .insert(categoriesCreneau)
    .values({ cle, nom, couleur: champs.couleur, ordre: (dernier?.max ?? 0) + 1 });

  return cle;
}

export async function modifierCategorie(
  cle: string,
  champs: { nom: string; couleur: string },
): Promise<boolean> {
  const nom = champs.nom.trim().slice(0, 40);
  if (nom.length === 0) return false;
  if (!couleurValide(champs.couleur)) return false;

  const modifiees = await db
    .update(categoriesCreneau)
    .set({ nom, couleur: champs.couleur })
    .where(eq(categoriesCreneau.cle, cle))
    .returning({ cle: categoriesCreneau.cle });

  return modifiees.length > 0;
}

export async function reordonnerCategories(cles: string[]): Promise<void> {
  for (const [rang, cle] of cles.entries()) {
    await db
      .update(categoriesCreneau)
      .set({ ordre: rang + 1 })
      .where(eq(categoriesCreneau.cle, cle));
  }
}

export type PerteCategorie = { nom: string; recurrents: number; evenements: number };

/** Ce qu'une suppression déplacerait. Rien n'est touché ici. */
export async function perteCategorie(cle: string): Promise<PerteCategorie | null> {
  const [categorie] = await db
    .select()
    .from(categoriesCreneau)
    .where(eq(categoriesCreneau.cle, cle))
    .limit(1);
  if (!categorie) return null;

  const [recurrents, evenements] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(sql`creneaux_recurrents`)
      .where(sql`type = ${cle}`)
      .then((r) => Number(r[0]?.n ?? 0)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(sql`evenements`)
      .where(sql`type = ${cle}`)
      .then((r) => Number(r[0]?.n ?? 0)),
  ]);

  return { nom: categorie.nom, recurrents, evenements };
}

export type IssueSuppression = "fait" | "protegee" | "absente";

/**
 * Supprime une catégorie.
 *
 * « Autre » ne se supprime pas : c'est le refuge des créneaux dont la
 * catégorie disparaît, et le retirer laisserait la contrainte sans cible.
 * Les créneaux concernés y retombent au lieu d'être effacés — c'est du temps
 * occupé, pas une étiquette.
 */
export async function supprimerCategorie(cle: string): Promise<IssueSuppression> {
  if (cle === "autre") return "protegee";

  const parties = await db
    .delete(categoriesCreneau)
    .where(eq(categoriesCreneau.cle, cle))
    .returning({ cle: categoriesCreneau.cle });

  return parties.length > 0 ? "fait" : "absente";
}

/* ────────────────────── Règles de classement ────────────────────── */

export async function chargerRegles(): Promise<RegleAffichee[]> {
  try {
    return await db
      .select()
      .from(reglesCategorie)
      .orderBy(asc(reglesCategorie.ordre), asc(reglesCategorie.id));
  } catch {
    return [];
  }
}

export async function creerRegle(motif: string, categorie: string): Promise<boolean> {
  const propre = motif.trim().slice(0, 60);
  if (propre.length === 0) return false;
  if (!(await clesCategories()).includes(categorie)) return false;

  const [dernier] = await db
    .select({ max: sql<number | null>`max(${reglesCategorie.ordre})` })
    .from(reglesCategorie);

  await db
    .insert(reglesCategorie)
    .values({ motif: propre, categorie, ordre: (dernier?.max ?? 0) + 1 });

  return true;
}

export async function modifierRegle(
  id: number,
  champs: { motif: string; categorie: string },
): Promise<boolean> {
  const motif = champs.motif.trim().slice(0, 60);
  if (motif.length === 0) return false;
  if (!(await clesCategories()).includes(champs.categorie)) return false;

  const modifiees = await db
    .update(reglesCategorie)
    .set({ motif, categorie: champs.categorie })
    .where(eq(reglesCategorie.id, id))
    .returning({ id: reglesCategorie.id });

  return modifiees.length > 0;
}

export async function deplacerRegle(ids: number[]): Promise<void> {
  for (const [rang, id] of ids.entries()) {
    await db
      .update(reglesCategorie)
      .set({ ordre: rang + 1 })
      .where(eq(reglesCategorie.id, id));
  }
}

export async function supprimerRegle(id: number): Promise<boolean> {
  const parties = await db
    .delete(reglesCategorie)
    .where(eq(reglesCategorie.id, id))
    .returning({ id: reglesCategorie.id });
  return parties.length > 0;
}
