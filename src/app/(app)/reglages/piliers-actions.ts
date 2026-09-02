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
import { diagnostiquer } from "@/lib/erreurs";

/**
 * Écriture des piliers.
 *
 * Ils traversent toute l'application : renommer, recolorier ou supprimer un
 * pilier change le jardin, le bilan, les arcs, la sélection du jour. Toutes
 * ces routes sont donc revalidées ensemble.
 */

export type Retour = { erreur?: string; message?: string };

/**
 * Aucune de ces actions ne laisse filer une erreur.
 *
 * Une exception levée dans une action serveur remonte jusqu'à l'écran
 * « Quelque chose a cédé », qui ne dit rien de ce qui s'est passé. Or le cas
 * de loin le plus probable est prévisible : la migration n'a pas encore été
 * appliquée, la table des piliers n'existe pas. Autant le dire.
 */
const INSTALLATION =
  "La base n'est pas à jour : la table des piliers n'existe pas encore. " +
  "Ouvre l'adresse d'installation une fois, puis reviens ici.";

function expliquer(erreur: unknown): Retour {
  if (diagnostiquer(erreur) !== null) return { erreur: INSTALLATION };
  return {
    erreur: `Interrompu : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
  };
}

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

  try {
    const cle = await creerPilier({ nom, couleur });
    if (!cle) return { erreur: "Nom ou couleur invalide." };
  } catch (erreur) {
    return expliquer(erreur);
  }

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

  try {
    if (!(await modifierPilier(cle, { nom, couleur }))) {
      return { erreur: "Nom ou couleur invalide." };
    }
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: "Enregistré." };
}

export async function actionDeplacerPilier(
  cles: string[],
  cle: string,
  sens: -1 | 1,
): Promise<Retour> {
  const rang = cles.indexOf(cle);
  const cible = rang + sens;
  if (rang < 0 || cible < 0 || cible >= cles.length) return {};

  const suivant = [...cles];
  [suivant[rang], suivant[cible]] = [suivant[cible], suivant[rang]];

  try {
    await reordonnerPiliers(suivant);
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return {};
}

/**
 * Ce qu'une suppression emporterait. Rien n'est touché ici.
 *
 * Rend un `Retour` plutôt que de lever : c'est ce premier appel qui échouait
 * quand la table n'existait pas, et l'écran d'erreur générique prenait la main
 * sans rien expliquer.
 */
export async function actionPertePilier(
  cle: string,
): Promise<{ perte?: PertePilier; erreur?: string }> {
  try {
    const perte = await pertePilier(cle);
    if (!perte) return { erreur: "Ce pilier n'existe plus." };
    return { perte };
  } catch (erreur) {
    return expliquer(erreur);
  }
}

export async function actionSupprimerPilier(cle: string): Promise<Retour> {
  let issue: Awaited<ReturnType<typeof supprimerPilier>>;
  try {
    issue = await supprimerPilier(cle);
  } catch (erreur) {
    return expliquer(erreur);
  }

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
