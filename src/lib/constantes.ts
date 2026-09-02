/**
 * Les piliers ne sont plus ici.
 *
 * Ils se renomment, se recolorient et se suppriment : les garder en constantes
 * aurait figé ce qui doit bouger. Ils vivent en base — `chargerPiliers()` côté
 * serveur, `usePiliers()` côté écran.
 */

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
