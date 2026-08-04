import type { TypeMessage } from "./envoi";

/**
 * Quel message revient à quelle heure — en heure de Paris, pas en UTC.
 *
 * ── Pourquoi ce fichier a changé de logique
 *
 * La version précédente demandait « sommes-nous dans la fenêtre de cinquante-
 * neuf minutes qui suit l'heure dite ? ». Cela supposait que le déclencheur
 * arrive à la minute promise. Sur le palier gratuit de Vercel, ce n'est pas le
 * cas : une tâche planifiée peut partir n'importe quand dans l'heure, et le
 * nombre de tâches est plafonné à deux — vercel.json en déclarait six, ce qui
 * suffit à faire refuser le déploiement des tâches. Une fenêtre étroite
 * combinée à un déclencheur imprécis donne exactement ce qui a été constaté :
 * rien n'arrive.
 *
 * La question posée est donc maintenant « ce message était-il dû aujourd'hui,
 * et a-t-il déjà été envoyé ? ». Un créneau est dû dès que son heure est
 * passée ; l'idempotence de l'envoi, qui existait déjà, garantit qu'il ne part
 * qu'une fois par jour. Un déclencheur en retard d'une heure envoie quand même,
 * un déclencheur en double n'envoie pas deux fois, et le passage à l'heure
 * d'été ne demande plus de déclarer deux horaires UTC par message.
 */

export type Creneau = {
  type: TypeMessage;
  /** Minutes depuis minuit, heure de Paris. */
  minute: number;
  /** Restreint à un jour de la semaine (0 = dimanche). */
  jour?: number;
};

export const CRENEAUX: Creneau[] = [
  { type: "matin", minute: 7 * 60 + 30 },
  // Le bilan de la semaine part avec le message du matin, le dimanche : sur
  // deux déclencheurs quotidiens, il n'y a pas de place pour un troisième.
  { type: "bilan", minute: 7 * 60 + 35, jour: 0 },
  { type: "soir", minute: 21 * 60 + 30 },
];

/**
 * Les créneaux dont l'heure est passée aujourd'hui, dans l'ordre.
 *
 * Rend une liste et non un seul créneau : un déclencheur du soir doit pouvoir
 * rattraper un message du matin qui n'est jamais parti, plutôt que de le perdre
 * définitivement.
 */
export function creneauxDus(minutesParis: number, jourSemaine: number): Creneau[] {
  return CRENEAUX.filter(
    (c) => (c.jour === undefined || c.jour === jourSemaine) && minutesParis >= c.minute,
  ).sort((a, b) => a.minute - b.minute);
}
