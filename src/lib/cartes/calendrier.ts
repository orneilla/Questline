import { decalerJours, ecartJours, jourDeLaSemaine } from "@/lib/dates";

/**
 * Le calendrier de révision.
 *
 * Une case par jour, les semaines en colonnes. Tout est calculé ici, à partir
 * de la seule liste des jours où quelque chose a été révisé : la grille, les
 * paliers de couleur et les séries. Aucune base, aucun composant — de quoi
 * vérifier la règle sans navigateur.
 */

export type JourRevision = { date: string; combien: number };

export type Case = {
  date: string;
  combien: number;
  /** 0 = rien ce jour-là, 1 à 5 du plus sombre au plus vif. */
  niveau: number;
  /** Faux pour les jours à venir de la semaine en cours : la grille est carrée,
   *  l'avenir ne l'est pas. */
  passe: boolean;
};

export type Grille = {
  colonnes: Case[][];
  /** Étiquette de mois posée sur la colonne où le mois commence. */
  mois: { colonne: number; libelle: string }[];
};

/** Nombre de colonnes affichées : douze mois glissants. */
export const SEMAINES = 53;

const MOIS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

export const JOURS_COURTS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Les quatre bornes qui séparent les cinq paliers de couleur.
 *
 * Calculées sur les quantiles des jours réellement travaillés, et non sur des
 * seuils fixes : l'échelle doit rester lisible qu'on révise vingt ou deux cents
 * cartes par jour. Quand l'historique est trop uniforme pour que les quantiles
 * se distinguent, on retombe sur une répartition linéaire — sans quoi tous les
 * jours se retrouveraient au même palier.
 */
export function calculerSeuils(valeurs: readonly number[]): number[] {
  const positives = valeurs.filter((v) => v > 0).sort((a, b) => a - b);
  if (positives.length === 0) return [0, 0, 0, 0];

  const minimum = positives[0];
  const maximum = positives[positives.length - 1];
  // Un seul volume connu : tout se place au palier du milieu.
  if (minimum === maximum) return [minimum - 1, minimum - 1, maximum, maximum];

  const quantile = (part: number) =>
    positives[Math.min(positives.length - 1, Math.floor(part * positives.length))];
  const bruts = [0.2, 0.4, 0.6, 0.8].map(quantile);

  if (new Set(bruts).size >= 3) return bruts;
  return [1, 2, 3, 4].map((rang) => minimum + ((maximum - minimum) * rang) / 5);
}

export function niveauPour(combien: number, seuils: readonly number[]): number {
  if (combien <= 0) return 0;
  return 1 + seuils.filter((seuil) => combien > seuil).length;
}

/** Le lundi de la semaine d'une date. */
function lundiDe(iso: string): string {
  // `jourDeLaSemaine` rend 0 pour dimanche : en France la semaine part du lundi.
  const jour = jourDeLaSemaine(iso);
  return decalerJours(iso, jour === 0 ? -6 : 1 - jour);
}

export function construireGrille(
  parJour: ReadonlyMap<string, number>,
  fin: string,
  seuils: readonly number[],
  semaines = SEMAINES,
): Grille {
  const dernierLundi = lundiDe(fin);
  const premierLundi = decalerJours(dernierLundi, -7 * (semaines - 1));

  const colonnes: Case[][] = [];
  const mois: { colonne: number; libelle: string }[] = [];
  let moisPrecedent = -1;

  for (let colonne = 0; colonne < semaines; colonne += 1) {
    const semaine: Case[] = [];

    for (let rang = 0; rang < 7; rang += 1) {
      const date = decalerJours(premierLundi, colonne * 7 + rang);
      const combien = parJour.get(date) ?? 0;
      semaine.push({
        date,
        combien,
        niveau: niveauPour(combien, seuils),
        passe: date <= fin,
      });
    }

    const numeroMois = Number(semaine[0].date.slice(5, 7)) - 1;
    if (numeroMois !== moisPrecedent) {
      mois.push({ colonne, libelle: MOIS[numeroMois] });
      moisPrecedent = numeroMois;
    }

    colonnes.push(semaine);
  }

  return { colonnes, mois };
}

export type Series = { meilleure: number; enCours: number };

/**
 * Les séries de jours consécutifs.
 *
 * La série en cours ne se brise pas parce qu'il est dix heures du matin : un
 * jour travaillé hier la maintient tant qu'aujourd'hui n'est pas fini. C'est la
 * seule façon honnête de la compter — sinon elle passerait à zéro chaque nuit,
 * ce qui n'apprend rien à personne.
 */
export function calculerSeries(
  jours: readonly JourRevision[],
  aujourdhui: string,
): Series {
  const dates = jours
    .filter((j) => j.combien > 0)
    .map((j) => j.date)
    .sort();
  if (dates.length === 0) return { meilleure: 0, enCours: 0 };

  let meilleure = 1;
  let courante = 1;
  for (let i = 1; i < dates.length; i += 1) {
    courante = ecartJours(dates[i - 1], dates[i]) === 1 ? courante + 1 : 1;
    if (courante > meilleure) meilleure = courante;
  }

  const derniere = dates[dates.length - 1];
  const ecart = ecartJours(derniere, aujourdhui);
  return { meilleure, enCours: ecart <= 1 ? courante : 0 };
}

export type Resume = {
  /** Révisions sur la fenêtre affichée. */
  total: number;
  /** Jours de la fenêtre où quelque chose a été révisé. */
  joursEtudies: number;
  /** Jours de la fenêtre déjà passés — le dénominateur honnête. */
  joursEcoules: number;
  /** Moyenne par jour écoulé, virgule comprise. */
  moyenne: number;
  /** Moyenne sur les seuls jours travaillés. */
  moyenneJoursEtudies: number;
};

/**
 * @param premierJour Première date où un historique existe. Les jours de la
 *   fenêtre qui la précèdent ne comptent pas : diviser par des journées
 *   antérieures à la première révision donnerait une moyenne fausse, et un
 *   pourcentage de jours étudiés qui accuse un passé qui n'a pas eu lieu.
 */
export function resumer(grille: Grille, premierJour?: string): Resume {
  const cases = grille.colonnes
    .flat()
    .filter((c) => c.passe && (!premierJour || c.date >= premierJour));
  const travaillees = cases.filter((c) => c.combien > 0);
  const total = travaillees.reduce((somme, c) => somme + c.combien, 0);

  return {
    total,
    joursEtudies: travaillees.length,
    joursEcoules: cases.length,
    moyenne: cases.length === 0 ? 0 : total / cases.length,
    moyenneJoursEtudies:
      travaillees.length === 0 ? 0 : total / travaillees.length,
  };
}

/** « 3 février 2026 », pour la case sur laquelle on vient d'appuyer. */
export function formaterJour(iso: string): string {
  const [annee, mois, jour] = iso.split("-");
  const noms = [
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
  ];
  const numero = Number(jour);
  return `${numero === 1 ? "1er" : numero} ${noms[Number(mois) - 1]} ${annee}`;
}
