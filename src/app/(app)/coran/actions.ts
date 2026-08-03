"use server";

import { revalidatePath } from "next/cache";

import {
  chargerReglagesCoran,
  enregistrerPosition,
  enregistrerReglagesCoran,
  poserMarquePage,
  retirerMarquePage,
} from "@/lib/coran/donnees";
import { memoriserVerset } from "@/lib/coran/hifz";
import type { FormatHifz } from "@/lib/coran/formats";
import { retirerEdition } from "@/lib/coran/import";
import { EDITIONS_PROPOSEES, POLICES, RECITEURS } from "@/lib/coran/sources";
import type { UniteObjectif } from "@/db/schema";

/**
 * Actions du module Coran.
 *
 * Comme pour la révision, la lecture ne revalide rien pendant qu'elle a lieu :
 * rafraîchir la route courante rechargerait le lecteur et perdrait la place.
 */

export type Retour = { erreur?: string; message?: string };

function message(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : "Quelque chose n'a pas abouti.";
}

function entier(valeur: FormDataEntryValue | null, min: number, max: number): number | null {
  const nombre = Number(valeur);
  if (!Number.isInteger(nombre) || nombre < min || nombre > max) return null;
  return nombre;
}

/* ─────────────────────────────── Lecture ─────────────────────────────── */

export async function sauverPosition(versetNumero: number): Promise<void> {
  if (!Number.isInteger(versetNumero)) return;
  await enregistrerPosition(versetNumero);
}

export async function ajouterMarquePage(
  versetNumero: number,
  nom: string,
): Promise<Retour> {
  try {
    await poserMarquePage(versetNumero, nom);
    revalidatePath("/coran");
    return { message: "Marque-page posé." };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function supprimerMarquePage(id: number): Promise<void> {
  await retirerMarquePage(id);
  revalidatePath("/coran");
}

/* ────────────────────────────── Hifz ────────────────────────────── */

const FORMATS: FormatHifz[] = ["traduction", "enchainement", "fin_masquee"];

export async function memoriser(
  versetNumero: number,
  format: string,
): Promise<Retour> {
  if (!(FORMATS as string[]).includes(format)) return { erreur: "Format inconnu." };

  try {
    const resultat = await memoriserVerset({
      versetNumero,
      format: format as FormatHifz,
    });
    revalidatePath("/coran/hifz");
    revalidatePath("/cartes");
    return { message: `${resultat.message} Paquet « ${resultat.paquet} ».` };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

/* ──────────────────────────── Réglages ──────────────────────────── */

const UNITES: UniteObjectif[] = ["versets", "pages", "minutes"];

export async function sauverReglagesCoran(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const reciteur = String(donnees.get("reciteur") ?? "");
  const police = String(donnees.get("policeArabe") ?? "");
  const unite = String(donnees.get("uniteObjectif") ?? "");
  const taille = entier(donnees.get("tailleArabe"), 18, 64);
  const objectif = entier(donnees.get("objectifQuotidien"), 1, 6236);

  if (!RECITEURS.some((r) => r.cle === reciteur)) return { erreur: "Récitateur inconnu." };
  if (!POLICES.some((p) => p.cle === police)) return { erreur: "Police inconnue." };
  if (!(UNITES as string[]).includes(unite)) return { erreur: "Unité inconnue." };
  if (taille === null) return { erreur: "La taille doit rester entre 18 et 64." };
  if (objectif === null) return { erreur: "Objectif hors limites." };

  try {
    await enregistrerReglagesCoran({
      reciteur,
      policeArabe: police,
      uniteObjectif: unite as UniteObjectif,
      tailleArabe: taille,
      objectifQuotidien: objectif,
      afficherArabe: donnees.get("afficherArabe") !== null,
      afficherTranslitteration: donnees.get("afficherTranslitteration") !== null,
      afficherTraduction: donnees.get("afficherTraduction") !== null,
    });
    revalidatePath("/coran");
    revalidatePath("/coran/reglages");
    return { message: "Réglages enregistrés." };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

/** Choisit l'édition affichée parmi celles déjà importées. */
export async function choisirEdition(cle: string | null, type: string): Promise<Retour> {
  if (cle !== null && !EDITIONS_PROPOSEES.some((e) => e.cle === cle)) {
    return { erreur: "Édition inconnue." };
  }

  try {
    await enregistrerReglagesCoran(
      type === "translitteration" ? { translitteration: cle } : { traduction: cle },
    );
    revalidatePath("/coran");
    revalidatePath("/coran/reglages");
    return { message: cle ? "Édition affichée." : "Édition masquée." };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

/** Retire une édition de la base. Le texte arabe n'est jamais touché. */
export async function desinstallerEdition(cle: string): Promise<Retour> {
  try {
    const reglages = await chargerReglagesCoran();
    if (reglages.traduction === cle) await enregistrerReglagesCoran({ traduction: null });
    if (reglages.translitteration === cle) {
      await enregistrerReglagesCoran({ translitteration: null });
    }
    await retirerEdition(cle);
    revalidatePath("/coran/reglages");
    revalidatePath("/coran");
    return { message: "Édition retirée de la base." };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}
