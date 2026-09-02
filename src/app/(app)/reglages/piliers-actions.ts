"use server";

import { revalidatePath } from "next/cache";

import {
  creerPilier,
  modifierPilier,
  pertePilier,
  reordonnerPiliers,
  supprimerPilier,
  type PertePilier,
} from "@/lib/piliers";

/**
 * Écriture des piliers.
 *
 * Ils traversent toute l'application : renommer, recolorier ou supprimer un
 * pilier change le jardin, le bilan, les arcs, la sélection du jour. Toutes
 * ces routes sont donc revalidées ensemble.
 */

export type Retour = { erreur?: string; message?: string };

function rafraichir() {
  for (const route of [
    "/reglages",
    "/jour",
    "/semaine",
    "/arcs",
    "/arcs/accomplis",
    "/bilan",
    "/parcours",
    "/jardin",
  ]) {
    revalidatePath(route);
  }
}

export async function actionCreerPilier(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const nom = String(donnees.get("nom") ?? "").trim();
  const couleur = String(donnees.get("couleur") ?? "");

  if (nom.length === 0) return { erreur: "Un pilier a besoin d'un nom." };

  const cle = await creerPilier({ nom, couleur });
  if (!cle) return { erreur: "Nom ou couleur invalide." };

  rafraichir();
  return { message: `« ${nom} » ajouté.` };
}

export async function actionModifierPilier(
  cle: string,
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const nom = String(donnees.get("nom") ?? "").trim();
  const couleur = String(donnees.get("couleur") ?? "");

  if (nom.length === 0) return { erreur: "Un pilier a besoin d'un nom." };
  if (!(await modifierPilier(cle, { nom, couleur }))) {
    return { erreur: "Nom ou couleur invalide." };
  }

  rafraichir();
  return { message: "Enregistré." };
}

export async function actionDeplacerPilier(
  cles: string[],
  cle: string,
  sens: -1 | 1,
): Promise<void> {
  const rang = cles.indexOf(cle);
  const cible = rang + sens;
  if (rang < 0 || cible < 0 || cible >= cles.length) return;

  const suivant = [...cles];
  [suivant[rang], suivant[cible]] = [suivant[cible], suivant[rang]];
  await reordonnerPiliers(suivant);
  rafraichir();
}

/** Ce qu'une suppression emporterait. Rien n'est touché ici. */
export async function actionPertePilier(cle: string): Promise<PertePilier | null> {
  return pertePilier(cle);
}

export async function actionSupprimerPilier(cle: string): Promise<Retour> {
  const issue = await supprimerPilier(cle);

  if (issue === "absent") return { erreur: "Ce pilier n'existe plus." };
  if (issue === "dernier") {
    return {
      erreur:
        "C'est le dernier pilier : l'app n'aurait plus rien à proposer. Crées-en un autre d'abord.",
    };
  }

  rafraichir();
  return { message: "Pilier supprimé." };
}
