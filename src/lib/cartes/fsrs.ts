import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as CarteFsrs,
  type FSRS,
  type Grade,
} from "ts-fsrs";

import type { EtatCarte } from "@/db/schema";

/**
 * Enveloppe autour de ts-fsrs.
 *
 * Les paliers d'apprentissage internes de ts-fsrs sont désactivés : c'est la
 * file de session (voir `file.ts`) qui joue ce rôle, exactement comme Anki.
 * Sans cela, « Correct » rendrait un intervalle de quelques minutes au lieu de
 * faire sortir la carte de la session avec un intervalle en jours.
 */

/** 1 Encore · 2 Difficile · 3 Correct · 4 Facile. */
export type Notation = 1 | 2 | 3 | 4;

export const NOTATIONS: { note: Notation; libelle: string }[] = [
  { note: 1, libelle: "Encore" },
  { note: 2, libelle: "Difficile" },
  { note: 3, libelle: "Correct" },
  { note: 4, libelle: "Facile" },
];

/** Au-delà, une carte est réputée mûre — convention Anki. */
export const SEUIL_MATURITE_JOURS = 21;

export type ReglagesFsrs = {
  retentionCible: number;
  poidsFsrs: number[];
};

export type MemoireCarte = {
  stabilite: number;
  difficulte: number;
  /** Nulle pour une carte jamais vue. */
  derniereRevision: Date | null;
  rechutes: number;
  passages: number;
};

export type Planification = {
  stabilite: number;
  difficulte: number;
  /** Intervalle accordé, en jours. */
  intervalle: number;
  echeance: Date;
  etat: EtatCarte;
};

/** `Grade` exclut Rating.Manual, seul indexable dans l'aperçu de ts-fsrs. */
const RATINGS: Record<Notation, Grade> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
};

function moteur(reglages: ReglagesFsrs): FSRS {
  return fsrs(
    generatorParameters({
      request_retention: reglages.retentionCible,
      ...(reglages.poidsFsrs.length > 0 ? { w: reglages.poidsFsrs } : {}),
      // La file de session tient lieu de paliers.
      learning_steps: [],
      relearning_steps: [],
    }),
  );
}

function versFsrs(memoire: MemoireCarte, maintenant: Date): CarteFsrs {
  const vide = createEmptyCard(maintenant);
  if (!memoire.derniereRevision) return vide;

  const ecoule = Math.max(
    0,
    (maintenant.getTime() - memoire.derniereRevision.getTime()) / 86_400_000,
  );

  return {
    ...vide,
    due: maintenant,
    stability: memoire.stabilite,
    difficulty: memoire.difficulte,
    elapsed_days: ecoule,
    scheduled_days: Math.round(ecoule),
    reps: memoire.passages,
    lapses: memoire.rechutes,
    state: State.Review,
    // Sans cette date, ts-fsrs considère qu'aucun temps ne s'est écoulé : la
    // rétention reste à 1, la stabilité ne progresse plus et les intervalles
    // plafonnent au bout de deux révisions.
    last_review: memoire.derniereRevision,
  };
}

/** Détermine l'état affiché à partir de l'intervalle accordé. */
export function etatDepuisIntervalle(intervalleJours: number): EtatCarte {
  if (intervalleJours < 1) return "apprentissage";
  if (intervalleJours < SEUIL_MATURITE_JOURS) return "jeune";
  return "mure";
}

/** Ce que donnerait chaque notation, sans rien écrire. Sert à afficher les intervalles. */
export function apercuIntervalles(
  memoire: MemoireCarte,
  reglages: ReglagesFsrs,
  maintenant: Date = new Date(),
): Record<Notation, Planification> {
  const f = moteur(reglages);
  const carte = versFsrs(memoire, maintenant);
  const resultats = f.repeat(carte, maintenant);

  const sortie = {} as Record<Notation, Planification>;
  for (const note of [1, 2, 3, 4] as const) {
    const { card } = resultats[RATINGS[note]];
    const intervalle = Math.max(
      0,
      (card.due.getTime() - maintenant.getTime()) / 86_400_000,
    );
    sortie[note] = {
      stabilite: card.stability,
      difficulte: card.difficulty,
      intervalle,
      echeance: card.due,
      etat: etatDepuisIntervalle(intervalle),
    };
  }
  return sortie;
}

export function planifier(
  memoire: MemoireCarte,
  note: Notation,
  reglages: ReglagesFsrs,
  maintenant: Date = new Date(),
): Planification {
  return apercuIntervalles(memoire, reglages, maintenant)[note];
}

/** « 10 min », « 2 j », « 1,5 mois », « 2,1 ans ». */
export function formaterIntervalle(jours: number): string {
  if (jours < 1 / 24) return `${Math.max(1, Math.round(jours * 1440))} min`;
  if (jours < 1) return `${Math.round(jours * 24)} h`;
  if (jours < 30) return `${Math.round(jours)} j`;
  if (jours < 365) return `${(jours / 30).toFixed(1).replace(".", ",")} mois`;
  return `${(jours / 365).toFixed(1).replace(".", ",")} ans`;
}
