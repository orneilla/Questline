import "server-only";

import { and, asc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  cuisineInventaire,
  cuisinePatrons,
  cuisineRecetteIngredients,
  cuisineRecettes,
  cuisineSuggestions,
  type Recette,
} from "@/db/cuisine";
import { aujourdhui, decalerJours } from "@/lib/dates";
import { CATEGORIES } from "./categories";
import {
  combiner,
  ecarterRecent,
  noter,
  FENETRE_ANTI_REPETITION_JOURS,
  type ArticleDispo,
  type Combinaison,
  type EtatIngredient,
  type IngredientAttendu,
  type PatronSimple,
} from "./moteur";

/**
 * Les suggestions, lues en base et calculées par le moteur.
 *
 * Ce module ne fait qu'assembler : toute la décision est dans `moteur.ts`, qui
 * est pur et se relit sans base. On peut ainsi vérifier une proposition sans
 * avoir à rejouer un état.
 */

export type SuggestionRecette = {
  cle: string;
  recette: Recette;
  etats: EtatIngredient[];
  manquants: EtatIngredient[];
  nbManquants: number;
  penalite: number;
};

export type SuggestionPatron = Combinaison;

export type Propositions = {
  recettes: SuggestionRecette[];
  patrons: SuggestionPatron[];
  /** Vrai quand tout avait déjà été proposé : on répète, et on le dit. */
  repetitionAssumee: boolean;
  /** Articles utilisables aujourd'hui : ce sur quoi tout est calculé. */
  nbDisponibles: number;
};

/** L'inventaire tel que le moteur le voit. Exporté : l'écran des patrons le
 * confronte aux mêmes règles pour dire lesquels tiennent aujourd'hui. */
export async function chargerInventaireDispo(): Promise<ArticleDispo[]> {
  const lignes = await db
    .select({
      id: cuisineInventaire.id,
      nom: cuisineInventaire.nomLibre,
      categorie: cuisineInventaire.categorie,
      niveau: cuisineInventaire.niveau,
      alimentId: cuisineInventaire.alimentId,
    })
    .from(cuisineInventaire)
    .orderBy(asc(cuisineInventaire.id));

  return lignes.map((l) => ({
    id: l.id,
    nom: l.nom,
    categorie: l.categorie,
    alimentId: l.alimentId,
    disponible: l.niveau !== "epuise",
  }));
}

/** Ce qui a été proposé ou cuisiné dans la fenêtre : à ne pas resservir. */
async function clesRecentes(date: string): Promise<Set<string>> {
  const depuis = decalerJours(date, -FENETRE_ANTI_REPETITION_JOURS);

  const [proposees, cuisinees] = await Promise.all([
    db
      .select({ cle: cuisineSuggestions.cle })
      .from(cuisineSuggestions)
      .where(gte(cuisineSuggestions.date, depuis)),
    db
      .select({ id: cuisineRecettes.id })
      .from(cuisineRecettes)
      .where(gte(cuisineRecettes.derniereFois, depuis)),
  ]);

  const cles = new Set(proposees.map((p) => p.cle));
  for (const r of cuisinees) cles.add(`recette:${r.id}`);
  return cles;
}

export async function calculerPropositions(date = aujourdhui()): Promise<Propositions> {
  const [inventaire, recettes, patrons, recentes] = await Promise.all([
    chargerInventaireDispo(),
    chargerRecettesAvecIngredients(),
    chargerPatrons(),
    clesRecentes(date),
  ]);

  // ── A. Les recettes existantes, confrontées au placard
  const notees: SuggestionRecette[] = [];
  for (const { recette, ingredients } of recettes) {
    if (ingredients.length === 0) continue;
    const score = noter(ingredients, inventaire);
    if (!score.faisable) continue;

    notees.push({
      cle: `recette:${recette.id}`,
      recette,
      etats: score.etats,
      manquants: score.manquants,
      nbManquants: score.nbManquants,
      penalite: score.penalite,
    });
  }

  notees.sort(
    (a, b) => a.nbManquants - b.nbManquants || a.penalite - b.penalite || a.recette.id - b.recette.id,
  );

  // ── B. Les patrons, croisés avec le même placard
  const combinaisons = combiner(
    patrons,
    inventaire,
    CATEGORIES.map((c) => c.cle),
  );

  const tri = ecarterRecent(notees, recentes);
  const triPatrons = ecarterRecent(combinaisons, recentes);

  return {
    recettes: tri.retenues,
    patrons: triPatrons.retenues,
    repetitionAssumee: tri.toutesRecentes || triPatrons.toutesRecentes,
    nbDisponibles: inventaire.filter((a) => a.disponible).length,
  };
}

async function chargerRecettesAvecIngredients(): Promise<
  { recette: Recette; ingredients: IngredientAttendu[] }[]
> {
  const [recettes, ingredients] = await Promise.all([
    db.select().from(cuisineRecettes).where(eq(cuisineRecettes.jeReferai, true)),
    db
      .select({
        id: cuisineRecetteIngredients.id,
        recetteId: cuisineRecetteIngredients.recetteId,
        nomLibre: cuisineRecetteIngredients.nomLibre,
        alimentId: cuisineRecetteIngredients.alimentId,
        role: cuisineRecetteIngredients.role,
        categorieSubstitution: cuisineRecetteIngredients.categorieSubstitution,
        quantiteG: cuisineRecetteIngredients.quantiteG,
      })
      .from(cuisineRecetteIngredients)
      .orderBy(asc(cuisineRecetteIngredients.ordre)),
  ]);

  return recettes.map((recette) => ({
    recette,
    ingredients: ingredients
      .filter((i) => i.recetteId === recette.id)
      .map(({ recetteId: _ignore, ...reste }) => reste),
  }));
}

export async function chargerPatrons(actifsSeulement = true): Promise<PatronSimple[]> {
  const lignes = await db
    .select()
    .from(cuisinePatrons)
    .where(actifsSeulement ? eq(cuisinePatrons.actif, true) : undefined)
    .orderBy(asc(cuisinePatrons.ordre), asc(cuisinePatrons.id));

  return lignes.map((l) => ({
    id: l.id,
    nom: l.nom,
    categories: l.categories,
    profil: l.profil,
    modeCuisson: l.modeCuisson,
    exclut: l.exclut,
  }));
}

/* ────────────────────── Écriture ────────────────────── */

/** Consigne qu'une suggestion a été proposée. Une fois par jour et par clé. */
export async function consignerSuggestion(cle: string, libelle: string): Promise<void> {
  const date = aujourdhui();
  const [deja] = await db
    .select({ id: cuisineSuggestions.id })
    .from(cuisineSuggestions)
    .where(and(eq(cuisineSuggestions.cle, cle), eq(cuisineSuggestions.date, date)))
    .limit(1);
  if (deja) return;

  await db.insert(cuisineSuggestions).values({ cle, date, libelle: libelle.slice(0, 200) });
}

/**
 * Transforme une combinaison en recette à compléter.
 *
 * Les articles deviennent des ingrédients à zéro gramme : le patron dit quoi
 * associer, pas en quelle quantité. Les grammages se pèsent en cuisinant, et
 * inventer un chiffre plausible ici reviendrait à salir la base avec des
 * valeurs que rien ne fonde.
 */
export async function convertirEnRecette(
  patronId: number,
  articleIds: number[],
): Promise<number | null> {
  const [patron] = await db
    .select()
    .from(cuisinePatrons)
    .where(eq(cuisinePatrons.id, patronId))
    .limit(1);
  if (!patron) return null;

  const articles = await db
    .select()
    .from(cuisineInventaire)
    .where(
      sql`${cuisineInventaire.id} in ${
        articleIds.length > 0 ? articleIds : [-1]
      }`,
    );
  if (articles.length === 0) return null;

  const ordonnes = articleIds
    .map((id) => articles.find((a) => a.id === id))
    .filter((a): a is (typeof articles)[number] => a !== undefined);

  const [recette] = await db
    .insert(cuisineRecettes)
    .values({
      nom: `${patron.nom} — ${ordonnes.map((a) => a.nomLibre).join(", ")}`.slice(0, 160),
      instructions: "",
      tempsMinutes: 0,
      modeCuisson: patron.modeCuisson,
      nbPortions: 2,
      dateCreation: aujourdhui(),
    })
    .returning({ id: cuisineRecettes.id });
  if (!recette) return null;

  await db.insert(cuisineRecetteIngredients).values(
    ordonnes.map((article, rang) => ({
      recetteId: recette.id,
      alimentId: article.alimentId,
      nomLibre: article.nomLibre,
      quantiteG: 0,
      role: "essentiel" as const,
      categorieSubstitution: article.categorie,
      ordre: rang + 1,
    })),
  );

  return recette.id;
}
