import type { Pilier } from "@/db/schema";

export const PILIERS: readonly Pilier[] = [
  "deen",
  "corps",
  "table",
  "savoir",
  "oeuvre",
  "seve",
] as const;

export const LIBELLES_PILIERS: Record<Pilier, string> = {
  deen: "Deen",
  corps: "Corps",
  table: "Table",
  savoir: "Savoir",
  oeuvre: "Œuvre",
  seve: "Sève",
};

/**
 * Teintes sourdes, désaturées : de quoi distinguer les piliers sans jamais
 * crier. Aucune couleur d'alerte, aucun rouge.
 */
export const COULEURS_PILIERS: Record<Pilier, string> = {
  deen: "#6fa396",
  corps: "#8fa37e",
  table: "#c0826c",
  savoir: "#7e92b8",
  oeuvre: "#c2a567",
  seve: "#9c8fb4",
};

/** Plafond d'affichage de l'élan. */
export const MOMENTUM_MAX = 100;

/** Décroissance appliquée pour chaque jour sans validation sur un pilier. */
export const TAUX_DECROISSANCE = 0.05;

/** Jours de silence à partir desquels la reprise vaut double. */
export const SEUIL_REPRISE_JOURS = 2;

/** Au-delà, une quête n'est plus « courte ». */
export const SEUIL_QUETE_COURTE_MIN = 30;

/** Fenêtre glissante sur laquelle se compte la fréquence hebdomadaire. */
export const FENETRE_FREQUENCE_JOURS = 7;

/** Nombre de quêtes proposées selon la charge de la journée. */
export const QUOTA_QUETES: Record<"libre" | "reduit" | "shift", number> = {
  libre: 3,
  reduit: 2,
  shift: 1,
};

/**
 * Jours allégés d'office : récupération après le shift de nuit du samedi
 * (22 h – 4 h). Le dimanche porte en plus son propre shift du soir, ce qui
 * l'allège davantage encore.
 */
export const JOURS_ALLEGES: readonly number[] = [0, 1];

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
