import type { CreneauRecurrent, Evenement, EvenementImporte } from "@/db/schema";
import { chevauchent, estInstant, plage, type Plage } from "./temps";

/**
 * Résolution de l'emploi du temps d'une date.
 *
 * Le récurrent donne la trame de la semaine ; le ponctuel la corrige. Un
 * événement qui recouvre un créneau récurrent le remplace pour ce jour-là.
 * Un événement réduit à un instant (début = fin) annule sans rien occuper :
 * c'est le cours supprimé, le shift qui saute.
 *
 * Un calendrier extérieur apporte une troisième source. Elle se comporte comme
 * la trame récurrente — elle occupe, et un ponctuel de Questline la remplace —
 * à une exception près : un événement de journée entière est affiché mais
 * n'occupe rien. Marquer un jour « Vacances » ne veut pas dire qu'on y a zéro
 * heure devant soi ; c'est même souvent l'inverse.
 */

export type Bloc = {
  cle: string;
  titre: string;
  /** La clé d'une catégorie. Du texte, plus un énuméré : elles s'ajoutent. */
  type: string;
  debut: string;
  fin: string;
  plage: Plage;
  source: "recurrent" | "evenement" | "importe";
  recurrentId?: number;
  evenementId?: number;
  /** Vrai pour un jour entier importé : il informe, il n'occupe pas. */
  journeeEntiere?: boolean;
};

/** Les plages qui comptent dans le temps occupé. */
export function plagesOccupantes(blocs: Bloc[]): Plage[] {
  return blocs.filter((b) => !b.journeeEntiere).map((b) => b.plage);
}

export type JourResolu = {
  /** Ce qui occupe réellement la journée. */
  blocs: Bloc[];
  /** Récurrents écartés par un ponctuel, gardés pour l'affichage. */
  annules: Bloc[];
};

export function estActif(recurrent: CreneauRecurrent, date: string): boolean {
  if (recurrent.actifDepuis && date < recurrent.actifDepuis) return false;
  if (recurrent.actifJusqua && date > recurrent.actifJusqua) return false;
  return true;
}

function blocRecurrent(r: CreneauRecurrent): Bloc {
  return {
    cle: `r${r.id}`,
    titre: r.titre,
    type: r.type,
    debut: r.debut,
    fin: r.fin,
    plage: plage(r.debut, r.fin),
    source: "recurrent",
    recurrentId: r.id,
  };
}

function blocEvenement(e: Evenement): Bloc {
  return {
    cle: `e${e.id}`,
    titre: e.titre,
    type: e.type,
    debut: e.debut,
    fin: e.fin,
    plage: plage(e.debut, e.fin),
    source: "evenement",
    evenementId: e.id,
  };
}

function blocImporte(e: EvenementImporte): Bloc {
  return {
    cle: `i${e.id}`,
    titre: e.titre,
    type: e.categorie,
    debut: e.debut,
    fin: e.fin,
    plage: plage(e.debut, e.fin),
    source: "importe",
    journeeEntiere: e.journeeEntiere,
  };
}

export function resoudreJour(
  date: string,
  jourSemaine: number,
  recurrents: CreneauRecurrent[],
  evenements: Evenement[],
  importes: EvenementImporte[] = [],
): JourResolu {
  const duJour = evenements
    .filter((e) => e.date === date)
    .map(blocEvenement);

  const trame = [
    ...recurrents
      .filter((r) => r.jourSemaine === jourSemaine && estActif(r, date))
      .map(blocRecurrent),
    ...importes.filter((e) => e.date === date).map(blocImporte),
  ];

  const blocs: Bloc[] = [];
  const annules: Bloc[] = [];

  for (const bloc of trame) {
    // Un jour entier importé ne se fait pas écraser : il ne recouvre rien, il
    // qualifie la journée. Le retirer parce qu'un rendez-vous tombe dedans
    // ferait disparaître l'information la plus utile du jour.
    const ecrase =
      !bloc.journeeEntiere && duJour.some((e) => chevauchent(bloc.plage, e.plage));
    if (ecrase) annules.push(bloc);
    else blocs.push(bloc);
  }

  // Les annulations ne sont pas des blocs : elles ne font que retirer.
  blocs.push(...duJour.filter((e) => !estInstant(e.plage)));

  blocs.sort((a, b) => a.plage.debut - b.plage.debut);
  annules.sort((a, b) => a.plage.debut - b.plage.debut);

  return { blocs, annules };
}
