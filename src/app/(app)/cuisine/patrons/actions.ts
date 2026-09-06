"use server";

import { revalidatePath } from "next/cache";

import {
  basculerPatron,
  creerPatron,
  modifierPatron,
  reordonnerPatrons,
  supprimerPatron,
  type ChampsPatron,
} from "@/lib/cuisine/patrons";
import { diagnostiquer } from "@/lib/erreurs";

/**
 * Écriture des patrons de plat.
 *
 * Ne revalide que les routes du module : un patron ne regarde ni les piliers,
 * ni l'élan, ni le calendrier.
 */

export type Retour = { erreur?: string; message?: string };

/**
 * Aucune de ces actions ne laisse filer une erreur.
 *
 * Le cas de loin le plus probable est prévisible — la migration n'a pas encore
 * été appliquée et la table n'existe pas. Une exception, elle, remonterait
 * jusqu'à l'écran « Quelque chose a cédé », qui ne dit rien.
 */
const INSTALLATION =
  "La base n'est pas à jour : la table des patrons n'existe pas encore. " +
  "Ouvre l'adresse d'installation une fois, puis reviens ici.";

function expliquer(erreur: unknown): Retour {
  if (diagnostiquer(erreur) !== null) return { erreur: INSTALLATION };
  return {
    erreur: `Interrompu : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
  };
}

function rafraichir() {
  revalidatePath("/cuisine/patrons");
  revalidatePath("/cuisine/suggestions");
}

/**
 * Lit le formulaire.
 *
 * Les listes voyagent en champs répétés, pas en JSON. Les exclusions arrivent
 * en deux morceaux — des catégories entières cochées, et des mots libres
 * séparés par des virgules — mais se rangent dans la même colonne : pour le
 * moteur, une exclusion est une exclusion.
 */
function lireChamps(donnees: FormData): ChampsPatron {
  return {
    nom: String(donnees.get("nom") ?? ""),
    categories: donnees.getAll("categories").map(String),
    profil: String(donnees.get("profil") ?? ""),
    modeCuisson: String(donnees.get("modeCuisson") ?? ""),
    exclut: [
      ...donnees.getAll("exclutCategorie").map(String),
      ...String(donnees.get("exclutMots") ?? "")
        .split(",")
        .map((mot) => mot.trim()),
    ],
  };
}

const REFUS =
  "Il faut un nom, au moins une catégorie et un mode de cuisson connu.";

export async function actionCreerPatron(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const champs = lireChamps(donnees);

  try {
    if ((await creerPatron(champs)) === null) return { erreur: REFUS };
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: `« ${champs.nom.trim()} » ajouté.` };
}

export async function actionModifierPatron(
  id: number,
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  try {
    if (!(await modifierPatron(id, lireChamps(donnees)))) return { erreur: REFUS };
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: "Enregistré." };
}

export async function actionBasculerPatron(id: number, actif: boolean): Promise<Retour> {
  try {
    await basculerPatron(id, actif);
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: actif ? "En service." : "Mis en sommeil." };
}

export async function actionDeplacerPatron(
  ids: number[],
  id: number,
  sens: -1 | 1,
): Promise<Retour> {
  const rang = ids.indexOf(id);
  const cible = rang + sens;
  if (rang < 0 || cible < 0 || cible >= ids.length) return {};

  const suivant = [...ids];
  [suivant[rang], suivant[cible]] = [suivant[cible], suivant[rang]];

  try {
    await reordonnerPatrons(suivant);
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return {};
}

export async function actionSupprimerPatron(id: number): Promise<Retour> {
  try {
    if (!(await supprimerPatron(id))) return { erreur: "Ce patron n'existe plus." };
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: "Patron supprimé." };
}
