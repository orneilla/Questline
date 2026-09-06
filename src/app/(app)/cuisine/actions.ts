"use server";

import { revalidatePath } from "next/cache";

import {
  ajouterAuStock,
  ajouterAuxCourses,
  changerCategorieStock,
  cocherCourse,
  poserPeremption,
  rangerCoursesFaites,
  retirerDesCourses,
  retirerDuStock,
  tournerNiveau,
} from "@/lib/cuisine/donnees";

/**
 * Actions du module Cuisine.
 *
 * Elles ne revalident que `/cuisine` : rien de ce qui se passe ici ne change
 * l'écran du jour, le bilan ou les arcs, et prétendre le contraire ferait
 * recalculer des pages pour rien.
 */

export type Retour = { erreur?: string; message?: string };

function rafraichir() {
  revalidatePath("/cuisine");
  revalidatePath("/cuisine/courses");
}

/* ───────────────────────── Inventaire ───────────────────────── */

export async function actionAjouterStock(nom: string): Promise<Retour> {
  const id = await ajouterAuStock(nom);
  if (id === null) return { erreur: "Il faut un nom." };
  rafraichir();
  return { message: `« ${nom.trim()} » ajouté.` };
}

export async function actionTournerNiveau(id: number): Promise<void> {
  if (!Number.isInteger(id)) return;
  await tournerNiveau(id);
  rafraichir();
}

export async function actionCategorieStock(id: number, categorie: string): Promise<void> {
  if (!Number.isInteger(id)) return;
  await changerCategorieStock(id, categorie);
  rafraichir();
}

export async function actionPeremption(id: number, date: string): Promise<void> {
  if (!Number.isInteger(id)) return;
  await poserPeremption(id, date.length === 0 ? null : date);
  rafraichir();
}

export async function actionRetirerStock(id: number): Promise<void> {
  if (!Number.isInteger(id)) return;
  await retirerDuStock(id);
  rafraichir();
}

/* ─────────────────────────── Courses ─────────────────────────── */

export async function actionAjouterCourse(nom: string): Promise<Retour> {
  const id = await ajouterAuxCourses(nom);
  if (id === null) return { erreur: "Il faut un nom." };
  rafraichir();
  return { message: `« ${nom.trim()} » ajouté.` };
}

/** Depuis l'inventaire : ce qui est épuisé se remet en courses d'un tap. */
export async function actionRacheter(nom: string, categorie: string): Promise<Retour> {
  const id = await ajouterAuxCourses(nom, categorie);
  if (id === null) return { erreur: "Il faut un nom." };
  rafraichir();
  return { message: "Ajouté aux courses." };
}

export async function actionCocherCourse(id: number, achete: boolean): Promise<void> {
  if (!Number.isInteger(id)) return;
  await cocherCourse(id, achete);
  rafraichir();
}

export async function actionRetirerCourse(id: number): Promise<void> {
  if (!Number.isInteger(id)) return;
  await retirerDesCourses(id);
  rafraichir();
}

export async function actionRangerCourses(): Promise<Retour> {
  const combien = await rangerCoursesFaites();
  rafraichir();
  return {
    message:
      combien === 0
        ? "Rien à ranger."
        : `${combien} article${combien > 1 ? "s" : ""} rangé${combien > 1 ? "s" : ""}.`,
  };
}
