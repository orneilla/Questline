/**
 * Les heures de prière, calculées ici et nulle part ailleurs.
 *
 * ── Ce que ce fichier est
 *
 * Un calcul de position du soleil, et rien d'autre. Pas d'appel réseau, pas de
 * service extérieur, pas de table d'horaires téléchargée : les mêmes entrées
 * donnent toujours les mêmes sorties, l'application marche hors ligne, et on
 * peut dire d'où sort chaque minute affichée.
 *
 * ── Ce qu'il ne décide pas
 *
 * Rien de religieux. Les angles de Fajr et d'Isha, l'ombre de l'Asr, la règle
 * des nuits courtes : ce sont des conventions publiées par des institutions,
 * elles se choisissent dans les réglages, et le fichier ne fait qu'appliquer
 * celle qu'on lui donne. Aucune valeur n'est inventée, aucune moyenne n'est
 * prise entre deux écoles, et l'écran nomme toujours la convention retenue.
 *
 * ── Sur quoi il repose
 *
 * Position du soleil par les formules de l'almanach astronomique (déclinaison
 * et équation du temps à partir du jour julien), puis angle horaire pour chaque
 * repère. C'est la méthode de référence des calendriers de prière ; elle donne
 * la minute, pas la seconde, et un écart d'une ou deux minutes avec le
 * calendrier d'une mosquée est normal — d'où la correction par prière, prévue
 * pour ça.
 */

/* ────────────────────── Trigonométrie en degrés ────────────────────── */

const RAD = Math.PI / 180;

const sin = (degres: number) => Math.sin(degres * RAD);
const cos = (degres: number) => Math.cos(degres * RAD);
const tan = (degres: number) => Math.tan(degres * RAD);
const arcsin = (x: number) => Math.asin(x) / RAD;
const arccos = (x: number) => Math.acos(x) / RAD;
const arctan2 = (y: number, x: number) => Math.atan2(y, x) / RAD;
const arccot = (x: number) => Math.atan(1 / x) / RAD;

function borner(valeur: number, tour: number): number {
  const reste = valeur - tour * Math.floor(valeur / tour);
  return reste < 0 ? reste + tour : reste;
}

const angleBorne = (a: number) => borner(a, 360);
const heureBornee = (h: number) => borner(h, 24);

/** L'écart de `depuis` vers `vers`, en heures, en passant par minuit au besoin. */
const ecartHeures = (depuis: number, vers: number) => heureBornee(vers - depuis);

/* ────────────────────── Position du soleil ────────────────────── */

function jourJulien(annee: number, mois: number, jour: number): number {
  let a = annee;
  let m = mois;
  if (m <= 2) {
    a -= 1;
    m += 12;
  }
  const siecle = Math.floor(a / 100);
  const gregorien = 2 - siecle + Math.floor(siecle / 4);
  return (
    Math.floor(365.25 * (a + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    jour +
    gregorien -
    1524.5
  );
}

type Soleil = { declinaison: number; equation: number };

function positionSoleil(jj: number): Soleil {
  const d = jj - 2451545.0;
  const anomalie = angleBorne(357.529 + 0.98560028 * d);
  const moyenne = angleBorne(280.459 + 0.98564736 * d);
  const longitude = angleBorne(
    moyenne + 1.915 * sin(anomalie) + 0.02 * sin(2 * anomalie),
  );
  const obliquite = 23.439 - 0.00000036 * d;
  const ascension = heureBornee(
    arctan2(cos(obliquite) * sin(longitude), cos(longitude)) / 15,
  );

  return {
    declinaison: arcsin(sin(obliquite) * sin(longitude)),
    equation: moyenne / 15 - ascension,
  };
}

/**
 * Angle du centre du soleil au lever et au coucher.
 *
 * Ni zéro ni un compte rond : le disque a un rayon apparent et l'atmosphère
 * courbe la lumière, si bien que le soleil est vu alors qu'il est déjà sous
 * l'horizon géométrique.
 */
const ANGLE_HORIZON = 0.833;

/* ────────────────────── Conventions ────────────────────── */

export type CleConvention =
  | "uoif"
  | "lim"
  | "isna"
  | "egypte"
  | "karachi"
  | "oummalqura";

export type Convention = {
  nom: string;
  /** Qui la publie. Affiché tel quel : on ne s'attribue pas ces chiffres. */
  source: string;
  /** Degrés du soleil sous l'horizon à l'entrée du Fajr. */
  angleFajr: number;
  /** Idem pour l'Isha, sauf quand la convention compte en minutes. */
  angleIsha?: number;
  /** Certaines conventions posent l'Isha à tant de minutes après le Maghrib. */
  minutesIsha?: number;
};

/**
 * Les conventions proposées.
 *
 * Ce sont les valeurs publiées par ces institutions, telles qu'on les trouve
 * dans les calendriers de prière courants. Je ne peux pas les vérifier à la
 * source depuis l'endroit où je tourne : c'est pour ça que l'écran demande de
 * les comparer une fois au calendrier de la mosquée, et qu'une correction par
 * prière existe.
 */
export const CONVENTIONS: Record<CleConvention, Convention> = {
  uoif: {
    nom: "UOIF — 12° / 12°",
    source: "Union des organisations islamiques de France",
    angleFajr: 12,
    angleIsha: 12,
  },
  lim: {
    nom: "Ligue islamique mondiale — 18° / 17°",
    source: "Muslim World League",
    angleFajr: 18,
    angleIsha: 17,
  },
  isna: {
    nom: "ISNA — 15° / 15°",
    source: "Islamic Society of North America",
    angleFajr: 15,
    angleIsha: 15,
  },
  egypte: {
    nom: "Égypte — 19,5° / 17,5°",
    source: "Autorité générale égyptienne de topographie",
    angleFajr: 19.5,
    angleIsha: 17.5,
  },
  karachi: {
    nom: "Karachi — 18° / 18°",
    source: "Université des sciences islamiques de Karachi",
    angleFajr: 18,
    angleIsha: 18,
  },
  oummalqura: {
    nom: "Umm al-Qura — 18,5° / Maghrib + 90 min",
    source: "Université Umm al-Qura, La Mecque",
    angleFajr: 18.5,
    minutesIsha: 90,
  },
};

export type EcoleAsr = "majorite" | "hanafite";

/** Longueur de l'ombre qui marque l'entrée de l'Asr, en plus de l'ombre de midi. */
const FACTEUR_ASR: Record<EcoleAsr, number> = { majorite: 1, hanafite: 2 };

export type RegleNuitCourte = "angle" | "moitie" | "septieme" | "aucune";

/* ────────────────────── Le calcul ────────────────────── */

export type Lieu = { latitude: number; longitude: number };

export type ParametresCalcul = {
  convention: CleConvention;
  ecoleAsr: EcoleAsr;
  nuitCourte: RegleNuitCourte;
};

/**
 * Les repères d'une journée, en minutes depuis minuit, heure locale.
 *
 * La valeur peut dépasser 1440 : sous nos latitudes l'Isha d'été tombe parfois
 * après minuit, et la garder telle quelle conserve l'ordre de la journée. C'est
 * l'affichage qui la ramène sur le cadran.
 */
export type Reperes = {
  fajr: number;
  lever: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
};

/**
 * Le même jeu, avant conversion en minutes : des heures décimales.
 *
 * Des heures, et non des fractions de journée. La distinction n'est pas
 * cosmétique : la position du soleil se demande à un instant exprimé en
 * fraction de jour, et passer 19,4 au lieu de 19,4/24 revient à interroger le
 * ciel dix-neuf jours plus tard. C'est `unTour` qui divise, une fois, au seul
 * endroit où la valeur sert d'instant.
 */
type Brut = Record<keyof Reperes, number>;

function heureDuMidi(jj: number, fraction: number): number {
  return heureBornee(12 - positionSoleil(jj + fraction).equation);
}

/**
 * L'heure à laquelle le soleil se trouve à un angle donné de l'horizon.
 *
 * Rend NaN quand cet angle n'est jamais atteint ce jour-là — c'est exactement
 * ce qui arrive à Paris en juin pour l'Isha, et ce n'est pas une erreur : la
 * nuit astronomique n'a pas lieu. La règle des nuits courtes prend le relais.
 */
function heureAngle(
  jj: number,
  latitude: number,
  angle: number,
  fraction: number,
  sens: "avant" | "apres",
): number {
  const { declinaison } = positionSoleil(jj + fraction);
  const midi = heureDuMidi(jj, fraction);
  const cosinus =
    (-sin(angle) - sin(declinaison) * sin(latitude)) /
    (cos(declinaison) * cos(latitude));
  if (cosinus > 1 || cosinus < -1) return Number.NaN;
  const demiArc = arccos(cosinus) / 15;
  return sens === "avant" ? midi - demiArc : midi + demiArc;
}

function heureAsr(
  jj: number,
  latitude: number,
  facteur: number,
  fraction: number,
): number {
  const { declinaison } = positionSoleil(jj + fraction);
  const angle = -arccot(facteur + tan(Math.abs(latitude - declinaison)));
  return heureAngle(jj, latitude, angle, fraction, "apres");
}

/**
 * La part de la nuit qui sert de repli quand l'angle n'est pas atteint.
 *
 * Trois règles reconnues, et la possibilité de n'en appliquer aucune. Sans
 * règle, l'écran dira franchement que l'heure n'existe pas ce jour-là plutôt
 * que d'inventer un chiffre.
 */
function portionNuit(angle: number, regle: RegleNuitCourte, nuit: number): number {
  switch (regle) {
    case "moitie":
      return nuit / 2;
    case "septieme":
      return nuit / 7;
    case "angle":
      return (angle / 60) * nuit;
    default:
      return Number.NaN;
  }
}

function corrigerNuitCourte(
  valeur: number,
  base: number,
  angle: number,
  nuit: number,
  sens: "avant" | "apres",
  regle: RegleNuitCourte,
): number {
  const portion = portionNuit(angle, regle, nuit);
  if (!Number.isFinite(portion)) return valeur;

  const ecart = sens === "avant" ? ecartHeures(valeur, base) : ecartHeures(base, valeur);
  if (!Number.isFinite(valeur) || ecart > portion) {
    return sens === "avant" ? base - portion : base + portion;
  }
  return valeur;
}

function unTour(
  jj: number,
  latitude: number,
  parametres: ParametresCalcul,
  precedent: Brut,
): Brut {
  const convention = CONVENTIONS[parametres.convention];
  const facteur = FACTEUR_ASR[parametres.ecoleAsr];

  /** L'estimation précédente, ramenée en fraction de journée. */
  const quand = (heures: number) => (Number.isFinite(heures) ? heures / 24 : 0.5);

  const maghrib = heureAngle(jj, latitude, ANGLE_HORIZON, quand(precedent.maghrib), "apres");

  return {
    fajr: heureAngle(jj, latitude, convention.angleFajr, quand(precedent.fajr), "avant"),
    lever: heureAngle(jj, latitude, ANGLE_HORIZON, quand(precedent.lever), "avant"),
    dhuhr: heureDuMidi(jj, quand(precedent.dhuhr)),
    asr: heureAsr(jj, latitude, facteur, quand(precedent.asr)),
    maghrib,
    isha:
      convention.angleIsha === undefined
        ? maghrib + (convention.minutesIsha ?? 0) / 60
        : heureAngle(jj, latitude, convention.angleIsha, quand(precedent.isha), "apres"),
  };
}

/** Les corrections manuelles, en minutes, prière par prière. */
export type Decalages = Partial<Record<keyof Reperes, number>>;

export type ResultatJour = {
  /** Minutes depuis minuit. NaN quand le repère n'existe pas ce jour-là. */
  reperes: Reperes;
  /** Vrai si la règle des nuits courtes a servi pour au moins un repère. */
  nuitCourte: boolean;
};

/**
 * Les heures d'une date, pour un lieu et une convention.
 *
 * `date` est une date civile locale au format AAAA-MM-JJ ; `decalageMinutes`
 * est le décalage du fuseau ce jour-là, en minutes — il est lu par l'appelant
 * plutôt que deviné ici, pour que l'heure d'été ne soit jamais supposée.
 */
export function heuresDuJour(
  date: string,
  lieu: Lieu,
  parametres: ParametresCalcul,
  decalageMinutes: number,
  decalages: Decalages = {},
): ResultatJour {
  const [annee, mois, jour] = date.split("-").map(Number);
  // La longitude est absorbée dans le jour julien, comme dans tous les calculs
  // de ce type : les heures sortent alors en temps solaire local, et le fuseau
  // n'intervient qu'à la toute fin.
  const jj = jourJulien(annee, mois, jour) - lieu.longitude / (15 * 24);

  // Des heures approximatives, sur lesquelles le calcul converge en deux tours.
  let brut: Brut = { fajr: 5, lever: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  // Deux tours suffisent : la position du soleil bouge trop peu en une journée
  // pour qu'un troisième change la minute affichée.
  for (let i = 0; i < 2; i += 1) brut = unTour(jj, lieu.latitude, parametres, brut);

  const avant = { fajr: brut.fajr, isha: brut.isha };

  const convention = CONVENTIONS[parametres.convention];
  const nuit = ecartHeures(brut.maghrib, brut.lever);

  brut.fajr = corrigerNuitCourte(
    brut.fajr,
    brut.lever,
    convention.angleFajr,
    nuit,
    "avant",
    parametres.nuitCourte,
  );
  if (convention.angleIsha !== undefined) {
    brut.isha = corrigerNuitCourte(
      brut.isha,
      brut.maghrib,
      convention.angleIsha,
      nuit,
      "apres",
      parametres.nuitCourte,
    );
  }

  // Vrai dès que le soleil n'a pas atteint l'angle demandé : que la règle de
  // repli ait servi ou qu'on ait laissé la case vide, l'heure affichée ne vient
  // alors pas d'une observation, et l'écran doit pouvoir le dire.
  const nuitCourte = !Number.isFinite(avant.fajr) || !Number.isFinite(avant.isha);

  const enMinutes = (heures: number, cle: keyof Reperes): number => {
    if (!Number.isFinite(heures)) return Number.NaN;
    const local = heures - lieu.longitude / 15 + decalageMinutes / 60;
    return Math.round(local * 60) + (decalages[cle] ?? 0);
  };

  return {
    reperes: {
      fajr: enMinutes(brut.fajr, "fajr"),
      lever: enMinutes(brut.lever, "lever"),
      dhuhr: enMinutes(brut.dhuhr, "dhuhr"),
      asr: enMinutes(brut.asr, "asr"),
      maghrib: enMinutes(brut.maghrib, "maghrib"),
      isha: enMinutes(brut.isha, "isha"),
    },
    nuitCourte,
  };
}
