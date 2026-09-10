"use server";

import { revalidatePath } from "next/cache";

import {
  creerCategorie,
  creerRegle,
  deplacerRegle,
  modifierCategorie,
  modifierRegle,
  perteCategorie,
  reordonnerCategories,
  supprimerCategorie,
  supprimerRegle,
  type PerteCategorie,
} from "@/lib/categories";
import { relireTout } from "@/lib/calendrier/abonnements";
import { diagnostiquer } from "@/lib/erreurs";

/**
 * Écriture des catégories de créneau et de leurs règles de classement.
 *
 * Toute modification de règle relance la relecture des calendriers : le
 * classement se fait à l'écriture, donc une règle changée ne vaut rien tant que
 * les créneaux importés n'ont pas été repassés dessus. Le faire ici évite de
 * laisser croire qu'un changement est pris en compte alors qu'il attend un
 * bouton.
 */

export type Retour = { erreur?: string; message?: string; perte?: PerteCategorie };

const INSTALLATION =
  "La base n'est pas à jour : la table des catégories n'existe pas encore. " +
  "Ouvre l'adresse d'installation une fois, puis reviens ici.";

function expliquer(erreur: unknown): Retour {
  if (diagnostiquer(erreur) !== null) return { erreur: INSTALLATION };
  return {
    erreur: `Interrompu : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
  };
}

function rafraichir() {
  for (const route of ["/reglages", "/reglages/categories", "/jour", "/semaine"]) {
    revalidatePath(route);
  }
}

/* ────────────────────── Catégories ────────────────────── */

export async function actionCreerCategorie(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const nom = String(donnees.get("nom") ?? "").trim();
  const couleur = String(donnees.get("couleur") ?? "");

  if (nom.length === 0) return { erreur: "Une catégorie a besoin d'un nom." };

  try {
    if ((await creerCategorie({ nom, couleur })) === null) {
      return { erreur: "Nom ou teinte invalide." };
    }
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: `« ${nom} » ajoutée.` };
}

export async function actionModifierCategorie(
  cle: string,
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const nom = String(donnees.get("nom") ?? "").trim();
  const couleur = String(donnees.get("couleur") ?? "");

  if (nom.length === 0) return { erreur: "Une catégorie a besoin d'un nom." };

  try {
    if (!(await modifierCategorie(cle, { nom, couleur }))) {
      return { erreur: "Nom ou teinte invalide." };
    }
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: "Enregistré." };
}

export async function actionDeplacerCategorie(
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
    await reordonnerCategories(suivant);
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return {};
}

/** Ce qu'une suppression déplacerait. Rien n'est touché. */
export async function actionPerteCategorie(cle: string): Promise<Retour> {
  try {
    const perte = await perteCategorie(cle);
    if (!perte) return { erreur: "Cette catégorie n'existe plus." };
    return { perte };
  } catch (erreur) {
    return expliquer(erreur);
  }
}

export async function actionSupprimerCategorie(cle: string): Promise<Retour> {
  let issue: Awaited<ReturnType<typeof supprimerCategorie>>;
  try {
    issue = await supprimerCategorie(cle);
  } catch (erreur) {
    return expliquer(erreur);
  }

  if (issue === "absente") return { erreur: "Cette catégorie n'existe plus." };
  if (issue === "protegee") {
    return {
      erreur:
        "« Autre » ne se supprime pas : c'est là que retombent les créneaux dont la catégorie disparaît.",
    };
  }

  rafraichir();
  return { message: "Catégorie supprimée. Ses créneaux sont passés dans « Autre »." };
}

/* ────────────────────── Règles de classement ────────────────────── */

/** Reclasse les créneaux importés. Sans ça, une règle changée reste lettre morte. */
async function reclasser(): Promise<string> {
  try {
    const lectures = await relireTout();
    if (lectures.length === 0) return "";
    const echecs = lectures.filter((l) => l.erreur !== null);
    if (echecs.length > 0) return " Les calendriers n'ont pas pu être relus.";
    const total = lectures.reduce((n, l) => n + l.occurrences, 0);
    return ` ${total} créneau${total > 1 ? "x" : ""} importé${total > 1 ? "s" : ""} reclassé${total > 1 ? "s" : ""}.`;
  } catch {
    return " Les calendriers n'ont pas pu être relus.";
  }
}

export async function actionCreerRegle(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const motif = String(donnees.get("motif") ?? "").trim();
  const categorie = String(donnees.get("categorie") ?? "autre");

  if (motif.length === 0) return { erreur: "Une règle a besoin d'un mot à chercher." };

  try {
    if (!(await creerRegle(motif, categorie))) {
      return { erreur: "Mot ou catégorie invalide." };
    }
  } catch (erreur) {
    return expliquer(erreur);
  }

  const suite = await reclasser();
  rafraichir();
  return { message: `Règle ajoutée.${suite}` };
}

export async function actionModifierRegle(
  id: number,
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const motif = String(donnees.get("motif") ?? "").trim();
  const categorie = String(donnees.get("categorie") ?? "autre");

  if (motif.length === 0) return { erreur: "Une règle a besoin d'un mot à chercher." };

  try {
    if (!(await modifierRegle(id, { motif, categorie }))) {
      return { erreur: "Mot ou catégorie invalide." };
    }
  } catch (erreur) {
    return expliquer(erreur);
  }

  const suite = await reclasser();
  rafraichir();
  return { message: `Enregistré.${suite}` };
}

export async function actionDeplacerRegle(
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
    await deplacerRegle(suivant);
  } catch (erreur) {
    return expliquer(erreur);
  }

  const suite = await reclasser();
  rafraichir();
  return { message: `Ordre changé.${suite}` };
}

export async function actionSupprimerRegle(id: number): Promise<Retour> {
  try {
    if (!(await supprimerRegle(id))) return { erreur: "Cette règle n'existe plus." };
  } catch (erreur) {
    return expliquer(erreur);
  }

  const suite = await reclasser();
  rafraichir();
  return { message: `Règle retirée.${suite}` };
}
