"use server";

import { revalidatePath } from "next/cache";

import { corrigerPhrase, corrigerReponseSaison } from "@/lib/journal";

/**
 * Corrections du journal.
 *
 * Aucune revalidation pendant la frappe : rafraîchir la route rerendrait la
 * liste sous les doigts. C'est l'écran qui demande le rafraîchissement une
 * fois la correction terminée.
 */

export async function actionCorrigerPhrase(date: string, texte: string): Promise<void> {
  await corrigerPhrase(date, texte);
}

export async function actionCorrigerSaison(
  numero: number,
  texte: string,
): Promise<void> {
  await corrigerReponseSaison(numero, texte);
}

/** Appelée une fois l'édition close, pour que la page reflète l'état écrit. */
export async function actionRafraichirJournal(): Promise<void> {
  revalidatePath("/parcours");
  revalidatePath("/jour");
}
