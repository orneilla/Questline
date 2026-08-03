import type { Notation } from "./fsrs";

/**
 * File d'apprentissage d'une session.
 *
 * Le principe, repris d'Anki : une carte ne quitte pas la session tant qu'elle
 * n'est pas sue. « Encore » et « Difficile » la replacent dans la file à court
 * terme — pas à la fin, pas dans une file séparée : à un instant précis, au
 * milieu des autres. La session ne s'achève que lorsque la file est vide.
 *
 * Tout est ici en mémoire et sans effet de bord : c'est ce qui permet à une
 * session déjà chargée de continuer sans réseau, et de la tester intervalle
 * par intervalle.
 */

export type EntreeFile = {
  carteId: number;
  /** Millisecondes depuis le début de session avant de pouvoir resservir. */
  disponibleA: number;
  /** Nombre de fois que la carte a été vue dans cette session. */
  passages: number;
  /** Vraie tant que la carte n'a pas été sue une fois dans la session. */
  enApprentissage: boolean;
};

export type ReglagesFile = {
  /** Minutes avant réapparition après « Encore ». */
  delaiEncoreMin: number;
  /** Minutes avant réapparition après « Difficile ». */
  delaiDifficileMin: number;
};

export const REGLAGES_FILE_DEFAUT: ReglagesFile = {
  delaiEncoreMin: 1,
  delaiDifficileMin: 6,
};

export type File = readonly EntreeFile[];

export function creerFile(carteIds: readonly number[]): File {
  return carteIds.map((carteId) => ({
    carteId,
    disponibleA: 0,
    passages: 0,
    enApprentissage: false,
  }));
}

/**
 * La prochaine carte à montrer.
 *
 * Si aucune n'est encore due mais que la file n'est pas vide, on sert quand
 * même la plus proche : attendre en silence serait pire que de réviser une
 * carte trente secondes trop tôt, et cela garantit que la session se termine.
 */
export function prochaine(file: File, maintenant: number): EntreeFile | null {
  if (file.length === 0) return null;

  const prete = file.filter((e) => e.disponibleA <= maintenant);
  const bassin = prete.length > 0 ? prete : file;

  return bassin.reduce((meilleure, e) =>
    e.disponibleA < meilleure.disponibleA ? e : meilleure,
  );
}

/** Vraie quand la notation garde la carte dans la session. */
export function resteDansLaSession(note: Notation): boolean {
  return note === 1 || note === 2;
}

/**
 * Applique une notation à la file.
 *
 * « Encore » et « Difficile » réinsèrent la carte après leur délai respectif ;
 * « Correct » et « Facile » l'en retirent — c'est FSRS qui prend le relais.
 */
export function noter(
  file: File,
  carteId: number,
  note: Notation,
  reglages: ReglagesFile,
  maintenant: number,
): File {
  const entree = file.find((e) => e.carteId === carteId);
  if (!entree) return file;

  const sans = file.filter((e) => e.carteId !== carteId);
  if (!resteDansLaSession(note)) return sans;

  const delaiMin = note === 1 ? reglages.delaiEncoreMin : reglages.delaiDifficileMin;

  return [
    ...sans,
    {
      carteId,
      disponibleA: maintenant + delaiMin * 60_000,
      passages: entree.passages + 1,
      enApprentissage: true,
    },
  ];
}

export type Restant = {
  /** Cartes encore à voir, tous états confondus. */
  total: number;
  nouvelles: number;
  apprentissage: number;
  mures: number;
};

/**
 * Le compteur affiché pendant la session. Les cartes retombées dans la file
 * comptent comme « en apprentissage », quel que soit leur état en base.
 */
export function restant(
  file: File,
  etatsInitiaux: ReadonlyMap<number, "nouvelle" | "mure">,
): Restant {
  let nouvelles = 0;
  let apprentissage = 0;
  let mures = 0;

  for (const entree of file) {
    if (entree.enApprentissage) apprentissage += 1;
    else if (etatsInitiaux.get(entree.carteId) === "nouvelle") nouvelles += 1;
    else mures += 1;
  }

  return { total: file.length, nouvelles, apprentissage, mures };
}

export function sessionTerminee(file: File): boolean {
  return file.length === 0;
}
