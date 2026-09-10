"use server";

import { revalidatePath } from "next/cache";

import {
  calerSaisonAujourdhui,
  repartirDeZero,
  type BilanReprise,
  type ChoixReprise,
} from "@/lib/reprise";
import { enregistrerSauvegarde } from "@/lib/sauvegardes";
import { diagnostiquer } from "@/lib/erreurs";

/**
 * Repartir de zéro.
 *
 * Une sauvegarde est prise juste avant, sans le demander. Elle ne couvre pas
 * tout — ni les images des cartes, ni le module Cuisine — mais elle rattrape
 * l'essentiel si la décision se révèle trop large, et la prendre coûte moins
 * cher que de la regretter.
 */

export type Retour = {
  erreur?: string;
  message?: string;
  bilan?: BilanReprise;
  sauvegarde?: string;
};

/** Le mot à taper. Un bouton seul ne suffit pas pour un geste sans retour. */
const MOT = "RECOMMENCER";

export async function actionRepartirDeZero(
  confirmation: string,
  choix: ChoixReprise,
): Promise<Retour> {
  if (confirmation.trim().toUpperCase() !== MOT) {
    return { erreur: `Tape ${MOT} en toutes lettres pour confirmer.` };
  }

  let sauvegarde: string | undefined;
  try {
    const fiche = await enregistrerSauvegarde();
    sauvegarde = fiche.creeeLe;
  } catch (erreur) {
    // Une sauvegarde impossible n'autorise pas à effacer : c'est le seul filet.
    return {
      erreur:
        "La sauvegarde préalable a échoué, rien n'a été effacé. " +
        `La base répond : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    };
  }

  let bilan: BilanReprise;
  try {
    bilan = await repartirDeZero(choix);
  } catch (erreur) {
    if (diagnostiquer(erreur) !== null) {
      return {
        erreur:
          "La base n'est pas à jour : ouvre l'adresse d'installation une fois, puis reviens ici.",
      };
    }
    return {
      erreur: `Interrompu : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    };
  }

  for (const route of [
    "/jour",
    "/semaine",
    "/arcs",
    "/bilan",
    "/parcours",
    "/jardin",
    "/cartes",
    "/coran",
    "/cuisine",
    "/reglages",
    "/reglages/sauvegardes",
  ]) {
    revalidatePath(route);
  }

  return { bilan, sauvegarde, message: "C'est reparti au premier jour." };
}

/**
 * Recale le départ des saisons sur aujourd'hui, sans rien effacer.
 *
 * Existe parce que l'origine peut avoir été posée un autre jour — après une
 * remise à zéro faite en milieu de semaine, notamment. Remettre le compteur au
 * jour 1 ne devrait pas obliger à tout ré-effacer.
 */
export async function actionCalerSaison(): Promise<Retour> {
  try {
    await calerSaisonAujourdhui();
  } catch (erreur) {
    if (diagnostiquer(erreur) !== null) {
      return {
        erreur:
          "La base n'est pas à jour : ouvre l'adresse d'installation une fois, puis reviens ici.",
      };
    }
    return {
      erreur: `Interrompu : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    };
  }

  revalidatePath("/jour");
  revalidatePath("/reglages/reprise");
  return { message: "La saison 1 commence aujourd'hui. Jour 1." };
}
