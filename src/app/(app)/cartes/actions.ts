"use server";

import { revalidatePath } from "next/cache";

import { cloreSession, enregistrerNotation, gainSavoir } from "@/lib/cartes/donnees";
import type { Notation } from "@/lib/cartes/fsrs";
import { crediterPilier } from "@/lib/jour";

/**
 * Actions du module cartes.
 *
 * Volontairement sans revalidation pendant la session : l'écran ne se recharge
 * jamais entre deux cartes. Les pages concernées sont rafraîchies à la clôture.
 */

function estNotation(valeur: number): valeur is Notation {
  return valeur === 1 || valeur === 2 || valeur === 3 || valeur === 4;
}

export async function noterCarte(
  carteId: number,
  note: number,
  dureeMs: number,
): Promise<void> {
  if (!Number.isInteger(carteId) || !estNotation(note)) {
    throw new Error("Notation invalide.");
  }
  await enregistrerNotation({
    carteId,
    note,
    dureeMs: Number.isFinite(dureeMs) ? Math.max(0, Math.round(dureeMs)) : 0,
  });
}

export async function terminerSession(
  paquetId: number | null,
  cartesVues: number,
  dureeSecondes: number,
): Promise<void> {
  const vues = Math.max(0, Math.round(cartesVues));

  await cloreSession({
    paquetId,
    cartesVues: vues,
    dureeSecondes: Math.max(0, Math.round(dureeSecondes)),
  });

  // Réviser nourrit « savoir » — une fois par jour, pas à chaque session.
  await crediterPilier("savoir", gainSavoir(vues), "cartes");
  revalidatePath("/cartes");
  revalidatePath("/jardin");
  revalidatePath("/jour");
}
