import type { Pilier } from "@/db/schema";

export const PILIERS: readonly Pilier[] = [
  "corps",
  "deen",
  "academique",
  "ornacre",
  "nutrition",
] as const;

export const LIBELLES_PILIERS: Record<Pilier, string> = {
  corps: "Corps",
  deen: "Deen",
  academique: "Académique",
  ornacre: "Ornacre",
  nutrition: "Nutrition",
};

/**
 * Teintes sourdes, désaturées : de quoi distinguer les piliers sans jamais
 * crier. Aucune couleur d'alerte, aucun rouge.
 */
export const COULEURS_PILIERS: Record<Pilier, string> = {
  corps: "#8FA37E",
  deen: "#6FA396",
  academique: "#7E92B8",
  ornacre: "#C0996A",
  nutrition: "#B58A93",
};

/** Plafond d'affichage de l'élan. */
export const MOMENTUM_MAX = 100;

/** Décroissance appliquée pour chaque jour sans validation sur un pilier. */
export const TAUX_DECROISSANCE = 0.05;

/** Jours de silence à partir desquels la reprise vaut double. */
export const SEUIL_REPRISE_JOURS = 2;

/** Au-delà, une quête n'est plus « courte ». */
export const SEUIL_QUETE_COURTE_MIN = 30;

/** Nombre de quêtes proposées selon la charge de la journée. */
export const QUOTA_QUETES: Record<"libre" | "cours" | "shift", number> = {
  libre: 3,
  cours: 2,
  shift: 1,
};

export const JOURS_SEMAINE = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const;

export const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;
