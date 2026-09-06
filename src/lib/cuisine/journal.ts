import "server-only";

import { and, asc, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  cuisineAliments,
  cuisineJournal,
  cuisineRecettes,
  type LigneJournal,
  type PrecisionSaisie,
  type Repas,
} from "@/db/cuisine";
import { aujourdhui, decalerJours, jourDeLaSemaine } from "@/lib/dates";
import type { NutrimentCle } from "./ciqual";
import { calculer, portionPesee, type Totaux } from "./nutrition";
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
 * L'agrégation est ailleurs, dans `tendances.ts`, pure et relisible sans base.
 * Ici on ne fait que charger, et surtout : figer. Chaque entrée emporte ses
 * valeurs nutritionnelles au moment de la saisie, parce qu'une recette
 * corrigée la semaine suivante ne doit pas réécrire ce qui a déjà été mangé.
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
    complet: ligne.complet,
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
    recetteId: ligne.recetteId,
    alimentId: ligne.alimentId,
    poidsG: ligne.poidsPortionG ?? ligne.quantiteG,
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

export async function chargerJour(date: string): Promise<EntreeJournal[]> {
  const lignes = await db
    .select()
    .from(cuisineJournal)
    .where(eq(cuisineJournal.date, date))
    .orderBy(asc(cuisineJournal.id));

  return lignes.map(enEntree);
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
function enColonnes(valeurs: Totaux): Partial<Record<string, number | null>> {
  const sortie: Record<string, number | null> = {};
  for (const [cle, colonne] of Object.entries(COLONNES)) {
    const valeur = valeurs[cle as NutrimentCle];
    sortie[colonne] = valeur === undefined ? null : valeur;
  }
  return sortie;
}

export type Consignation =
  | { issue: "fait"; id: number; precision: PrecisionSaisie; theorique: boolean }
  | { issue: "introuvable" };

/**
 * Note une part de recette.
 *
 * Deux façons d'obtenir la part, et elles ne se valent pas. Si le plat fini a
 * été pesé une fois et qu'on donne le poids de l'assiette, le rapport des deux
 * donne la part réelle. Sinon on retombe sur la portion théorique — le total
 * divisé par le nombre de parts — qui ne dit rien de ce qu'il y a vraiment
 * dans l'assiette.
 *
 * Dans ce second cas l'entrée est forcément `estime`, quoi qu'on ait demandé :
 * enregistrer « pesé » sur un chiffre théorique rendrait la distinction
 * inutile, et c'est elle qui fait la valeur du journal.
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

  const pesee =
    saisie.poidsAssietteG !== null
      ? portionPesee(
          detail.bilan.total,
          detail.recette.poidsTotalCuitG,
          saisie.poidsAssietteG,
        )
      : null;

  const valeurs = pesee ? pesee.valeurs : detail.bilan.parPortion;
  const precision: PrecisionSaisie = pesee ? saisie.precision : "estime";

  const [cree] = await db
    .insert(cuisineJournal)
    .values({
      date: saisie.date,
      repas: saisie.repas,
      recetteId: detail.recette.id,
      libelle: detail.recette.nom,
      poidsPortionG: pesee ? saisie.poidsAssietteG : null,
      precision,
      complet: detail.bilan.sansFiche.length === 0,
      ...enColonnes(valeurs),
      dateSaisie: aujourdhui(),
    })
    .returning({ id: cuisineJournal.id });

  if (!cree) return { issue: "introuvable" };
  return { issue: "fait", id: cree.id, precision, theorique: pesee === null };
}

/** Note un aliment seul, en grammes. */
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

  // Le même calcul que pour une recette, sur un seul ingrédient : une part
  // d'aliment n'est rien d'autre qu'une recette à une ligne.
  const bilan = calculer(
    [
      {
        id: aliment.id,
        nomLibre: aliment.nom,
        quantiteG: saisie.quantiteG,
        role: "essentiel",
        categorieSubstitution: null,
        fiche: {
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
        },
      },
    ],
    1,
  );

  const [cree] = await db
    .insert(cuisineJournal)
    .values({
      date: saisie.date,
      repas: saisie.repas,
      alimentId: aliment.id,
      libelle: aliment.nom,
      quantiteG: saisie.quantiteG,
      precision: saisie.precision,
      complet: true,
      ...enColonnes(bilan.total),
      dateSaisie: aujourdhui(),
    })
    .returning({ id: cuisineJournal.id });

  if (!cree) return { issue: "introuvable" };
  return { issue: "fait", id: cree.id, precision: saisie.precision, theorique: false };
}

export async function retirerEntree(id: number): Promise<boolean> {
  const partis = await db
    .delete(cuisineJournal)
    .where(eq(cuisineJournal.id, id))
    .returning({ id: cuisineJournal.id });

  return partis.length > 0;
}
