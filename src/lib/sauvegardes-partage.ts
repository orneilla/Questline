/**
 * Ce que la sauvegarde partage avec l'écran — logique pure.
 *
 * Le module de sauvegarde est `server-only` : il lit et écrit la base. Mais le
 * fichier déposé, lui, est analysé dans le navigateur — il pèse plusieurs
 * mégaoctets, et une action serveur plafonne à un seul. Les types, la liste des
 * tables et l'analyse du fichier vivent donc ici, sans dépendance.
 */

export const VERSION = 1;

/**
 * Les tables sauvegardées, dans l'ordre où il faut les réécrire : une table qui
 * en référence une autre vient après elle. La suppression suit l'ordre inverse.
 */
export const NOMS_TABLES = [
  "espaces",
  "paquets",
  "cartes",
  "revisions",
  "sessionsRevision",
  "arcs",
  "etapesArc",
  "quetes",
  "validations",
  "seuilsArcs",
  "taches",
  "journees",
  "quetesRaresFaites",
  "momentum",
  "saisons",
  "creneauxRecurrents",
  "evenements",
  "positionLecture",
  "positionsSourate",
  "seancesLecture",
  "marquePages",
  "reglagesCartes",
  "reglagesCoran",
] as const;

export type NomTable = (typeof NOMS_TABLES)[number];

export function estNomTable(valeur: string): valeur is NomTable {
  return (NOMS_TABLES as readonly string[]).includes(valeur);
}

export type ContenuSauvegarde = {
  version: number;
  creeeLe: string;
  tables: Partial<Record<NomTable, unknown[]>>;
};

export type ResumeSauvegarde = Partial<Record<NomTable, number>>;

export type FicheSauvegarde = {
  id: number;
  creeeLe: string;
  octets: number;
  resume: ResumeSauvegarde;
};

export class SauvegardeIllisible extends Error {}

/**
 * Lit un fichier déposé et dit ce qu'il contient, sans rien écrire.
 *
 * C'est la moitié qui compte : on ne restaure pas à l'aveugle. Le compte par
 * table est affiché, et la comparaison avec ce qui est en base montre ce qui
 * sera remplacé avant que ça le soit.
 */
export function analyserSauvegarde(texte: string): {
  contenu: ContenuSauvegarde;
  resume: ResumeSauvegarde;
  inconnues: string[];
} {
  let lu: unknown;
  try {
    lu = JSON.parse(texte);
  } catch (erreur) {
    throw new SauvegardeIllisible(
      `Ce fichier n'est pas du JSON : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    );
  }

  const contenu = lu as ContenuSauvegarde;
  if (
    typeof contenu !== "object" ||
    contenu === null ||
    typeof contenu.tables !== "object" ||
    contenu.tables === null
  ) {
    throw new SauvegardeIllisible(
      "Ce fichier n'a pas la forme d'une sauvegarde Questline : il lui manque " +
        "l'objet « tables ».",
    );
  }

  if (contenu.version !== VERSION) {
    throw new SauvegardeIllisible(
      `Sauvegarde de version ${String(contenu.version)}, alors que cette ` +
        `application lit la version ${VERSION}.`,
    );
  }

  const resume: ResumeSauvegarde = {};
  const inconnues: string[] = [];

  for (const [nom, lignes] of Object.entries(contenu.tables)) {
    if (!estNomTable(nom)) {
      inconnues.push(nom);
      continue;
    }
    resume[nom] = Array.isArray(lignes) ? lignes.length : 0;
  }

  return { contenu, resume, inconnues };
}
