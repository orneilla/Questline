import type { NutrimentCle } from "./ciqual";
import { NUTRIMENTS, type Totaux } from "./nutrition";
import type { PrecisionSaisie, Repas } from "@/db/cuisine";

/**
 * L'agrégation du journal — logique pure, sans base ni réseau.
 *
 * Ce module ne fait qu'additionner et compter. Il ne juge rien : pas
 * d'objectif, pas de seuil, pas de score. Une tendance se regarde, elle ne se
 * réussit pas.
 *
 * Sa seule exigence est de ne jamais faire passer une approximation pour une
 * mesure. Un nutriment inconnu ne devient pas zéro, une entrée estimée ne se
 * confond pas avec une entrée pesée, et une moyenne dit toujours sur combien
 * de jours elle porte.
 */

export type EntreeJournal = {
  id: number;
  date: string;
  repas: Repas;
  libelle: string;
  precision: PrecisionSaisie;
  /** Faux quand un ingrédient sans fiche a été ignoré : totaux sous-estimés. */
  complet: boolean;
  /** Ce que vaut cette entrée. Une clé absente ou nulle = valeur inconnue. */
  valeurs: Partial<Record<NutrimentCle, number | null>>;
  /** L'origine, quand elle existe encore. */
  recetteId: number | null;
  alimentId: number | null;
  poidsG: number | null;
};

export const ORDRE_REPAS: Repas[] = ["matin", "midi", "soir", "collation"];

export const LIBELLES_REPAS: Record<Repas, string> = {
  matin: "Matin",
  midi: "Midi",
  soir: "Soir",
  collation: "Collation",
};

export const LIBELLES_PRECISION: Record<PrecisionSaisie, string> = {
  pese: "Pesé",
  estime: "Estimé",
};

/* ────────────────────── Un jour ────────────────────── */

export type Jour = {
  date: string;
  entrees: EntreeJournal[];
  /** Somme des valeurs connues. Une clé absente = personne ne l'a renseignée. */
  totaux: Totaux;
  /** Nutriments qu'au moins une entrée du jour ne donne pas. */
  troues: NutrimentCle[];
  nbPesees: number;
  nbEstimees: number;
  nbIncompletes: number;
};

export function sommerJour(date: string, entrees: EntreeJournal[]): Jour {
  const totaux: Totaux = {};
  const troues = new Set<NutrimentCle>();

  for (const entree of entrees) {
    for (const cle of NUTRIMENTS) {
      const valeur = entree.valeurs[cle];
      if (valeur === null || valeur === undefined) {
        troues.add(cle);
        continue;
      }
      totaux[cle] = (totaux[cle] ?? 0) + valeur;
    }
  }

  return {
    date,
    entrees,
    totaux,
    troues: NUTRIMENTS.filter((c) => troues.has(c)),
    nbPesees: entrees.filter((e) => e.precision === "pese").length,
    nbEstimees: entrees.filter((e) => e.precision === "estime").length,
    nbIncompletes: entrees.filter((e) => !e.complet).length,
  };
}

/* ────────────────────── Une semaine ────────────────────── */

/**
 * La part de l'énergie apportée par chaque macronutriment.
 *
 * Aux facteurs d'Atwater : 4 kcal par gramme de protéines, 4 pour les
 * glucides, 9 pour les lipides. Ce sont des conventions, pas des mesures —
 * l'écran les nomme plutôt que de faire apparaître trois pourcentages sortis
 * de nulle part. La somme est ramenée à 100 % de l'énergie ainsi reconstituée,
 * et non de l'énergie déclarée : les deux diffèrent toujours un peu, et
 * afficher un total à 97 % laisserait croire à une erreur.
 */
export type Repartition = { proteines: number; glucides: number; lipides: number };

export const FACTEURS_ATWATER = { proteines: 4, glucides: 4, lipides: 9 } as const;

export function repartir(totaux: Totaux): Repartition | null {
  const p = totaux.proteines100g;
  const g = totaux.glucides100g;
  const l = totaux.lipides100g;
  if (p === undefined || g === undefined || l === undefined) return null;

  const kp = p * FACTEURS_ATWATER.proteines;
  const kg = g * FACTEURS_ATWATER.glucides;
  const kl = l * FACTEURS_ATWATER.lipides;
  const somme = kp + kg + kl;
  if (somme <= 0) return null;

  return {
    proteines: (kp / somme) * 100,
    glucides: (kg / somme) * 100,
    lipides: (kl / somme) * 100,
  };
}

export type Semaine = {
  debut: string;
  fin: string;
  /** Les sept jours, y compris ceux sans entrée. */
  jours: Jour[];
  /** Moyenne par jour renseigné — jamais par jour de calendrier. */
  moyenne: Totaux;
  joursRenseignes: number;
  nbEntrees: number;
  nbPesees: number;
  nbIncompletes: number;
  repartition: Repartition | null;
  /** Nutriments qu'au moins une entrée de la semaine ne donne pas. */
  troues: NutrimentCle[];
};

/**
 * Assemble la semaine.
 *
 * La moyenne se divise par le nombre de jours renseignés, pas par sept : sur
 * trois jours notés, diviser par sept afficherait une consommation faussement
 * basse, et cette erreur-là passerait inaperçue longtemps.
 */
export function assemblerSemaine(debut: string, jours: Jour[]): Semaine {
  const renseignes = jours.filter((j) => j.entrees.length > 0);
  const totalSemaine: Totaux = {};
  const troues = new Set<NutrimentCle>();

  for (const jour of renseignes) {
    for (const cle of NUTRIMENTS) {
      if (jour.totaux[cle] !== undefined) {
        totalSemaine[cle] = (totalSemaine[cle] ?? 0) + jour.totaux[cle]!;
      }
    }
    for (const cle of jour.troues) troues.add(cle);
  }

  const moyenne: Totaux = {};
  if (renseignes.length > 0) {
    for (const cle of NUTRIMENTS) {
      if (totalSemaine[cle] !== undefined) {
        moyenne[cle] = totalSemaine[cle]! / renseignes.length;
      }
    }
  }

  return {
    debut,
    fin: jours[jours.length - 1]?.date ?? debut,
    jours,
    moyenne,
    joursRenseignes: renseignes.length,
    nbEntrees: jours.reduce((n, j) => n + j.entrees.length, 0),
    nbPesees: jours.reduce((n, j) => n + j.nbPesees, 0),
    nbIncompletes: jours.reduce((n, j) => n + j.nbIncompletes, 0),
    repartition: repartir(totalSemaine),
    troues: NUTRIMENTS.filter((c) => troues.has(c)),
  };
}

/**
 * La hauteur relative d'un jour dans la semaine, entre 0 et 1.
 *
 * Rapportée au jour le plus haut, pas à une valeur cible : il n'y en a pas.
 * Ce n'est qu'une échelle de lecture, elle ne dit pas si un jour est bon.
 */
export function hauteurs(jours: Jour[], cle: NutrimentCle): number[] {
  const valeurs = jours.map((j) => j.totaux[cle] ?? 0);
  const plafond = Math.max(...valeurs, 0);
  if (plafond <= 0) return valeurs.map(() => 0);
  return valeurs.map((v) => v / plafond);
}
