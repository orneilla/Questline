import type { CategorieCreneau, CreneauRecurrent, Evenement } from "@/db/schema";
import { chevauchent, estInstant, plage, type Plage } from "./temps";

/**
 * Résolution de l'emploi du temps d'une date.
 *
 * Le récurrent donne la trame de la semaine ; le ponctuel la corrige. Un
 * événement qui recouvre un créneau récurrent le remplace pour ce jour-là.
 * Un événement réduit à un instant (début = fin) annule sans rien occuper :
 * c'est le cours supprimé, le shift qui saute.
 */

export type Bloc = {
  cle: string;
  titre: string;
  type: CategorieCreneau;
  debut: string;
  fin: string;
  plage: Plage;
  source: "recurrent" | "evenement";
  recurrentId?: number;
  evenementId?: number;
};

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

export function resoudreJour(
  date: string,
  jourSemaine: number,
  recurrents: CreneauRecurrent[],
  evenements: Evenement[],
): JourResolu {
  const duJour = evenements
    .filter((e) => e.date === date)
    .map(blocEvenement);

  const trame = recurrents
    .filter((r) => r.jourSemaine === jourSemaine && estActif(r, date))
    .map(blocRecurrent);

  const blocs: Bloc[] = [];
  const annules: Bloc[] = [];

  for (const bloc of trame) {
    const ecrase = duJour.some((e) => chevauchent(bloc.plage, e.plage));
    if (ecrase) annules.push(bloc);
    else blocs.push(bloc);
  }

  // Les annulations ne sont pas des blocs : elles ne font que retirer.
  blocs.push(...duJour.filter((e) => !estInstant(e.plage)));

  blocs.sort((a, b) => a.plage.debut - b.plage.debut);
  annules.sort((a, b) => a.plage.debut - b.plage.debut);

  return { blocs, annules };
}
