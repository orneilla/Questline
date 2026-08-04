"use server";

import { revalidatePath } from "next/cache";

import { enregistrerSauvegarde } from "@/lib/sauvegardes";
import type { FicheSauvegarde } from "@/lib/sauvegardes-partage";

/**
 * Création d'une sauvegarde à la demande.
 *
 * La restauration, elle, ne passe pas par une action serveur : le fichier pèse
 * plusieurs mégaoctets et le plafond d'une action est d'un seul. Elle passe par
 * `/api/sauvegardes/restaurer`, par lots.
 */

export async function actionCreerSauvegarde(): Promise<FicheSauvegarde> {
  const fiche = await enregistrerSauvegarde();
  revalidatePath("/reglages/sauvegardes");
  return fiche;
}

/** Rafraîchit tous les écrans après une restauration. */
export async function actionApresRestauration(): Promise<void> {
  revalidatePath("/", "layout");
}
