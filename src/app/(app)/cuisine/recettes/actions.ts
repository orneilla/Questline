"use server";

import { revalidatePath } from "next/cache";

import {
  ajouterIngredient,
  creerRecette,
  dupliquerRecette,
  marquerCuisinee,
  modifierIngredient,
  modifierRecette,
  retirerIngredient,
  supprimerRecette,
  type SaisieIngredient,
  type SaisieRecette,
} from "@/lib/cuisine/recettes";
import { chercherAliments } from "@/lib/cuisine/donnees";
import type { RoleIngredient } from "@/db/cuisine";

/** Actions des recettes. Elles ne revalident que les routes du module. */

export type Retour = { erreur?: string; message?: string; id?: number };

const ROLES: RoleIngredient[] = ["essentiel", "optionnel", "substituable"];

function rafraichir(id?: number) {
  revalidatePath("/cuisine/recettes");
  if (id !== undefined) revalidatePath(`/cuisine/recettes/${id}`);
}

export async function actionCreerRecette(saisie: SaisieRecette): Promise<Retour> {
  const id = await creerRecette(saisie);
  if (id === null) return { erreur: "Une recette a besoin d'un nom." };
  rafraichir(id);
  return { message: "Recette créée.", id };
}

export async function actionModifierRecette(
  id: number,
  saisie: SaisieRecette,
): Promise<Retour> {
  if (!Number.isInteger(id)) return { erreur: "Recette introuvable." };
  if (!(await modifierRecette(id, saisie))) {
    return { erreur: "Une recette a besoin d'un nom." };
  }
  rafraichir(id);
  return { message: "Enregistré." };
}

export async function actionSupprimerRecette(id: number): Promise<Retour> {
  if (!Number.isInteger(id)) return { erreur: "Recette introuvable." };
  if (!(await supprimerRecette(id))) return { erreur: "Cette recette n'existe plus." };
  rafraichir(id);
  return { message: "Recette supprimée." };
}

export async function actionCuisinee(id: number): Promise<void> {
  if (!Number.isInteger(id)) return;
  await marquerCuisinee(id);
  rafraichir(id);
}

/** « Refaire cette recette » : la copie avec ses grammages, prête à ajuster. */
export async function actionDupliquer(id: number): Promise<Retour> {
  if (!Number.isInteger(id)) return { erreur: "Recette introuvable." };
  const copie = await dupliquerRecette(id);
  if (copie === null) return { erreur: "Cette recette n'existe plus." };
  rafraichir(copie);
  return { message: "Copie créée.", id: copie };
}

/* ─────────────────────────── Ingrédients ─────────────────────────── */

export async function actionAjouterIngredient(
  recetteId: number,
  saisie: SaisieIngredient,
): Promise<Retour> {
  if (!Number.isInteger(recetteId)) return { erreur: "Recette introuvable." };
  if (!ROLES.includes(saisie.role)) return { erreur: "Rôle inconnu." };

  const id = await ajouterIngredient(recetteId, saisie);
  if (id === null) return { erreur: "Il faut un nom d'ingrédient." };
  rafraichir(recetteId);
  return { message: "Ajouté." };
}

export async function actionModifierIngredient(
  recetteId: number,
  id: number,
  saisie: Partial<SaisieIngredient>,
): Promise<void> {
  if (!Number.isInteger(id)) return;
  if (saisie.role !== undefined && !ROLES.includes(saisie.role)) return;
  await modifierIngredient(id, saisie);
  rafraichir(recetteId);
}

export async function actionRetirerIngredient(
  recetteId: number,
  id: number,
): Promise<void> {
  if (!Number.isInteger(id)) return;
  await retirerIngredient(id);
  rafraichir(recetteId);
}

/** Recherche dans le catalogue, pour relier un ingrédient à ses valeurs. */
export async function actionChercherAliment(requete: string) {
  return chercherAliments(requete);
}
