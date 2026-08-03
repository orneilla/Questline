"use server";

import {
  cloreSession,
  enregistrerNotation,
  gainSavoir,
  maitrisePaquet,
} from "@/lib/cartes/donnees";
import type { Notation } from "@/lib/cartes/fsrs";
import { crediterPilier } from "@/lib/jour";

/**
 * Actions du module cartes.
 *
 * Aucune de ces actions ne revalide de chemin, et ce n'est pas un oubli.
 * Revalider depuis une action rafraîchit aussi la route courante : à la
 * clôture, le serveur rerendrait l'écran de révision, n'y trouverait plus
 * aucune carte due, et remplacerait la fin de session par « rien à réviser ».
 * Le travail de la session serait invisible.
 *
 * Rien ne devient périmé pour autant : toutes les pages de l'application sont
 * en `force-dynamic`, et Next 15 ne garde pas les routes dynamiques dans le
 * cache du routeur — revenir aux paquets les recalcule.
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
}

/** Maîtrise fraîche d'un paquet : ce que l'écran de fin de session montre. */
export async function mesurerPaquet(
  paquetId: number | null,
): Promise<{ maitrise: number; total: number; mures: number }> {
  if (paquetId !== null && !Number.isInteger(paquetId)) {
    return { maitrise: 0, total: 0, mures: 0 };
  }
  return maitrisePaquet(paquetId);
}
