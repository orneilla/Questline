/**
 * Ce que les piliers partagent entre le serveur et l'écran — logique pure.
 *
 * Le module qui lit la base est `server-only` ; les composants qui affichent un
 * nom de pilier sont des composants client. Les types, les valeurs d'origine et
 * les quelques fonctions sans effet vivent donc ici.
 *
 * Rien dans ce fichier ne suppose qu'il y a six piliers, ni lesquels.
 */

export type PilierAffiche = {
  cle: string;
  nom: string;
  couleur: string;
  ordre: number;
};

/**
 * Les six piliers d'origine.
 *
 * Ils ne sont plus une vérité : ils sont ce que la migration a écrit en base,
 * et ce que l'app affiche si elle n'arrive pas à lire la table — mieux vaut
 * des noms justes qu'un écran vide. Modifier cette liste ne modifie rien
 * pour une base déjà installée.
 */
export const PILIERS_ORIGINE: PilierAffiche[] = [
  { cle: "deen", nom: "Deen", couleur: "#6fa396", ordre: 1 },
  { cle: "corps", nom: "Corps", couleur: "#8fa37e", ordre: 2 },
  { cle: "table", nom: "Table", couleur: "#c0826c", ordre: 3 },
  { cle: "savoir", nom: "Savoir", couleur: "#7e92b8", ordre: 4 },
  { cle: "oeuvre", nom: "Œuvre", couleur: "#c2a567", ordre: 5 },
  { cle: "seve", nom: "Sève", couleur: "#9c8fb4", ordre: 6 },
];

/**
 * Teintes proposées à la création : sourdes, désaturées. Aucune couleur
 * d'alerte, aucun rouge — rien ici ne doit ressembler à un reproche.
 */
export const TEINTES_PILIERS: string[] = [
  "#6fa396",
  "#8fa37e",
  "#c0826c",
  "#7e92b8",
  "#c2a567",
  "#9c8fb4",
  "#8a9ba8",
  "#b58a93",
  "#a8926f",
  "#7f9c8a",
];

export const COULEUR_REPLI = "#8a8f98";

/** Le nom affiché d'un pilier. Sa clé, à défaut : jamais un trou. */
export function nomPilier(liste: PilierAffiche[], cle: string | null): string {
  if (!cle) return "";
  return liste.find((p) => p.cle === cle)?.nom ?? cle;
}

export function couleurPilier(liste: PilierAffiche[], cle: string | null): string {
  if (!cle) return COULEUR_REPLI;
  return liste.find((p) => p.cle === cle)?.couleur ?? COULEUR_REPLI;
}

/**
 * La clé déduite d'un nom : minuscules, sans accent, sans espace.
 *
 * Elle est posée une fois à la création et ne bouge plus ensuite, même si le
 * nom change — c'est elle que portent les arcs, l'élan et les tâches, et la
 * renommer en cascade pour une correction d'orthographe serait absurde.
 */
export function clePropre(nom: string): string {
  const plie = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return plie.slice(0, 40);
}

/** Une couleur hexadécimale à six chiffres, la seule forme que l'app écrit. */
export function couleurValide(valeur: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(valeur);
}
