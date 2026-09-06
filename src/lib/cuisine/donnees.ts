import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  cuisineAliments,
  cuisineCourses,
  cuisineInventaire,
  type ArticleCourses,
  type ArticleInventaire,
  type NiveauCuisine,
} from "@/db/cuisine";
import { aujourdhui } from "@/lib/dates";
import { CATEGORIE_PAR_DEFAUT, categorieValide, deviner } from "./categories";

/**
 * Inventaire et courses.
 *
 * Ce module ne lit et n'écrit que des tables `cuisine_`. Il n'importe rien de
 * la logique des piliers, de l'élan, des cartes ou du calendrier, et rien de
 * ce qu'il fait n'a d'effet ailleurs dans Questline.
 */

/** Ordre d'affichage : ce qui manque en premier, c'est ce qui décide d'un repas. */
const RANG_NIVEAU = sql`case ${cuisineInventaire.niveau}
  when 'epuise' then 0 when 'un_peu' then 1 else 2 end`;

export type LigneInventaire = ArticleInventaire & {
  /** Rempli quand l'article est relié au catalogue. */
  alimentNom: string | null;
};

export async function chargerInventaire(): Promise<LigneInventaire[]> {
  const lignes = await db
    .select({
      id: cuisineInventaire.id,
      alimentId: cuisineInventaire.alimentId,
      nomLibre: cuisineInventaire.nomLibre,
      categorie: cuisineInventaire.categorie,
      niveau: cuisineInventaire.niveau,
      datePeremption: cuisineInventaire.datePeremption,
      dateAjout: cuisineInventaire.dateAjout,
      alimentNom: cuisineAliments.nom,
    })
    .from(cuisineInventaire)
    .leftJoin(cuisineAliments, eq(cuisineInventaire.alimentId, cuisineAliments.id))
    .orderBy(RANG_NIVEAU, asc(cuisineInventaire.categorie), asc(cuisineInventaire.nomLibre));

  return lignes;
}

/**
 * Ajoute un article.
 *
 * La catégorie est devinée du nom quand elle n'est pas donnée : c'est ce qui
 * permet d'ajouter en un seul geste. Elle se corrige ensuite d'un tap, et se
 * tromper n'a aucune conséquence grave.
 */
export async function ajouterAuStock(
  nom: string,
  categorie?: string,
): Promise<number | null> {
  const propre = nom.trim().slice(0, 120);
  if (propre.length === 0) return null;

  const [ligne] = await db
    .insert(cuisineInventaire)
    .values({
      nomLibre: propre,
      categorie: categorie && categorieValide(categorie) ? categorie : deviner(propre),
      niveau: "beaucoup",
      dateAjout: aujourdhui(),
    })
    .returning({ id: cuisineInventaire.id });

  return ligne?.id ?? null;
}

const CYCLE: Record<NiveauCuisine, NiveauCuisine> = {
  beaucoup: "un_peu",
  un_peu: "epuise",
  epuise: "beaucoup",
};

/**
 * Fait tourner le niveau d'un article : beaucoup → un peu → épuisé → beaucoup.
 *
 * Un seul tap, pas de menu : c'est la seule façon qu'un inventaire soit tenu
 * à jour. Un article épuisé n'est pas supprimé — il reste visible, et c'est
 * lui qu'on ajoute aux courses.
 */
export async function tournerNiveau(id: number): Promise<NiveauCuisine | null> {
  const [article] = await db
    .select({ niveau: cuisineInventaire.niveau })
    .from(cuisineInventaire)
    .where(eq(cuisineInventaire.id, id))
    .limit(1);
  if (!article) return null;

  const suivant = CYCLE[article.niveau];
  await db
    .update(cuisineInventaire)
    .set({ niveau: suivant })
    .where(eq(cuisineInventaire.id, id));

  return suivant;
}

export async function changerCategorieStock(id: number, categorie: string): Promise<void> {
  if (!categorieValide(categorie)) return;
  await db
    .update(cuisineInventaire)
    .set({ categorie })
    .where(eq(cuisineInventaire.id, id));
}

export async function poserPeremption(id: number, date: string | null): Promise<void> {
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await db
    .update(cuisineInventaire)
    .set({ datePeremption: date })
    .where(eq(cuisineInventaire.id, id));
}

export async function retirerDuStock(id: number): Promise<void> {
  await db.delete(cuisineInventaire).where(eq(cuisineInventaire.id, id));
}

/* ─────────────────────────── Courses ─────────────────────────── */

export async function chargerCourses(): Promise<ArticleCourses[]> {
  return db
    .select()
    .from(cuisineCourses)
    .orderBy(
      asc(cuisineCourses.achete),
      asc(cuisineCourses.categorie),
      desc(cuisineCourses.id),
    );
}

export async function ajouterAuxCourses(
  nom: string,
  categorie?: string,
): Promise<number | null> {
  const propre = nom.trim().slice(0, 120);
  if (propre.length === 0) return null;

  const [ligne] = await db
    .insert(cuisineCourses)
    .values({
      nom: propre,
      categorie: categorie && categorieValide(categorie) ? categorie : deviner(propre),
      dateAjout: aujourdhui(),
    })
    .returning({ id: cuisineCourses.id });

  return ligne?.id ?? null;
}

export type BasculeCourse = { achete: boolean; verseAuStock: boolean };

/**
 * Coche ou décoche un article de la liste.
 *
 * Cocher « acheté » le verse dans l'inventaire à `beaucoup` : c'est le geste
 * qui tient l'inventaire à jour sans jamais avoir à le remplir. Un article
 * déjà présent sous le même nom n'est pas dupliqué — il repasse simplement à
 * `beaucoup`, ce qui est exactement ce que « j'en ai racheté » veut dire.
 *
 * Décocher ne retire rien de l'inventaire : ce serait défaire une course
 * réellement faite parce qu'on a mal visé.
 */
export async function cocherCourse(id: number, achete: boolean): Promise<BasculeCourse> {
  const [article] = await db
    .select()
    .from(cuisineCourses)
    .where(eq(cuisineCourses.id, id))
    .limit(1);
  if (!article) return { achete: false, verseAuStock: false };

  await db.update(cuisineCourses).set({ achete }).where(eq(cuisineCourses.id, id));
  if (!achete) return { achete, verseAuStock: false };

  const [existant] = await db
    .select({ id: cuisineInventaire.id })
    .from(cuisineInventaire)
    .where(sql`lower(${cuisineInventaire.nomLibre}) = lower(${article.nom})`)
    .limit(1);

  if (existant) {
    await db
      .update(cuisineInventaire)
      .set({ niveau: "beaucoup" })
      .where(eq(cuisineInventaire.id, existant.id));
  } else {
    await db.insert(cuisineInventaire).values({
      nomLibre: article.nom,
      categorie: article.categorie,
      niveau: "beaucoup",
      dateAjout: aujourdhui(),
    });
  }

  return { achete, verseAuStock: true };
}

export async function retirerDesCourses(id: number): Promise<void> {
  await db.delete(cuisineCourses).where(eq(cuisineCourses.id, id));
}

/** Vide ce qui a été acheté. La liste se recompose sans repartir de rien. */
export async function rangerCoursesFaites(): Promise<number> {
  const lignes = await db
    .delete(cuisineCourses)
    .where(eq(cuisineCourses.achete, true))
    .returning({ id: cuisineCourses.id });
  return lignes.length;
}

/* ─────────────────────────── Catalogue ─────────────────────────── */

export type EtatCatalogue = { total: number; ciqual: number; manuel: number };

/** De quoi dire à l'écran si le catalogue nutritionnel est déjà chargé. */
export async function etatCatalogue(): Promise<EtatCatalogue> {
  const [ligne] = await db
    .select({
      total: sql<number>`count(*)::int`,
      ciqual: sql<number>`count(*) filter (where ${cuisineAliments.source} = 'ciqual')::int`,
      manuel: sql<number>`count(*) filter (where ${cuisineAliments.source} = 'manuel')::int`,
    })
    .from(cuisineAliments);

  return {
    total: Number(ligne?.total ?? 0),
    ciqual: Number(ligne?.ciqual ?? 0),
    manuel: Number(ligne?.manuel ?? 0),
  };
}

/** Recherche dans le catalogue, pour relier un article à ses valeurs. */
export async function chercherAliments(requete: string, limite = 12) {
  const propre = requete.trim();
  if (propre.length < 2) return [];

  return db
    .select({
      id: cuisineAliments.id,
      nom: cuisineAliments.nom,
      etat: cuisineAliments.etat,
      source: cuisineAliments.source,
      kcal100g: cuisineAliments.kcal100g,
    })
    .from(cuisineAliments)
    .where(and(sql`lower(${cuisineAliments.nom}) like lower(${`%${propre}%`})`))
    .orderBy(sql`length(${cuisineAliments.nom})`)
    .limit(limite);
}

export { CATEGORIE_PAR_DEFAUT };
