import type { Creneau as CreneauRappel } from "@/lib/notifications/envoi";

/**
 * Quels rappels sont dus, en heure de Paris — pas en UTC.
 *
 * ── Pourquoi cette logique
 *
 * Vercel planifie en UTC, et sur le palier gratuit sans garantie sur la minute :
 * une tâche annoncée à 6 h 30 peut partir n'importe quand dans l'heure, et le
 * nombre de tâches est plafonné à deux. Une version antérieure demandait
 * « sommes-nous dans la fenêtre de cinquante-neuf minutes qui suit l'heure
 * dite ? » ; combinée à un déclencheur imprécis, la réponse était souvent non,
 * et rien ne partait.
 *
 * La question posée est donc « ce rappel était-il dû aujourd'hui ? » — dû dès
 * que son heure est passée. L'idempotence de l'envoi, portée par une clé
 * `(date, type)` distincte pour chaque canal, garantit qu'il ne part qu'une
 * fois. Un déclencheur en retard envoie quand même, un déclencheur du soir
 * rattrape un matin jamais parti, un doublon ne fait rien, et le passage à
 * l'heure d'été ne demande aucun réglage.
 */

export type CreneauPlanifie = { type: CreneauRappel; minute: number };

/**
 * Les créneaux dont l'heure est passée, dans l'ordre.
 *
 * Les horaires viennent des réglages : ils sont modifiables depuis l'écran des
 * notifications, et rien ici ne présume de leur valeur.
 */
export function creneauxDus(
  minutesParis: number,
  heures: { matin: number; soir: number },
): CreneauPlanifie[] {
  return (
    [
      { type: "matin" as const, minute: heures.matin },
      { type: "soir" as const, minute: heures.soir },
    ] satisfies CreneauPlanifie[]
  )
    .filter((c) => minutesParis >= c.minute)
    .sort((a, b) => a.minute - b.minute);
}

/** Le bilan hebdomadaire de Telegram : dimanche, avec le rappel du matin. */
export function bilanDu(minutesParis: number, jourSemaine: number, heureMatin: number): boolean {
  return jourSemaine === 0 && minutesParis >= heureMatin;
}
