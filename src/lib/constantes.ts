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

/** Fenêtre glissante sur laquelle se compte la fréquence hebdomadaire. */
export const FENETRE_FREQUENCE_JOURS = 7;

export const JOURS_SEMAINE = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const;

/** Teintes des blocs d'emploi du temps, dans le même registre sourd. */
export const COULEURS_CRENEAUX: Record<string, string> = {
  cours: "#7e92b8",
  travail: "#c2a567",
  priere: "#6fa396",
  autre: "#8a8f98",
};

export const LIBELLES_CRENEAUX: Record<string, string> = {
  cours: "Cours",
  travail: "Travail",
  priere: "Prière",
  autre: "Autre",
};

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
