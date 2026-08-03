import { JOURS_SEMAINE, MOIS } from "./constantes";

/** Fuseau de référence : la journée commence et finit ici, pas en UTC. */
export const FUSEAU = process.env.FUSEAU_HORAIRE ?? "Europe/Paris";

function partsLocales(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const lu = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return {
    annee: lu("year"),
    mois: lu("month"),
    jour: lu("day"),
    heure: Number(lu("hour")),
  };
}

/** Date du jour au format ISO court (AAAA-MM-JJ), dans le fuseau de référence. */
export function aujourdhui(instant: Date = new Date()): string {
  const { annee, mois, jour } = partsLocales(instant);
  return `${annee}-${mois}-${jour}`;
}

/** Heure locale sur 24 h, pour choisir la salutation. */
export function heureLocale(instant: Date = new Date()): number {
  return partsLocales(instant).heure;
}

/**
 * Minutes écoulées depuis minuit, dans le fuseau de référence.
 *
 * C'est ce qui permet aux tâches planifiées de raisonner en heure de Paris
 * alors que Vercel les déclenche en UTC : l'heure d'été n'a plus à être
 * devinée, elle est lue.
 */
export function minutesLocales(instant: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSEAU,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const lu = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return lu("hour") * 60 + lu("minute");
}

function enUtc(iso: string): number {
  const [a, m, j] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, j);
}

/** 0 = dimanche … 6 = samedi. */
export function jourDeLaSemaine(iso: string): number {
  return new Date(enUtc(iso)).getUTCDay();
}

/** Nombre de jours pleins entre deux dates ISO (b - a). */
export function ecartJours(a: string, b: string): number {
  return Math.round((enUtc(b) - enUtc(a)) / 86_400_000);
}

/** Décale une date ISO d'un nombre de jours. */
export function decalerJours(iso: string, jours: number): string {
  const d = new Date(enUtc(iso) + jours * 86_400_000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const jj = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${jj}`;
}

/** « samedi 2 août » — sans année, la journée se suffit à elle-même. */
export function formaterDateLongue(iso: string): string {
  const [, m, j] = iso.split("-").map(Number);
  return `${JOURS_SEMAINE[jourDeLaSemaine(iso)]} ${j} ${MOIS[m - 1]}`;
}

export function salutation(heure: number): string {
  if (heure < 5) return "Nuit calme";
  if (heure < 12) return "Bonjour";
  if (heure < 18) return "Bon après-midi";
  return "Bonsoir";
}
