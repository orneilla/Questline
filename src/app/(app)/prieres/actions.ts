"use server";

import { revalidatePath } from "next/cache";

import {
  basculerRappel,
  basculerRappels,
  cocher,
  decocher,
  enregistrerConventions,
  enregistrerDecalages,
  enregistrerLieu,
} from "@/lib/prieres/donnees";
import { CLES_PRIERE } from "@/lib/prieres/partage";
import { diagnostiquer } from "@/lib/erreurs";

/**
 * Écriture du suivi des prières.
 *
 * Rien ici ne touche à une autre table que celles du suivi. Aucun crédit de
 * pilier, aucun élan, aucune journée de journal ouverte au passage : cocher
 * une prière ne fait bouger aucun chiffre ailleurs dans l'application.
 */

export type Retour = { erreur?: string; message?: string };

const INSTALLATION =
  "La base n'est pas à jour : les tables du suivi n'existent pas encore. " +
  "Ouvre l'adresse d'installation une fois, puis reviens ici.";

function expliquer(erreur: unknown): Retour {
  if (diagnostiquer(erreur) !== null) return { erreur: INSTALLATION };
  return {
    erreur: `Interrompu : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
  };
}

function rafraichir() {
  revalidatePath("/prieres");
  revalidatePath("/prieres/reglages");
}

/** Coche ou décoche. Le même geste dans les deux sens, sans confirmation. */
export async function basculerPriere(
  date: string,
  priere: string,
  faite: boolean,
): Promise<Retour> {
  try {
    const fait = faite ? await cocher(date, priere) : await decocher(date, priere);
    if (!fait) return { erreur: "Prière inconnue." };
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return {};
}

/* ────────────────────── Réglages ────────────────────── */

export async function actionLieu(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const latitude = Number(donnees.get("latitude"));
  const longitude = Number(donnees.get("longitude"));
  const lieu = String(donnees.get("lieu") ?? "");

  try {
    if (!(await enregistrerLieu(latitude, longitude, lieu))) {
      return {
        erreur:
          "Ces coordonnées ne tiennent pas debout. La latitude va de -90 à 90, la longitude de -180 à 180.",
      };
    }
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: "Lieu enregistré. Les heures sont recalculées." };
}

export async function actionConventions(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  try {
    await enregistrerConventions({
      convention: String(donnees.get("convention") ?? "uoif"),
      ecoleAsr: String(donnees.get("ecoleAsr") ?? "majorite"),
      nuitCourte: String(donnees.get("nuitCourte") ?? "angle"),
    });
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: "Enregistré." };
}

export async function actionDecalages(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const valeurs: Record<string, number> = {};
  for (const cle of CLES_PRIERE) valeurs[cle] = Number(donnees.get(cle) ?? 0);

  try {
    await enregistrerDecalages(valeurs);
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: "Corrections enregistrées." };
}

export async function actionRappelPriere(
  priere: string,
  actif: boolean,
): Promise<Retour> {
  try {
    if (!(await basculerRappel(priere, actif))) return { erreur: "Prière inconnue." };
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return {};
}

export async function actionRappelsPrieres(actifs: boolean): Promise<Retour> {
  try {
    await basculerRappels(actifs);
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return {};
}
