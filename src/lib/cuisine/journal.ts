import "server-only";

import { and, asc, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  cuisineAliments,
  cuisineJournal,
  cuisineRecettes,
  type IngredientFige,
  type LigneJournal,
  type PrecisionSaisie,
  type Repas,
} from "@/db/cuisine";
import { aujourdhui, decalerJours, jourDeLaSemaine } from "@/lib/dates";
import type { NutrimentCle } from "./ciqual";
import { figer, recalculer, sansFiche, type Instantane, type Recalcul } from "./instantane";
import { type Totaux } from "./nutrition";
import { chargerRecette } from "./recettes";
import {
  assemblerSemaine,
  sommerJour,
  type EntreeJournal,
  type Jour,
  type Semaine,
} from "./tendances";

/**
 * Le journal des repas — lecture et écriture.
 *
 * L'agrégation est dans `tendances.ts` et le calcul dans `instantane.ts`, tous
 * deux purs et relisibles sans base. Ici on charge, on fige, et on rejoue.
 *
 * Deux principes se tiennent ensemble et ne se contredisent pas. La
 * propagation est figée : corriger une recette ou une fiche ne touche à aucune
 * entrée déjà notée. L'édition, elle, reste ouverte : une entrée se corrige,
 * et le recalcul se fait sur son propre instantané, sans jamais reconsulter
 * quoi que ce soit d'extérieur. Rejoindre l'état actuel d'une recette reste
 * possible, mais c'est un geste explicite — la resynchronisation.
 */

/** Les colonnes du journal, dans le vocabulaire des nutriments. */
const COLONNES: Record<NutrimentCle, keyof LigneJournal> = {
  kcal100g: "kcal",
  proteines100g: "proteines",
  glucides100g: "glucides",
  sucres100g: "sucres",
  lipides100g: "lipides",
  ags100g: "ags",
  fibres100g: "fibres",
  sel100g: "sel",
};

function enEntree(ligne: LigneJournal): EntreeJournal {
  return {
    id: ligne.id,
    date: ligne.date,
    repas: ligne.repas,
    libelle: ligne.libelle,
    precision: ligne.precision,
    valeurs: {
      kcal100g: ligne.kcal,
      proteines100g: ligne.proteines,
      glucides100g: ligne.glucides,
      sucres100g: ligne.sucres,
      lipides100g: ligne.lipides,
      ags100g: ligne.ags,
      fibres100g: ligne.fibres,
      sel100g: ligne.sel,
    },
    couverture: ligne.couverture,
    sansFiche: sansFiche(ligne.ingredients),
    poidsRetenuG: ligne.poidsRetenuG,
    origine: ligne.origine === "aliment" ? "aliment" : "recette",
    recetteId: ligne.recetteId,
    alimentId: ligne.alimentId,
    poidsAssietteG: ligne.poidsPortionG,
    quantiteG: ligne.quantiteG,
    poidsTotalCuitG: ligne.poidsTotalCuitG,
    nbPortions: ligne.nbPortions,
    dateModification: ligne.dateModification,
  };
}

/** Le lundi de la semaine d'une date. La semaine commence le lundi. */
export function debutSemaine(date: string): string {
  const jour = jourDeLaSemaine(date); // 0 = dimanche
  return decalerJours(date, -((jour + 6) % 7));
}

export async function chargerSemaine(debut: string): Promise<Semaine> {
  const fin = decalerJours(debut, 6);

  const lignes = await db
    .select()
    .from(cuisineJournal)
    .where(and(gte(cuisineJournal.date, debut), lte(cuisineJournal.date, fin)))
    .orderBy(asc(cuisineJournal.date), asc(cuisineJournal.id));

  const entrees = lignes.map(enEntree);

  const jours: Jour[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = decalerJours(debut, i);
    jours.push(sommerJour(date, entrees.filter((e) => e.date === date)));
  }

  return assemblerSemaine(debut, jours);
}

/** Ce qu'on peut noter d'un tap : les recettes récemment cuisinées. */
export type RecetteNotable = {
  id: number;
  nom: string;
  nbPortions: number;
  poidsTotalCuitG: number | null;
};

export async function recettesNotables(limite = 30): Promise<RecetteNotable[]> {
  return db
    .select({
      id: cuisineRecettes.id,
      nom: cuisineRecettes.nom,
      nbPortions: cuisineRecettes.nbPortions,
      poidsTotalCuitG: cuisineRecettes.poidsTotalCuitG,
    })
    .from(cuisineRecettes)
    .orderBy(desc(cuisineRecettes.derniereFois), desc(cuisineRecettes.id))
    .limit(limite);
}

/* ────────────────────── Écriture ────────────────────── */

/** Les valeurs, rangées dans les colonnes du journal. */
function enColonnes(valeurs: Totaux): Record<string, number | null> {
  const sortie: Record<string, number | null> = {};
  for (const [cle, colonne] of Object.entries(COLONNES)) {
    const valeur = valeurs[cle as NutrimentCle];
    sortie[colonne] = valeur === undefined ? null : valeur;
  }
  return sortie;
}

/** Ce qu'un recalcul dépose dans la ligne, quel que soit le chemin d'écriture. */
function enLigne(resultat: Recalcul) {
  return {
    precision: resultat.precision,
    complet: resultat.sansFiche.length === 0,
    couverture: resultat.couverture,
    poidsRetenuG: resultat.poidsRetenuG,
    ...enColonnes(resultat.valeurs),
  };
}

export type Consignation =
  | { issue: "fait"; id: number; precision: PrecisionSaisie; theorique: boolean }
  | { issue: "introuvable" };

/**
 * Note une part de recette.
 *
 * L'instantané est pris ici, une fois : chaque ingrédient avec son grammage et
 * ses teneurs pour 100 g. La recette peut ensuite changer autant qu'elle veut,
 * cette entrée ne bougera plus — et pourra pourtant se recalculer seule si le
 * poids de l'assiette est corrigé.
 */
export async function noterRecette(saisie: {
  date: string;
  repas: Repas;
  recetteId: number;
  poidsAssietteG: number | null;
  precision: PrecisionSaisie;
}): Promise<Consignation> {
  const detail = await chargerRecette(saisie.recetteId);
  if (!detail) return { issue: "introuvable" };

  const instantane: Instantane = {
    origine: "recette",
    ingredients: figer(detail.ingredients),
    nbPortions: detail.recette.nbPortions,
    poidsTotalCuitG: detail.recette.poidsTotalCuitG,
  };

  const resultat = recalculer(instantane, {
    poidsAssietteG: saisie.poidsAssietteG,
    precision: saisie.precision,
  });

  const [cree] = await db
    .insert(cuisineJournal)
    .values({
      date: saisie.date,
      repas: saisie.repas,
      recetteId: detail.recette.id,
      libelle: detail.recette.nom,
      poidsPortionG: resultat.theorique ? null : saisie.poidsAssietteG,
      origine: "recette",
      ingredients: instantane.ingredients,
      nbPortions: instantane.nbPortions,
      poidsTotalCuitG: instantane.poidsTotalCuitG,
      dateSaisie: aujourdhui(),
      ...enLigne(resultat),
    })
    .returning({ id: cuisineJournal.id });

  if (!cree) return { issue: "introuvable" };
  return {
    issue: "fait",
    id: cree.id,
    precision: resultat.precision,
    theorique: resultat.theorique,
  };
}

/** L'instantané d'un aliment seul : une seule ligne, ses teneurs d'alors. */
function figerAliment(
  aliment: typeof cuisineAliments.$inferSelect,
  quantiteG: number,
): IngredientFige {
  return {
    alimentId: aliment.id,
    nom: aliment.nom,
    source: aliment.source,
    quantiteG,
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
  };
}

/**
 * Note un aliment seul, en grammes.
 *
 * Sa précision est celle qu'on déclare, sans condition : peser 100 g de riz
 * cru à la balance ne demande ni assiette ni poids total cuit. La règle du
 * rapport ne concerne que les parts de recette.
 */
export async function noterAliment(saisie: {
  date: string;
  repas: Repas;
  alimentId: number;
  quantiteG: number;
  precision: PrecisionSaisie;
}): Promise<Consignation> {
  const [aliment] = await db
    .select()
    .from(cuisineAliments)
    .where(eq(cuisineAliments.id, saisie.alimentId))
    .limit(1);
  if (!aliment) return { issue: "introuvable" };

  const instantane: Instantane = {
    origine: "aliment",
    ingredients: [figerAliment(aliment, saisie.quantiteG)],
    nbPortions: 1,
    poidsTotalCuitG: null,
  };

  const resultat = recalculer(instantane, {
    poidsAssietteG: null,
    precision: saisie.precision,
  });

  const [cree] = await db
    .insert(cuisineJournal)
    .values({
      date: saisie.date,
      repas: saisie.repas,
      alimentId: aliment.id,
      libelle: aliment.nom,
      quantiteG: saisie.quantiteG,
      origine: "aliment",
      ingredients: instantane.ingredients,
      nbPortions: 1,
      poidsTotalCuitG: null,
      dateSaisie: aujourdhui(),
      ...enLigne(resultat),
    })
    .returning({ id: cuisineJournal.id });

  if (!cree) return { issue: "introuvable" };
  return { issue: "fait", id: cree.id, precision: resultat.precision, theorique: false };
}

/* ────────────────────── Correction ────────────────────── */

/** Reconstitue l'instantané d'une ligne. Rien n'est lu au-dehors. */
function instantaneDe(ligne: LigneJournal): Instantane {
  return {
    origine: ligne.origine === "aliment" ? "aliment" : "recette",
    ingredients: ligne.ingredients,
    nbPortions: ligne.nbPortions,
    poidsTotalCuitG: ligne.poidsTotalCuitG,
  };
}

export type CorrectionEntree = {
  date?: string;
  repas?: Repas;
  precision?: PrecisionSaisie;
  /** Recette : le poids de l'assiette. Null pour revenir à la part théorique. */
  poidsAssietteG?: number | null;
  /** Aliment seul : le grammage. */
  quantiteG?: number;
};

export type Correction =
  | { issue: "fait"; precision: PrecisionSaisie; theorique: boolean }
  | { issue: "introuvable" }
  | { issue: "sans-instantane" };

/**
 * Corrige une entrée, sans jamais sortir de son instantané.
 *
 * Changer un grammage rejoue le même calcul sur les mêmes teneurs figées : ce
 * n'est pas une resynchronisation déguisée. La date de modification est posée
 * pour que l'écran puisse le dire.
 */
export async function corrigerEntree(
  id: number,
  correction: CorrectionEntree,
): Promise<Correction> {
  const [ligne] = await db
    .select()
    .from(cuisineJournal)
    .where(eq(cuisineJournal.id, id))
    .limit(1);
  if (!ligne) return { issue: "introuvable" };

  const instantane = instantaneDe(ligne);

  const touchePasAuxChiffres =
    correction.poidsAssietteG === undefined &&
    correction.quantiteG === undefined &&
    correction.precision === undefined;

  // Une entrée écrite avant que l'instantané ne descende à l'ingrédient n'a
  // rien à rejouer : recalculer sur une liste vide remettrait tous ses
  // nutriments à zéro. On la déplace volontiers, on ne la recalcule pas.
  if (instantane.ingredients.length === 0) {
    if (!touchePasAuxChiffres) return { issue: "sans-instantane" };

    await db
      .update(cuisineJournal)
      .set({
        date: correction.date ?? ligne.date,
        repas: correction.repas ?? ligne.repas,
        dateModification: aujourdhui(),
      })
      .where(eq(cuisineJournal.id, id));

    return { issue: "fait", precision: ligne.precision, theorique: false };
  }

  // Sur un aliment seul, le grammage est l'ingrédient : le corriger, c'est
  // corriger l'instantané lui-même, teneurs pour 100 g inchangées.
  const quantite = correction.quantiteG;
  if (instantane.origine === "aliment" && quantite !== undefined) {
    instantane.ingredients = instantane.ingredients.map((i) => ({
      ...i,
      quantiteG: quantite,
    }));
  }

  const poidsAssiette =
    correction.poidsAssietteG !== undefined
      ? correction.poidsAssietteG
      : ligne.poidsPortionG;

  const resultat = recalculer(instantane, {
    poidsAssietteG: poidsAssiette,
    precision: correction.precision ?? ligne.precision,
  });

  await db
    .update(cuisineJournal)
    .set({
      date: correction.date ?? ligne.date,
      repas: correction.repas ?? ligne.repas,
      ingredients: instantane.ingredients,
      quantiteG:
        instantane.origine === "aliment"
          ? (quantite ?? ligne.quantiteG)
          : ligne.quantiteG,
      poidsPortionG:
        instantane.origine === "recette"
          ? (resultat.theorique ? null : poidsAssiette)
          : ligne.poidsPortionG,
      dateModification: aujourdhui(),
      ...enLigne(resultat),
    })
    .where(eq(cuisineJournal.id, id));

  return { issue: "fait", precision: resultat.precision, theorique: resultat.theorique };
}

export type Resynchronisation =
  | { issue: "fait"; precision: PrecisionSaisie; theorique: boolean }
  | { issue: "introuvable" }
  | { issue: "sans-recette" }
  | { issue: "recette-supprimee" };

/**
 * Refait l'instantané depuis l'état actuel de la recette.
 *
 * C'est l'équivalent d'une suppression suivie d'une ressaisie, en un geste.
 * Rien ici ne contredit le principe du figé : la propagation reste interdite,
 * mais la décision de rejoindre l'état courant appartient à qui tient le
 * journal, et elle se prend entrée par entrée.
 */
export async function resynchroniserEntree(id: number): Promise<Resynchronisation> {
  const [ligne] = await db
    .select()
    .from(cuisineJournal)
    .where(eq(cuisineJournal.id, id))
    .limit(1);
  if (!ligne) return { issue: "introuvable" };
  if (ligne.recetteId === null) return { issue: "sans-recette" };

  const detail = await chargerRecette(ligne.recetteId);
  if (!detail) return { issue: "recette-supprimee" };

  const instantane: Instantane = {
    origine: "recette",
    ingredients: figer(detail.ingredients),
    nbPortions: detail.recette.nbPortions,
    poidsTotalCuitG: detail.recette.poidsTotalCuitG,
  };

  const resultat = recalculer(instantane, {
    poidsAssietteG: ligne.poidsPortionG,
    precision: ligne.precision,
  });

  await db
    .update(cuisineJournal)
    .set({
      libelle: detail.recette.nom,
      ingredients: instantane.ingredients,
      nbPortions: instantane.nbPortions,
      poidsTotalCuitG: instantane.poidsTotalCuitG,
      poidsPortionG: resultat.theorique ? null : ligne.poidsPortionG,
      dateModification: aujourdhui(),
      ...enLigne(resultat),
    })
    .where(eq(cuisineJournal.id, id));

  return { issue: "fait", precision: resultat.precision, theorique: resultat.theorique };
}

export async function retirerEntree(id: number): Promise<boolean> {
  const partis = await db
    .delete(cuisineJournal)
    .where(eq(cuisineJournal.id, id))
    .returning({ id: cuisineJournal.id });

  return partis.length > 0;
}
