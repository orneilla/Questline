import "server-only";

import { and, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { creneauxRecurrents, evenements } from "@/db/schema";
import { calculerCharge, type Charge } from "./charge";
import { plagesOccupantes, resoudreJour, type Bloc } from "./creneaux";
import { importesEntre } from "./calendrier/abonnements";
import { aujourdhui, decalerJours, jourDeLaSemaine } from "./dates";
import { debordement, minutesEveillees, tempsDispo } from "./temps";

export type JourSemaine = {
  date: string;
  jourSemaine: number;
  aujourdhui: boolean;
  blocs: Bloc[];
  /** Récurrents écartés par un ponctuel : affichés en filigrane. */
  annules: Bloc[];
  charge: Charge;
};

/** Le lundi de la semaine contenant cette date. */
export function lundiDeLaSemaine(date: string): string {
  const jour = jourDeLaSemaine(date);
  // 0 = dimanche : il ferme la semaine, il ne l'ouvre pas.
  return decalerJours(date, jour === 0 ? -6 : 1 - jour);
}

/** Les sept jours de la semaine courante, résolus et budgétés. */
export async function chargerSemaine(): Promise<JourSemaine[]> {
  const cejour = aujourdhui();
  const lundi = lundiDeLaSemaine(cejour);
  const dimanche = decalerJours(lundi, 6);

  const [recurrents, ponctuels] = await Promise.all([
    db.select().from(creneauxRecurrents),
    db
      .select()
      .from(evenements)
      // La veille du lundi sert à savoir si le lundi est un jour de récupération.
      .where(
        and(gte(evenements.date, decalerJours(lundi, -1)), lte(evenements.date, dimanche)),
      ),
  ]);

  // Absents tant que la table n'existe pas : la semaine doit rester lisible.
  const importes = await importesEntre(decalerJours(lundi, -1), dimanche).catch(() => []);

  return Array.from({ length: 7 }, (_, index) => {
    const date = decalerJours(lundi, index);
    const jour = jourDeLaSemaine(date);
    const resolu = resoudreJour(date, jour, recurrents, ponctuels, importes);

    const veille = decalerJours(date, -1);
    const laVeille = resoudreJour(
      veille,
      jourDeLaSemaine(veille),
      recurrents,
      ponctuels,
      importes,
    );

    return {
      date,
      jourSemaine: jour,
      aujourdhui: date === cejour,
      blocs: resolu.blocs,
      annules: resolu.annules,
      charge: calculerCharge({
        tempsDispoMin: tempsDispo(minutesEveillees(plagesOccupantes(resolu.blocs))),
        recuperation: debordement(plagesOccupantes(laVeille.blocs)) > 0,
        modeBas: false,
      }),
    };
  });
}
