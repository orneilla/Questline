import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  cuisineAliments,
  cuisineRecetteIngredients,
  cuisineRecettes,
  type Recette,
  type RoleIngredient,
} from "@/db/cuisine";
import { aujourdhui } from "@/lib/dates";
import { calculer, cuissonValide, type BilanNutrition, type IngredientCalcul } from "./nutrition";

/**
 * Recettes et ingrédients.
 *
 * Comme le reste du module, ne touche que des tables `cuisine_`.
 */

export type ResumeRecette = Recette & {
  nbIngredients: number;
  /** Ingrédients dont le grammage n'a aucune fiche derrière lui. */
  nbSansFiche: number;
};

export async function chargerRecettes(): Promise<ResumeRecette[]> {
  const lignes = await db
    .select({
      recette: cuisineRecettes,
      nbIngredients: sql<number>`count(${cuisineRecetteIngredients.id})::int`,
      nbSansFiche: sql<number>`count(*) filter (
        where ${cuisineRecetteIngredients.id} is not null
          and ${cuisineRecetteIngredients.alimentId} is null)::int`,
    })
    .from(cuisineRecettes)
    .leftJoin(
      cuisineRecetteIngredients,
      eq(cuisineRecetteIngredients.recetteId, cuisineRecettes.id),
    )
    .groupBy(cuisineRecettes.id)
    .orderBy(desc(cuisineRecettes.derniereFois), desc(cuisineRecettes.id));

  return lignes.map((l) => ({
    ...l.recette,
    nbIngredients: Number(l.nbIngredients),
    nbSansFiche: Number(l.nbSansFiche),
  }));
}

export type DetailRecette = {
  recette: Recette;
  ingredients: IngredientCalcul[];
  bilan: BilanNutrition;
};

export async function chargerRecette(id: number): Promise<DetailRecette | null> {
  const [recette] = await db
    .select()
    .from(cuisineRecettes)
    .where(eq(cuisineRecettes.id, id))
    .limit(1);
  if (!recette) return null;

  const lignes = await db
    .select({
      ingredient: cuisineRecetteIngredients,
      aliment: cuisineAliments,
    })
    .from(cuisineRecetteIngredients)
    .leftJoin(
      cuisineAliments,
      eq(cuisineRecetteIngredients.alimentId, cuisineAliments.id),
    )
    .where(eq(cuisineRecetteIngredients.recetteId, id))
    .orderBy(asc(cuisineRecetteIngredients.ordre), asc(cuisineRecetteIngredients.id));

  const ingredients: IngredientCalcul[] = lignes.map(({ ingredient, aliment }) => ({
    id: ingredient.id,
    nomLibre: ingredient.nomLibre,
    quantiteG: ingredient.quantiteG,
    role: ingredient.role,
    categorieSubstitution: ingredient.categorieSubstitution,
    fiche: aliment
      ? {
          id: aliment.id,
          nom: aliment.nom,
          etat: aliment.etat,
          source: aliment.source,
          valeurs: {
            kcal100g: aliment.kcal100g,
            proteines100g: aliment.proteines100g,
            glucides100g: aliment.glucides100g,
            sucres100g: aliment.sucres100g,
            lipides100g: aliment.lipides100g,
            ags100g: aliment.ags100g,
            fibres100g: aliment.fibres100g,
            sel100g: aliment.sel100g,
          },
        }
      : null,
  }));

  return {
    recette,
    ingredients,
    bilan: calculer(ingredients, recette.nbPortions),
  };
}

/* ─────────────────────────── Écriture ─────────────────────────── */

export type SaisieRecette = {
  nom: string;
  instructions: string;
  tempsMinutes: number;
  modeCuisson: string;
  nbPortions: number;
  poidsTotalCuitG: number | null;
  jeReferai: boolean;
};

function propre(saisie: SaisieRecette): SaisieRecette {
  return {
    nom: saisie.nom.trim().slice(0, 160),
    instructions: saisie.instructions.slice(0, 20000),
    tempsMinutes: borner(saisie.tempsMinutes, 0, 1440),
    modeCuisson: cuissonValide(saisie.modeCuisson) ? saisie.modeCuisson : "poele",
    nbPortions: borner(saisie.nbPortions, 1, 50),
    poidsTotalCuitG:
      saisie.poidsTotalCuitG === null || !Number.isFinite(saisie.poidsTotalCuitG)
        ? null
        : Math.max(0, Math.min(50_000, saisie.poidsTotalCuitG)),
    jeReferai: saisie.jeReferai,
  };
}

function borner(valeur: number, min: number, max: number): number {
  if (!Number.isFinite(valeur)) return min;
  return Math.round(Math.min(max, Math.max(min, valeur)));
}

export async function creerRecette(saisie: SaisieRecette): Promise<number | null> {
  const valeurs = propre(saisie);
  if (valeurs.nom.length === 0) return null;

  const [ligne] = await db
    .insert(cuisineRecettes)
    .values({ ...valeurs, dateCreation: aujourdhui() })
    .returning({ id: cuisineRecettes.id });

  return ligne?.id ?? null;
}

export async function modifierRecette(
  id: number,
  saisie: SaisieRecette,
): Promise<boolean> {
  const valeurs = propre(saisie);
  if (valeurs.nom.length === 0) return false;

  const lignes = await db
    .update(cuisineRecettes)
    .set(valeurs)
    .where(eq(cuisineRecettes.id, id))
    .returning({ id: cuisineRecettes.id });

  return lignes.length > 0;
}

export async function supprimerRecette(id: number): Promise<boolean> {
  const lignes = await db
    .delete(cuisineRecettes)
    .where(eq(cuisineRecettes.id, id))
    .returning({ id: cuisineRecettes.id });
  return lignes.length > 0;
}

/** Une fois cuisinée : le compteur avance, la date suit. */
export async function marquerCuisinee(id: number): Promise<void> {
  await db
    .update(cuisineRecettes)
    .set({
      nbFoisCuisinee: sql`${cuisineRecettes.nbFoisCuisinee} + 1`,
      derniereFois: aujourdhui(),
    })
    .where(eq(cuisineRecettes.id, id));
}

/**
 * Duplique une recette avec tous ses grammages.
 *
 * C'est le chemin principal, pas une commodité : refaire un plat en changeant
 * deux lignes est le geste courant, et resaisir douze ingrédients pour ça ne
 * se ferait jamais. La copie repart à zéro fois cuisinée — c'est une autre
 * version, pas la même.
 */
export async function dupliquerRecette(id: number): Promise<number | null> {
  const [source] = await db
    .select()
    .from(cuisineRecettes)
    .where(eq(cuisineRecettes.id, id))
    .limit(1);
  if (!source) return null;

  const [copie] = await db
    .insert(cuisineRecettes)
    .values({
      nom: `${source.nom} (2)`.slice(0, 160),
      instructions: source.instructions,
      tempsMinutes: source.tempsMinutes,
      modeCuisson: source.modeCuisson,
      nbPortions: source.nbPortions,
      poidsTotalCuitG: source.poidsTotalCuitG,
      jeReferai: source.jeReferai,
      dateCreation: aujourdhui(),
    })
    .returning({ id: cuisineRecettes.id });
  if (!copie) return null;

  const ingredients = await db
    .select()
    .from(cuisineRecetteIngredients)
    .where(eq(cuisineRecetteIngredients.recetteId, id));

  if (ingredients.length > 0) {
    await db.insert(cuisineRecetteIngredients).values(
      ingredients.map((i) => ({
        recetteId: copie.id,
        alimentId: i.alimentId,
        nomLibre: i.nomLibre,
        quantiteG: i.quantiteG,
        role: i.role,
        categorieSubstitution: i.categorieSubstitution,
        ordre: i.ordre,
      })),
    );
  }

  return copie.id;
}

/* ─────────────────────────── Ingrédients ─────────────────────────── */

export type SaisieIngredient = {
  nomLibre: string;
  alimentId: number | null;
  quantiteG: number;
  role: RoleIngredient;
  categorieSubstitution: string | null;
};

export async function ajouterIngredient(
  recetteId: number,
  saisie: SaisieIngredient,
): Promise<number | null> {
  const nom = saisie.nomLibre.trim().slice(0, 160);
  if (nom.length === 0) return null;

  const [dernier] = await db
    .select({ ordre: sql<number>`coalesce(max(${cuisineRecetteIngredients.ordre}), 0)::int` })
    .from(cuisineRecetteIngredients)
    .where(eq(cuisineRecetteIngredients.recetteId, recetteId));

  const [ligne] = await db
    .insert(cuisineRecetteIngredients)
    .values({
      recetteId,
      alimentId: saisie.alimentId,
      nomLibre: nom,
      quantiteG: Math.max(0, Math.min(50_000, saisie.quantiteG || 0)),
      role: saisie.role,
      categorieSubstitution: saisie.categorieSubstitution,
      ordre: Number(dernier?.ordre ?? 0) + 1,
    })
    .returning({ id: cuisineRecetteIngredients.id });

  return ligne?.id ?? null;
}

export async function modifierIngredient(
  id: number,
  saisie: Partial<SaisieIngredient>,
): Promise<void> {
  const valeurs: Record<string, unknown> = {};
  if (saisie.nomLibre !== undefined) {
    const nom = saisie.nomLibre.trim().slice(0, 160);
    if (nom.length === 0) return;
    valeurs.nomLibre = nom;
  }
  if (saisie.alimentId !== undefined) valeurs.alimentId = saisie.alimentId;
  if (saisie.quantiteG !== undefined) {
    valeurs.quantiteG = Math.max(0, Math.min(50_000, saisie.quantiteG || 0));
  }
  if (saisie.role !== undefined) valeurs.role = saisie.role;
  if (saisie.categorieSubstitution !== undefined) {
    valeurs.categorieSubstitution = saisie.categorieSubstitution;
  }
  if (Object.keys(valeurs).length === 0) return;

  await db
    .update(cuisineRecetteIngredients)
    .set(valeurs)
    .where(eq(cuisineRecetteIngredients.id, id));
}

export async function retirerIngredient(id: number): Promise<void> {
  await db.delete(cuisineRecetteIngredients).where(eq(cuisineRecetteIngredients.id, id));
}
