"use server";

import { revalidatePath } from "next/cache";

import { ajouterAuxCourses } from "@/lib/cuisine/donnees";
import { consignerSuggestion, convertirEnRecette } from "@/lib/cuisine/suggestions";

/** Actions des suggestions. Ne revalident que les routes du module. */

export type Retour = { erreur?: string; message?: string; id?: number };

/** Ce qui manque part aux courses d'un tap, sans quitter l'écran. */
export async function actionManquantAuxCourses(
  nom: string,
  categorie: string,
): Promise<Retour> {
  const id = await ajouterAuxCourses(nom, categorie);
  if (id === null) return { erreur: "Il faut un nom." };
  revalidatePath("/cuisine/courses");
  revalidatePath("/cuisine");
  return { message: "Ajouté aux courses." };
}

/**
 * Marque une suggestion comme retenue.
 *
 * C'est ce qui alimente l'anti-répétition : une proposition retenue ne revient
 * pas les dix jours suivants. Elle n'est consignée qu'au moment où on s'en
 * saisit, pas à l'affichage — sinon ouvrir l'écran brûlerait toutes les idées
 * d'un coup.
 */
export async function actionRetenir(cle: string, libelle: string): Promise<Retour> {
  await consignerSuggestion(cle, libelle);
  revalidatePath("/cuisine/suggestions");
  return { message: "Notée. Elle ne reviendra pas avant dix jours." };
}

export async function actionConvertir(
  patronId: number,
  articleIds: number[],
  cle: string,
  libelle: string,
): Promise<Retour> {
  if (!Number.isInteger(patronId)) return { erreur: "Patron introuvable." };
  if (!articleIds.every((id) => Number.isInteger(id))) {
    return { erreur: "Articles invalides." };
  }

  const id = await convertirEnRecette(patronId, articleIds);
  if (id === null) return { erreur: "La conversion n'a pas abouti." };

  await consignerSuggestion(cle, libelle);
  revalidatePath("/cuisine/recettes");
  revalidatePath("/cuisine/suggestions");
  return { message: "Recette créée.", id };
}
