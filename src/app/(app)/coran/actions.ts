"use server";

import { revalidatePath } from "next/cache";

import {
  analyserMot,
  chargerReglagesCoran,
  chargerTrancheSourate,
  enregistrerPosition,
  enregistrerReglagesCoran,
  poserMarquePage,
  remettreLectureAZero,
  retirerMarquePage,
  type MotAffiche,
  type TrancheSourate,
} from "@/lib/coran/donnees";
import {
  apercuCarte,
  apprendreMotDuCoran,
  memoriserVerset,
  paquetsDisponibles,
  type ApercuCarte,
} from "@/lib/coran/hifz";
import type { FormatHifz } from "@/lib/coran/formats";
import { retirerEdition } from "@/lib/coran/import";
import { EDITIONS_PROPOSEES, POLICES, RECITEURS } from "@/lib/coran/sources";
import type { ModeEcoute, UniteObjectif } from "@/db/schema";

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

const FORMATS: FormatHifz[] = ["enchainement", "fin_masquee", "reciter"];

/**
 * L'aperçu d'une carte, avant qu'elle n'existe.
 *
 * Rien n'est écrit ici. C'est ce même code qui composera la carte une fois
 * l'aperçu confirmé : deux chemins distincts finiraient par diverger.
 */
export async function apercuMemorisation(
  versetNumero: number,
  format: string,
): Promise<{ erreur?: string; apercu?: ApercuCarte; paquets?: { id: number; nom: string }[] }> {
  if (!(FORMATS as string[]).includes(format)) return { erreur: "Format inconnu." };
  try {
    const [apercu, liste] = await Promise.all([
      apercuCarte({ versetNumero, format: format as FormatHifz }),
      paquetsDisponibles(),
    ]);
    return { apercu, paquets: liste };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function memoriser(
  versetNumero: number,
  format: string,
  paquetId?: number,
): Promise<Retour> {
  if (!(FORMATS as string[]).includes(format)) return { erreur: "Format inconnu." };

  try {
    const resultat = await memoriserVerset({
      versetNumero,
      format: format as FormatHifz,
      paquetId,
    });
    revalidatePath("/coran/hifz");
    revalidatePath("/cartes");
    return { message: resultat.message };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

/* ────────────────────────── Mot à mot ────────────────────────── */

/** L'analyse d'un mot. Appelée à l'appui, sans quitter la sourate. */
export async function analyser(
  versetNumero: number,
  position: number,
): Promise<MotAffiche | null> {
  if (!Number.isInteger(versetNumero) || !Number.isInteger(position)) return null;
  return analyserMot(versetNumero, position);
}

export async function apprendreMot(
  versetNumero: number,
  position: number,
  parRacine: boolean,
): Promise<Retour> {
  try {
    const resultat = await apprendreMotDuCoran(versetNumero, position, parRacine);
    revalidatePath("/coran/vocabulaire");
    revalidatePath("/cartes");
    return { message: `${resultat.message} Paquet « ${resultat.paquet} ».` };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

/* ───────────────────── Remise à zéro du suivi ───────────────────── */

/**
 * Efface le suivi de lecture. Les cartes et leur historique ne sont jamais
 * touchés : recommencer un cycle de lecture n'a aucune raison de défaire une
 * mémorisation.
 */
export async function remettreAZero(sourate: number | null): Promise<Retour> {
  if (sourate !== null && (!Number.isInteger(sourate) || sourate < 1 || sourate > 114)) {
    return { erreur: "Sourate inconnue." };
  }

  try {
    const bilan = await remettreLectureAZero(sourate);
    revalidatePath("/coran");
    revalidatePath("/coran/reglages");
    return {
      message:
        `${bilan.seances} séance(s) et ${bilan.positions} position(s) effacées. ` +
        "Les cartes n'ont pas bougé.",
    };
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
  const tailleTranslitteration = entier(donnees.get("tailleTranslitteration"), 12, 48);
  const tailleTraduction = entier(donnees.get("tailleTraduction"), 12, 40);
  const objectif = entier(donnees.get("objectifQuotidien"), 1, 6236);

  if (!RECITEURS.some((r) => r.cle === reciteur)) return { erreur: "Récitateur inconnu." };
  if (!POLICES.some((p) => p.cle === police)) return { erreur: "Police inconnue." };
  if (!(UNITES as string[]).includes(unite)) return { erreur: "Unité inconnue." };
  if (taille === null) return { erreur: "La taille de l'arabe doit rester entre 18 et 64." };
  if (tailleTranslitteration === null) {
    return { erreur: "La taille de la translittération doit rester entre 12 et 48." };
  }
  if (tailleTraduction === null) {
    return { erreur: "La taille de la traduction doit rester entre 12 et 40." };
  }
  if (objectif === null) return { erreur: "Objectif hors limites." };

  try {
    await enregistrerReglagesCoran({
      reciteur,
      policeArabe: police,
      uniteObjectif: unite as UniteObjectif,
      tailleArabe: taille,
      tailleTranslitteration,
      tailleTraduction,
      modeMemorisation: donnees.get("modeMemorisation") !== null,
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

/**
 * Charge une sourate voisine, pour l'enchaînement continu du lecteur.
 *
 * Le lecteur la demande quand on approche d'un bout, et la met à la suite — ou
 * en tête — de ce qui est déjà affiché. Rend `null` aux extrémités du moushaf.
 */
export async function chargerSourateVoisine(
  numeroSourate: number,
): Promise<TrancheSourate | null> {
  return chargerTrancheSourate(numeroSourate);
}

/* ─────────────────────────── Modes d'écoute ─────────────────────────── */

/**
 * Enregistre le mode d'écoute et ses réglages.
 *
 * Appelée depuis la barre de lecture, à chaque changement : le mode doit être
 * retrouvé tel quel à la session suivante. Aucune revalidation — rafraîchir la
 * route courante rechargerait le lecteur et perdrait la place.
 */
export async function sauverEcoute(valeurs: {
  modeEcoute?: ModeEcoute;
  repetitions?: number;
  pauseRepetitionDs?: number;
  vitesseCent?: number;
}): Promise<void> {
  const modes: ModeEcoute[] = ["enchainement", "verset_boucle", "passage_boucle"];
  const propre: Parameters<typeof enregistrerReglagesCoran>[0] = {};

  if (valeurs.modeEcoute && modes.includes(valeurs.modeEcoute)) {
    propre.modeEcoute = valeurs.modeEcoute;
  }
  // 0 vaut « sans fin » ; au-delà de 99 on ne compte plus, on boucle.
  if (Number.isInteger(valeurs.repetitions)) {
    propre.repetitions = Math.min(99, Math.max(0, valeurs.repetitions!));
  }
  // De zéro à cinq secondes : c'est dans ce silence qu'on récite à voix haute.
  if (Number.isInteger(valeurs.pauseRepetitionDs)) {
    propre.pauseRepetitionDs = Math.min(50, Math.max(0, valeurs.pauseRepetitionDs!));
  }
  if (Number.isInteger(valeurs.vitesseCent)) {
    propre.vitesseCent = valeurs.vitesseCent === 75 ? 75 : 100;
  }

  if (Object.keys(propre).length > 0) await enregistrerReglagesCoran(propre);
}
