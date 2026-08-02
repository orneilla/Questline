import { PART_QUETES, formaterDuree } from "./temps";
import type { TypeJour } from "@/db/schema";

/**
 * Règles de charge.
 *
 * Le nombre de quêtes ne vient plus d'une étiquette posée sur la journée mais
 * du temps qui reste vraiment. Les quêtes proposées doivent en outre tenir
 * dans 40 % de ce temps : de quoi remplir la journée sans la saturer.
 */

export type Charge = {
  /** Minutes d'éveil réellement libres. */
  tempsDispoMin: number;
  niveau: TypeJour;
  /** Lendemain d'un créneau qui a mordu sur la nuit. */
  recuperation: boolean;
  modeBas: boolean;
  /** Nombre de quêtes proposées aujourd'hui. */
  nombreQuetes: number;
  /** La quête du jour doit être une version minimale. */
  exigeMinimale: boolean;
  /** Somme maximale des durées proposées. */
  budgetMinutes: number;
};

const SEUIL_PLEINE_MIN = 2 * 60;
const SEUIL_CHARGEE_MIN = 4 * 60;

export function niveauDe(tempsDispoMin: number): TypeJour {
  if (tempsDispoMin < SEUIL_PLEINE_MIN) return "pleine";
  if (tempsDispoMin <= SEUIL_CHARGEE_MIN) return "chargee";
  return "libre";
}

export function calculerCharge(entree: {
  tempsDispoMin: number;
  recuperation: boolean;
  modeBas: boolean;
}): Charge {
  const { tempsDispoMin, recuperation, modeBas } = entree;
  const niveau = niveauDe(tempsDispoMin);

  const base = niveau === "pleine" ? 1 : niveau === "chargee" ? 2 : 3;

  // Un jour de récupération porte une quête de moins — mais jamais aucune :
  // une journée sans proposition serait une punition, pas un repos.
  const apresRecuperation = recuperation ? Math.max(1, base - 1) : base;

  return {
    tempsDispoMin,
    niveau,
    recuperation,
    modeBas,
    nombreQuetes: modeBas ? 1 : apresRecuperation,
    exigeMinimale: modeBas || niveau === "pleine",
    budgetMinutes: Math.round(tempsDispoMin * PART_QUETES),
  };
}

const NOMS: Record<TypeJour, string> = {
  libre: "Journée libre",
  chargee: "Journée chargée",
  pleine: "Journée pleine",
};

/** « Journée chargée · 2h30 dispo », affiché sous la date. */
export function libelleCharge(charge: Charge): string {
  if (charge.modeBas) return "Jour bas · un seul geste";
  const suffixe = charge.recuperation ? " · récupération" : "";
  return `${NOMS[charge.niveau]} · ${formaterDuree(charge.tempsDispoMin)} dispo${suffixe}`;
}
