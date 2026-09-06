"use server";

import { revalidatePath } from "next/cache";

import { chercherAliments } from "@/lib/cuisine/donnees";
import {
  corrigerEntree,
  noterAliment,
  noterRecette,
  resynchroniserEntree,
  retirerEntree,
  type CorrectionEntree,
} from "@/lib/cuisine/journal";
import { diagnostiquer } from "@/lib/erreurs";
import type { PrecisionSaisie, Repas } from "@/db/cuisine";

/**
 * Écriture du journal.
 *
 * Ne revalide que les routes du module. Le journal ne parle à rien d'autre :
 * il ne nourrit ni l'élan, ni les piliers, ni le calendrier.
 */

export type Retour = { erreur?: string; message?: string };

const INSTALLATION =
  "La base n'est pas à jour : la table du journal n'existe pas encore. " +
  "Ouvre l'adresse d'installation une fois, puis reviens ici.";

function expliquer(erreur: unknown): Retour {
  if (diagnostiquer(erreur) !== null) return { erreur: INSTALLATION };
  return {
    erreur: `Interrompu : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
  };
}

function rafraichir() {
  revalidatePath("/cuisine/journal");
  revalidatePath("/cuisine");
}

const REPAS: Repas[] = ["matin", "midi", "soir", "collation"];
const PRECISIONS: PrecisionSaisie[] = ["pese", "estime"];

function valider(
  date: string,
  repas: string,
  precision: string,
): { repas: Repas; precision: PrecisionSaisie } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!REPAS.includes(repas as Repas)) return null;
  if (!PRECISIONS.includes(precision as PrecisionSaisie)) return null;
  return { repas: repas as Repas, precision: precision as PrecisionSaisie };
}

export async function actionNoterRecette(saisie: {
  date: string;
  repas: string;
  recetteId: number;
  poidsAssietteG: number | null;
  precision: string;
}): Promise<Retour> {
  const propre = valider(saisie.date, saisie.repas, saisie.precision);
  if (!propre) return { erreur: "Saisie invalide." };
  if (!Number.isInteger(saisie.recetteId)) return { erreur: "Recette introuvable." };

  const poids =
    saisie.poidsAssietteG !== null &&
    Number.isFinite(saisie.poidsAssietteG) &&
    saisie.poidsAssietteG > 0
      ? saisie.poidsAssietteG
      : null;

  try {
    const issue = await noterRecette({
      date: saisie.date,
      repas: propre.repas,
      recetteId: saisie.recetteId,
      poidsAssietteG: poids,
      precision: propre.precision,
    });
    if (issue.issue === "introuvable") return { erreur: "Cette recette n'existe plus." };

    rafraichir();

    // Le rétrogradage doit se voir : sans poids total cuit, aucun ratio ne
    // s'applique et la part reste théorique, quoi qu'on ait coché.
    if (issue.theorique && propre.precision === "pese") {
      return {
        message:
          "Noté en estimé : la recette n'a pas de poids total cuit, la part reste théorique.",
      };
    }
    return { message: "Noté." };
  } catch (erreur) {
    return expliquer(erreur);
  }
}

export async function actionNoterAliment(saisie: {
  date: string;
  repas: string;
  alimentId: number;
  quantiteG: number;
  precision: string;
}): Promise<Retour> {
  const propre = valider(saisie.date, saisie.repas, saisie.precision);
  if (!propre) return { erreur: "Saisie invalide." };
  if (!Number.isInteger(saisie.alimentId)) return { erreur: "Aliment introuvable." };
  if (!Number.isFinite(saisie.quantiteG) || saisie.quantiteG <= 0) {
    return { erreur: "Il faut une quantité en grammes." };
  }

  try {
    const issue = await noterAliment({
      date: saisie.date,
      repas: propre.repas,
      alimentId: saisie.alimentId,
      quantiteG: saisie.quantiteG,
      precision: propre.precision,
    });
    if (issue.issue === "introuvable") return { erreur: "Cet aliment n'existe plus." };
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: "Noté." };
}

/**
 * Corrige une entrée déjà notée.
 *
 * Le recalcul se fait sur son instantané, pas sur la recette d'aujourd'hui :
 * corriger un chiffre n'est pas une resynchronisation déguisée.
 */
export async function actionCorrigerEntree(
  id: number,
  correction: {
    date?: string;
    repas?: string;
    precision?: string;
    poidsAssietteG?: number | null;
    quantiteG?: number;
  },
): Promise<Retour> {
  if (!Number.isInteger(id)) return { erreur: "Entrée introuvable." };

  const propre: CorrectionEntree = {};

  if (correction.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(correction.date)) return { erreur: "Date invalide." };
    propre.date = correction.date;
  }
  if (correction.repas !== undefined) {
    if (!REPAS.includes(correction.repas as Repas)) return { erreur: "Repas invalide." };
    propre.repas = correction.repas as Repas;
  }
  if (correction.precision !== undefined) {
    if (!PRECISIONS.includes(correction.precision as PrecisionSaisie)) {
      return { erreur: "Précision invalide." };
    }
    propre.precision = correction.precision as PrecisionSaisie;
  }
  if (correction.poidsAssietteG !== undefined) {
    const poids = correction.poidsAssietteG;
    propre.poidsAssietteG =
      poids !== null && Number.isFinite(poids) && poids > 0 ? poids : null;
  }
  if (correction.quantiteG !== undefined) {
    if (!Number.isFinite(correction.quantiteG) || correction.quantiteG <= 0) {
      return { erreur: "Il faut une quantité en grammes." };
    }
    propre.quantiteG = correction.quantiteG;
  }

  try {
    const issue = await corrigerEntree(id, propre);
    if (issue.issue === "introuvable") return { erreur: "Cette entrée n'existe plus." };
    if (issue.issue === "sans-instantane") {
      return {
        erreur:
          "Cette entrée est antérieure au détail par ingrédient : ses chiffres ne peuvent pas être rejoués. " +
          "Resynchronise-la depuis sa recette, ou retire-la et ressaisis-la. Le jour et le repas, eux, se changent.",
      };
    }

    rafraichir();

    // Un poids d'assiette saisi sans effet mérite une explication : sinon le
    // chiffre ne bouge pas et rien ne dit pourquoi.
    if (issue.theorique && (propre.poidsAssietteG != null || propre.precision === "pese")) {
      return {
        message:
          "Corrigé, mais la part reste théorique et l'entrée estimée : la recette n'avait pas de poids total cuit au moment de la saisie.",
      };
    }
    return { message: "Corrigé." };
  } catch (erreur) {
    return expliquer(erreur);
  }
}

/**
 * Refait l'instantané depuis la recette telle qu'elle est aujourd'hui.
 *
 * C'est le seul chemin par lequel une correction de recette rejoint le
 * journal, et il se prend entrée par entrée.
 */
export async function actionResynchroniser(id: number): Promise<Retour> {
  if (!Number.isInteger(id)) return { erreur: "Entrée introuvable." };

  try {
    const issue = await resynchroniserEntree(id);
    if (issue.issue === "introuvable") return { erreur: "Cette entrée n'existe plus." };
    if (issue.issue === "sans-recette") {
      return { erreur: "Cette entrée ne vient pas d'une recette." };
    }
    if (issue.issue === "recette-supprimee") {
      return {
        erreur:
          "La recette d'origine n'existe plus : il n'y a rien à rejoindre. L'entrée garde son instantané.",
      };
    }

    rafraichir();
    return {
      message: issue.theorique
        ? "Resynchronisé. La part reste théorique : la recette n'a pas de poids total cuit."
        : "Resynchronisé sur la recette actuelle.",
    };
  } catch (erreur) {
    return expliquer(erreur);
  }
}

export async function actionRetirerEntree(id: number): Promise<Retour> {
  if (!Number.isInteger(id)) return { erreur: "Entrée introuvable." };

  try {
    if (!(await retirerEntree(id))) return { erreur: "Cette entrée n'existe plus." };
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: "Entrée retirée." };
}

/** Recherche dans le catalogue, pour noter un aliment seul. */
export async function actionChercherPourJournal(requete: string) {
  return chercherAliments(requete);
}
