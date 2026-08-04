/**
 * Ce que la recherche partage avec l'écran — logique pure.
 *
 * Le module de recherche est `server-only` : il interroge la base. Le composant
 * qui affiche les résultats est un composant client. Les types et les libellés
 * dont les deux ont besoin vivent donc ici, dans un fichier qui ne touche ni à
 * la base ni au réseau — sans quoi le paquet client tirerait tout le serveur
 * avec lui et la compilation échouerait.
 */

export type TypeResultat =
  | "carte"
  | "verset"
  | "vocabulaire"
  | "quete"
  | "arc"
  | "tache";

export const LIBELLES_TYPES: Record<TypeResultat, string> = {
  carte: "Cartes",
  verset: "Versets",
  vocabulaire: "Vocabulaire arabe",
  quete: "Quêtes",
  arc: "Arcs",
  tache: "Tâches",
};

export type Resultat = {
  type: TypeResultat;
  /** Ligne principale. */
  titre: string;
  /** Contexte : le paquet, la sourate, l'arc… */
  detail: string;
  /** Où le toucher mène. Jamais une page d'accueil. */
  lien: string;
};

export type GroupeResultats = {
  type: TypeResultat;
  libelle: string;
  total: number;
  resultats: Resultat[];
};
