import type { NutrimentCle } from "./ciqual";
import {
  couvertureCumulee,
  couvertureIncomplete,
  nutrimentsSansValeur,
} from "./instantane";
import { NUTRIMENTS, type Totaux } from "./nutrition";
import type { Couverture, PrecisionSaisie, Repas } from "@/db/cuisine";

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
  /** Ce que vaut cette entrée. Une clé absente ou nulle = valeur inconnue. */
  valeurs: Partial<Record<NutrimentCle, number | null>>;
  /** Part du poids couverte par une donnée réelle, nutriment par nutriment. */
  couverture: Couverture;
  /** Les ingrédients qu'aucune fiche ne couvre — nommés, pas seulement comptés. */
  sansFiche: string[];
  /** Grammes crus équivalents de ce qui a été mangé. Pondère la couverture. */
  poidsRetenuG: number | null;
  /** L'origine, quand elle existe encore. */
  origine: "recette" | "aliment";
  recetteId: number | null;
  alimentId: number | null;
  /** Ce qui se corrige : l'assiette d'une recette, ou les grammes d'un aliment. */
  poidsAssietteG: number | null;
  quantiteG: number | null;
  /** Poids total cuit figé à la saisie : dit si « pesé » est seulement possible. */
  poidsTotalCuitG: number | null;
  nbPortions: number;
  dateModification: string | null;
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
  /** Couverture du jour, pondérée par le poids de chaque entrée. */
  couverture: Couverture;
  nbPesees: number;
  nbEstimees: number;
};

export function sommerJour(date: string, entrees: EntreeJournal[]): Jour {
  const totaux: Totaux = {};

  for (const entree of entrees) {
    for (const cle of NUTRIMENTS) {
      const valeur = entree.valeurs[cle];
      if (valeur === null || valeur === undefined) continue;
      totaux[cle] = (totaux[cle] ?? 0) + valeur;
    }
  }

  return {
    date,
    entrees,
    totaux,
    couverture: couvertureCumulee(entrees),
    nbPesees: entrees.filter((e) => e.precision === "pese").length,
    nbEstimees: entrees.filter((e) => e.precision === "estime").length,
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
export type Repartition = {
  proteines: number;
  glucides: number;
  lipides: number;
  /** L'énergie reconstituée aux facteurs d'Atwater, par jour renseigné. */
  energieAtwater: number;
  /** L'énergie telle que Ciqual la donne, pour la même période. */
  energieCiqual: number | null;
};

export const FACTEURS_ATWATER = { proteines: 4, glucides: 4, lipides: 9 } as const;

/**
 * Les trois parts, calculées sur le total d'Atwater et non sur l'énergie Ciqual.
 *
 * Les deux ne tombent pas juste, et c'est normal : Ciqual applique sa propre
 * convention, qui compte notamment les fibres et les polyols. Rapporter des
 * parts en 4/4/9 à une énergie Ciqual donnerait trois pourcentages sommant à
 * 96 ou 103 %, ce qui se lit comme une erreur alors que c'est un écart de
 * conventions. On normalise donc sur le total reconstitué, et on affiche
 * l'énergie Ciqual à part, en la nommant.
 */
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
    energieAtwater: somme,
    energieCiqual: totaux.kcal100g ?? null,
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
  repartition: Repartition | null;
  /** Couverture de la semaine, pondérée par le poids. */
  couverture: Couverture;
  /** Nutriments dont la couverture n'atteint pas 100 %, toutes causes. */
  incomplets: NutrimentCle[];
  /** Ceux dont le trou vient d'une fiche muette, et non d'un ingrédient sans fiche. */
  sansValeur: NutrimentCle[];
  /** Les ingrédients sans fiche croisés cette semaine, nommés une seule fois. */
  sansFiche: string[];
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
  const entrees = jours.flatMap((j) => j.entrees);
  const totalSemaine: Totaux = {};

  for (const jour of renseignes) {
    for (const cle of NUTRIMENTS) {
      if (jour.totaux[cle] !== undefined) {
        totalSemaine[cle] = (totalSemaine[cle] ?? 0) + jour.totaux[cle]!;
      }
    }
  }

  const moyenne: Totaux = {};
  if (renseignes.length > 0) {
    for (const cle of NUTRIMENTS) {
      if (totalSemaine[cle] !== undefined) {
        moyenne[cle] = totalSemaine[cle]! / renseignes.length;
      }
    }
  }

  const couverture = couvertureCumulee(entrees);
  const moyennePourRepartition: Totaux = {};
  for (const cle of NUTRIMENTS) {
    if (moyenne[cle] !== undefined) moyennePourRepartition[cle] = moyenne[cle]!;
  }

  return {
    debut,
    fin: jours[jours.length - 1]?.date ?? debut,
    jours,
    moyenne,
    joursRenseignes: renseignes.length,
    nbEntrees: entrees.length,
    nbPesees: entrees.filter((e) => e.precision === "pese").length,
    repartition: repartir(moyennePourRepartition),
    couverture,
    incomplets: couvertureIncomplete(couverture),
    sansValeur: nutrimentsSansValeur(couverture),
    sansFiche: [...new Set(entrees.flatMap((e) => e.sansFiche))],
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
