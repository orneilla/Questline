"use server";

import { revalidatePath } from "next/cache";

import {
  creerAlimentManuel,
  modifierAlimentManuel,
  supprimerAlimentManuel,
  verifier,
  type Anomalie,
  type ChampsAlimentManuel,
} from "@/lib/cuisine/aliments";
import { diagnostiquer } from "@/lib/erreurs";

/**
 * Écriture des aliments saisis depuis un emballage.
 *
 * Le module reste étanche : rien ici ne touche aux piliers, à l'élan, au
 * journal de la vie ni aux saisons. Ce sont des lignes de catalogue.
 */

export type Retour = {
  erreur?: string;
  message?: string;
  /** Ce qui a l'air mal recopié, sans forcément empêcher l'enregistrement. */
  remarques?: Anomalie[];
  id?: number;
};

const INSTALLATION =
  "La base n'est pas à jour : les colonnes des produits emballés n'existent pas " +
  "encore. Ouvre l'adresse d'installation une fois, puis reviens ici.";

function expliquer(erreur: unknown): Retour {
  if (diagnostiquer(erreur) !== null) return { erreur: INSTALLATION };
  return {
    erreur: `Interrompu : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
  };
}

/** Un champ vide veut dire « pas imprimé sur l'emballage », pas « zéro ». */
function valeur(donnees: FormData, nom: string): number | null {
  const brut = String(donnees.get(nom) ?? "").trim().replace(",", ".");
  if (brut.length === 0) return null;
  const nombre = Number(brut);
  return Number.isFinite(nombre) ? nombre : null;
}

function lire(donnees: FormData): ChampsAlimentManuel {
  return {
    nom: String(donnees.get("nom") ?? ""),
    marque: String(donnees.get("marque") ?? ""),
    categorie: String(donnees.get("categorie") ?? "autre"),
    kcal100g: valeur(donnees, "kcal100g"),
    proteines100g: valeur(donnees, "proteines100g"),
    glucides100g: valeur(donnees, "glucides100g"),
    sucres100g: valeur(donnees, "sucres100g"),
    lipides100g: valeur(donnees, "lipides100g"),
    ags100g: valeur(donnees, "ags100g"),
    fibres100g: valeur(donnees, "fibres100g"),
    sel100g: valeur(donnees, "sel100g"),
    poidsPortionG: valeur(donnees, "poidsPortionG"),
    nomPortion: String(donnees.get("nomPortion") ?? ""),
  };
}

function rafraichir() {
  for (const route of ["/cuisine", "/cuisine/aliments", "/cuisine/journal"]) {
    revalidatePath(route);
  }
}

export async function actionCreerAliment(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const champs = lire(donnees);
  const remarques = verifier(champs);

  try {
    const cree = await creerAlimentManuel(champs);
    if (!cree) {
      return {
        erreur: "Il manque le nom, ou une valeur ne tient pas debout.",
        remarques,
      };
    }
    rafraichir();
    return {
      message: `« ${champs.nom.trim()} » ajouté au catalogue.`,
      remarques: remarques.length > 0 ? remarques : undefined,
      id: cree.id,
    };
  } catch (erreur) {
    return expliquer(erreur);
  }
}

export async function actionModifierAliment(
  id: number,
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const champs = lire(donnees);
  const remarques = verifier(champs);

  try {
    if (!(await modifierAlimentManuel(id, champs))) {
      return {
        erreur: "Il manque le nom, ou une valeur ne tient pas debout.",
        remarques,
      };
    }
    rafraichir();
    return {
      message: "Enregistré.",
      remarques: remarques.length > 0 ? remarques : undefined,
    };
  } catch (erreur) {
    return expliquer(erreur);
  }
}

export async function actionSupprimerAliment(id: number): Promise<Retour> {
  try {
    if (!(await supprimerAlimentManuel(id))) {
      return { erreur: "Ce produit n'existe plus, ou ne vient pas d'une saisie." };
    }
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: "Produit retiré du catalogue. Les repas déjà notés ne bougent pas." };
}
