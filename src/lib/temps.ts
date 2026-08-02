/**
 * Arithmétique du temps de la journée.
 *
 * Tout est en minutes depuis minuit. Un créneau qui passe minuit se prolonge
 * au-delà de 1440 plutôt que de repartir à zéro : c'est ce qui permet de
 * mesurer d'un coup ce qu'il occupe aujourd'hui et ce qu'il déborde sur demain.
 */

/** Fenêtre d'éveil : 07:00 – 23:00. */
export const EVEIL = { debut: 7 * 60, fin: 23 * 60 } as const;

/** 16 h d'éveil. */
export const EVEIL_MIN = EVEIL.fin - EVEIL.debut;

/** Repas, trajets, prières, marge : deux heures qu'on ne planifie pas. */
export const INCOMPRESSIBLE_MIN = 2 * 60;

/** Part du temps disponible qu'on accepte de confier aux quêtes. */
export const PART_QUETES = 0.4;

const MINUTES_PAR_JOUR = 24 * 60;

export type Plage = { debut: number; fin: number };

/** « 18:30 » comme « 18:30:00 » donnent 1110. */
export function enMinutes(heure: string): number {
  const [h, m] = heure.split(":");
  return Number(h) * 60 + Number(m ?? 0);
}

/** 1110 donne « 18:30 ». */
export function enHeure(minutes: number): string {
  const total = ((minutes % MINUTES_PAR_JOUR) + MINUTES_PAR_JOUR) % MINUTES_PAR_JOUR;
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Une fin strictement antérieure au début signifie que le créneau passe
 * minuit. Une fin égale au début désigne un instant : c'est ainsi qu'on
 * marque une annulation, qui n'occupe rien.
 */
export function plage(debut: string, fin: string): Plage {
  const d = enMinutes(debut);
  let f = enMinutes(fin);
  if (f < d) f += MINUTES_PAR_JOUR;
  return { debut: d, fin: f };
}

export function estInstant(p: Plage): boolean {
  return p.debut === p.fin;
}

export function duree(p: Plage): number {
  return p.fin - p.debut;
}

/** Un instant chevauche la plage qui le contient. */
export function chevauchent(a: Plage, b: Plage): boolean {
  if (estInstant(a)) return b.debut <= a.debut && a.debut < b.fin;
  if (estInstant(b)) return a.debut <= b.debut && b.debut < a.fin;
  return a.debut < b.fin && b.debut < a.fin;
}

/** Fusionne les plages qui se recouvrent, pour ne jamais compter deux fois. */
export function fusionner(plages: Plage[]): Plage[] {
  const triees = [...plages]
    .filter((p) => duree(p) > 0)
    .sort((a, b) => a.debut - b.debut);

  const fusion: Plage[] = [];
  for (const p of triees) {
    const derniere = fusion[fusion.length - 1];
    if (derniere && p.debut <= derniere.fin) {
      derniere.fin = Math.max(derniere.fin, p.fin);
    } else {
      fusion.push({ ...p });
    }
  }
  return fusion;
}

/** Ce que ces plages retirent réellement à la fenêtre d'éveil. */
export function minutesEveillees(plages: Plage[]): number {
  return fusionner(plages).reduce(
    (total, p) =>
      total + Math.max(0, Math.min(p.fin, EVEIL.fin) - Math.max(p.debut, EVEIL.debut)),
    0,
  );
}

/** Ce qui mord sur le lendemain — un shift de nuit, typiquement. */
export function debordement(plages: Plage[]): number {
  return plages.reduce((max, p) => Math.max(max, p.fin - MINUTES_PAR_JOUR), 0);
}

/** 16 h d'éveil, moins les créneaux, moins les 2 h incompressibles. */
export function tempsDispo(minutesOccupees: number): number {
  return Math.max(0, EVEIL_MIN - minutesOccupees - INCOMPRESSIBLE_MIN);
}

/** « 45 min », « 7h », « 2h30 ». */
export function formaterDuree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
