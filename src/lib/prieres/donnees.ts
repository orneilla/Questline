import "server-only";

import { and, asc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { prieresFaites, reglagesPrieres, type ReglagesPrieres } from "@/db/schema";
import { FUSEAU, aujourdhui } from "@/lib/dates";
import {
  CONVENTIONS,
  heuresDuJour,
  type CleConvention,
  type Decalages,
  type EcoleAsr,
  type RegleNuitCourte,
  type Reperes,
} from "./astronomie";
import { CLES_PRIERE, estClePriere, lignesDuJour, type LignePriere } from "./partage";

/**
 * Lecture et écriture du suivi des prières.
 *
 * ── Ce que ce module ne fait pas
 *
 * Il n'écrit dans aucune autre table. Cocher une prière ne crédite pas un
 * pilier, ne fait pas bouger l'élan, n'ouvre pas une journée dans le journal et
 * ne compte dans aucune saison. C'était la demande, et c'est aussi la seule
 * façon d'être sûr que le suivi reste un repère et ne devienne pas une note.
 */

const DEFAUTS: ReglagesPrieres = {
  id: 1,
  latitude: null,
  longitude: null,
  lieu: "",
  convention: "uoif",
  ecoleAsr: "majorite",
  nuitCourte: "angle",
  decalageFajr: 0,
  decalageDhuhr: 0,
  decalageAsr: 0,
  decalageMaghrib: 0,
  decalageIsha: 0,
  rappelFajr: true,
  rappelDhuhr: true,
  rappelAsr: true,
  rappelMaghrib: true,
  rappelIsha: true,
  rappelsActifs: false,
};

/** Ne lève jamais : une base pas encore migrée rend les valeurs de départ. */
export async function chargerReglagesPrieres(): Promise<ReglagesPrieres> {
  try {
    const [ligne] = await db
      .select()
      .from(reglagesPrieres)
      .where(eq(reglagesPrieres.id, 1))
      .limit(1);
    return ligne ?? DEFAUTS;
  } catch {
    return DEFAUTS;
  }
}

/* ────────────────────── Fuseau ────────────────────── */

/**
 * Le décalage du fuseau de référence ce jour-là, en minutes.
 *
 * Lu plutôt que supposé : l'heure d'été ne se devine pas, et une erreur d'une
 * heure sur le Maghrib serait la plus visible de toutes. Le décalage est pris à
 * midi, quand le basculement de la nuit est déjà passé.
 */
export function decalageFuseau(date: string, zone: string = FUSEAU): number {
  const midi = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(midi);

  const lu = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const commeUtc = Date.UTC(
    lu("year"),
    lu("month") - 1,
    lu("day"),
    lu("hour"),
    lu("minute"),
    lu("second"),
  );

  return Math.round((commeUtc - midi.getTime()) / 60000);
}

/* ────────────────────── Calcul ────────────────────── */

function conventionDe(valeur: string): CleConvention {
  return valeur in CONVENTIONS ? (valeur as CleConvention) : "uoif";
}

function ecoleDe(valeur: string): EcoleAsr {
  return valeur === "hanafite" ? "hanafite" : "majorite";
}

function nuitDe(valeur: string): RegleNuitCourte {
  return valeur === "moitie" || valeur === "septieme" || valeur === "aucune"
    ? valeur
    : "angle";
}

function decalagesDe(reglages: ReglagesPrieres): Decalages {
  return {
    fajr: reglages.decalageFajr,
    dhuhr: reglages.decalageDhuhr,
    asr: reglages.decalageAsr,
    maghrib: reglages.decalageMaghrib,
    isha: reglages.decalageIsha,
  };
}

/** Les heures d'une date, ou null tant que le lieu n'a pas été posé. */
export function reperesPour(
  date: string,
  reglages: ReglagesPrieres,
): { reperes: Reperes; nuitCourte: boolean } | null {
  if (reglages.latitude === null || reglages.longitude === null) return null;

  return heuresDuJour(
    date,
    { latitude: reglages.latitude, longitude: reglages.longitude },
    {
      convention: conventionDe(reglages.convention),
      ecoleAsr: ecoleDe(reglages.ecoleAsr),
      nuitCourte: nuitDe(reglages.nuitCourte),
    },
    decalageFuseau(date),
    decalagesDe(reglages),
  );
}

/* ────────────────────── Une journée ────────────────────── */

export type JourneePrieres = {
  date: string;
  /** Null tant que le lieu n'est pas posé : aucune heure n'est alors affichable. */
  lignes: LignePriere[] | null;
  faites: string[];
  reglages: ReglagesPrieres;
  /** Vrai quand la règle des nuits courtes a servi ce jour-là. */
  nuitCourte: boolean;
  /** Le nom de la convention retenue, pour que l'écran le dise. */
  convention: string;
  sourceConvention: string;
};

export async function chargerJournee(date = aujourdhui()): Promise<JourneePrieres> {
  const reglages = await chargerReglagesPrieres();
  const faites = await prieresDe(date);
  const calcul = reperesPour(date, reglages);
  const convention = CONVENTIONS[conventionDe(reglages.convention)];

  return {
    date,
    // Les lignes sont composées sans « maintenant » : l'heure courante ne se lit
    // qu'au navigateur, sans quoi le serveur et l'écran ne la liraient pas au
    // même instant et l'état de la prière en cours sauterait au premier rendu.
    lignes: calcul ? lignesDuJour(calcul.reperes, faites, null) : null,
    faites,
    reglages,
    nuitCourte: calcul?.nuitCourte ?? false,
    convention: convention.nom,
    sourceConvention: convention.source,
  };
}

export async function prieresDe(date: string): Promise<string[]> {
  try {
    const lignes = await db
      .select({ priere: prieresFaites.priere })
      .from(prieresFaites)
      .where(eq(prieresFaites.date, date));
    return lignes.map((l) => l.priere);
  } catch {
    return [];
  }
}

/* ────────────────────── Cocher, décocher ────────────────────── */

/**
 * Coche une prière.
 *
 * Aucune vérification d'heure : une prière rattrapée dans la soirée se coche
 * dans la soirée, et une journée passée se corrige. L'application n'a pas à
 * juger de quand un geste a eu lieu.
 */
export async function cocher(date: string, priere: string): Promise<boolean> {
  if (!estClePriere(priere)) return false;
  await db
    .insert(prieresFaites)
    .values({ date, priere, cocheLe: new Date().toISOString() })
    .onConflictDoNothing();
  return true;
}

export async function decocher(date: string, priere: string): Promise<boolean> {
  if (!estClePriere(priere)) return false;
  await db
    .delete(prieresFaites)
    .where(and(eq(prieresFaites.date, date), eq(prieresFaites.priere, priere)));
  return true;
}

/* ────────────────────── Le mois ────────────────────── */

export type JourDuMois = {
  date: string;
  /** Le numéro du jour, pour l'affichage. */
  numero: number;
  faites: string[];
  /** Vrai si la date est à venir : rien n'y est encore à lire. */
  avenir: boolean;
};

export type MoisPrieres = {
  /** AAAA-MM. */
  mois: string;
  libelle: string;
  jours: JourDuMois[];
};

const NOMS_MOIS = [
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

/**
 * Le mois en cours, jour par jour.
 *
 * La lecture s'arrête au mois : rien ne s'accumule sur des années, et il n'y a
 * donc pas de courbe à faire monter. C'est un aide-mémoire, pas un dossier.
 */
export async function chargerMois(date = aujourdhui()): Promise<MoisPrieres> {
  const [annee, mois] = date.split("-").map(Number);
  const premier = `${annee}-${String(mois).padStart(2, "0")}-01`;
  const nbJours = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  const dernier = `${annee}-${String(mois).padStart(2, "0")}-${String(nbJours).padStart(2, "0")}`;

  let lignes: { date: string; priere: string }[] = [];
  try {
    lignes = await db
      .select({ date: prieresFaites.date, priere: prieresFaites.priere })
      .from(prieresFaites)
      .where(and(gte(prieresFaites.date, premier), lte(prieresFaites.date, dernier)))
      .orderBy(asc(prieresFaites.date));
  } catch {
    lignes = [];
  }

  const parJour = new Map<string, string[]>();
  for (const ligne of lignes) {
    const liste = parJour.get(ligne.date) ?? [];
    liste.push(ligne.priere);
    parJour.set(ligne.date, liste);
  }

  const cejour = aujourdhui();
  const jours: JourDuMois[] = [];
  for (let n = 1; n <= nbJours; n += 1) {
    const jour = `${annee}-${String(mois).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
    jours.push({
      date: jour,
      numero: n,
      faites: parJour.get(jour) ?? [],
      avenir: jour > cejour,
    });
  }

  return {
    mois: `${annee}-${String(mois).padStart(2, "0")}`,
    libelle: `${NOMS_MOIS[mois - 1]} ${annee}`,
    jours,
  };
}

/* ────────────────────── Écriture des réglages ────────────────────── */

async function poser(champs: Partial<ReglagesPrieres>): Promise<void> {
  await db
    .insert(reglagesPrieres)
    .values({ id: 1, ...champs })
    .onConflictDoUpdate({ target: reglagesPrieres.id, set: champs });
}

export function lieuValide(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}

export async function enregistrerLieu(
  latitude: number,
  longitude: number,
  lieu: string,
): Promise<boolean> {
  if (!lieuValide(latitude, longitude)) return false;
  // Cinq décimales valent le mètre : au-delà, on stockerait du bruit de
  // capteur, et la position d'une personne n'a pas à être plus précise que ça.
  await poser({
    latitude: Math.round(latitude * 1e5) / 1e5,
    longitude: Math.round(longitude * 1e5) / 1e5,
    lieu: lieu.trim().slice(0, 80),
  });
  return true;
}

export async function enregistrerConventions(champs: {
  convention: string;
  ecoleAsr: string;
  nuitCourte: string;
}): Promise<void> {
  await poser({
    convention: conventionDe(champs.convention),
    ecoleAsr: ecoleDe(champs.ecoleAsr),
    nuitCourte: nuitDe(champs.nuitCourte),
  });
}

/** Bornées à une demi-heure : au-delà, ce n'est plus une correction. */
const DECALAGE_MAX = 30;

export async function enregistrerDecalages(valeurs: Record<string, number>): Promise<void> {
  const borne = (v: number) =>
    Math.max(-DECALAGE_MAX, Math.min(DECALAGE_MAX, Math.round(v || 0)));

  await poser({
    decalageFajr: borne(valeurs.fajr),
    decalageDhuhr: borne(valeurs.dhuhr),
    decalageAsr: borne(valeurs.asr),
    decalageMaghrib: borne(valeurs.maghrib),
    decalageIsha: borne(valeurs.isha),
  });
}

const COLONNE_RAPPEL = {
  fajr: "rappelFajr",
  dhuhr: "rappelDhuhr",
  asr: "rappelAsr",
  maghrib: "rappelMaghrib",
  isha: "rappelIsha",
} as const;

export async function basculerRappel(priere: string, actif: boolean): Promise<boolean> {
  if (!estClePriere(priere)) return false;
  await poser({ [COLONNE_RAPPEL[priere]]: actif });
  return true;
}

export async function basculerRappels(actifs: boolean): Promise<void> {
  await poser({ rappelsActifs: actifs });
}

/** Quelles prières veulent un rappel, dans l'ordre de la journée. */
export function rappelsVoulus(reglages: ReglagesPrieres): string[] {
  if (!reglages.rappelsActifs) return [];
  return CLES_PRIERE.filter((cle) => reglages[COLONNE_RAPPEL[cle]]);
}
