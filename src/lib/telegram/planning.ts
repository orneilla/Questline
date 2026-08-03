import type { TypeMessage } from "./envoi";

/**
 * Quel message revient à quelle heure — en heure de Paris, pas en UTC.
 *
 * Vercel déclenche ses tâches en UTC ; Paris avance d'une heure en hiver, de
 * deux en été. vercel.json déclare donc les deux horaires UTC possibles pour
 * chaque message, et c'est cette fonction qui tranche à partir de l'heure
 * réellement lue. Le déclenchement en trop tombe hors créneau et n'envoie rien.
 */

export type Creneau = { type: TypeMessage; minute: number; jour?: number };

export const CRENEAUX: Creneau[] = [
  { type: "matin", minute: 7 * 60 + 30 },
  { type: "soir", minute: 21 * 60 + 30 },
  { type: "bilan", minute: 10 * 60, jour: 0 },
];

/** Le cron peut arriver avec du retard ; on reste ouvert moins d'une heure. */
export const FENETRE_MIN = 59;

export function creneauPour(minutesParis: number, jourSemaine: number): Creneau | null {
  return (
    CRENEAUX.find(
      (c) =>
        (c.jour === undefined || c.jour === jourSemaine) &&
        minutesParis >= c.minute &&
        minutesParis < c.minute + FENETRE_MIN,
    ) ?? null
  );
}
