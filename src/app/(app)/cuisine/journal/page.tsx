import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { Saisie } from "@/components/cuisine/journal-saisie";
import { Tendances } from "@/components/cuisine/tendances";
import {
  chargerSemaine,
  debutSemaine,
  recettesNotables,
  type RecetteNotable,
} from "@/lib/cuisine/journal";
import type { Semaine } from "@/lib/cuisine/tendances";
import { aujourdhui, decalerJours } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Journal" };
export const dynamic = "force-dynamic";

export default async function PageJournal({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>;
}) {
  const params = await searchParams;
  const demandee = params.semaine;
  const debut = debutSemaine(
    demandee && /^\d{4}-\d{2}-\d{2}$/.test(demandee) ? demandee : aujourdhui(),
  );

  let semaine: Semaine;
  let recettes: RecetteNotable[];

  try {
    [semaine, recettes] = await Promise.all([chargerSemaine(debut), recettesNotables()]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const dates = semaine.jours.map((j) => j.date);
  const jour = aujourdhui();
  // Aujourd'hui si la semaine affichée le contient, sinon son dernier jour :
  // en consultant une semaine passée, on note dedans, pas ailleurs.
  const defaut = dates.includes(jour) ? jour : decalerJours(debut, 6);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-7 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/cuisine" libelle="Cuisine" />
        <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
          {semaine.joursRenseignes} jour{semaine.joursRenseignes > 1 ? "s" : ""} noté
          {semaine.joursRenseignes > 1 ? "s" : ""} sur 7
        </p>
        <h1 className="police-titre text-[34px] leading-none">Journal</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Ce que tu as mangé, et comment ça évolue. Pas d&apos;objectif, pas de
          seuil, pas de note : la donnée et son mouvement, rien de plus.
        </p>
      </header>

      {/*
        La clé remet la saisie à la semaine affichée. Sans elle, le jour choisi
        survivrait à un changement de semaine : plus aucune pastille ne serait
        cochée, et « Noter » écrirait dans une semaine qu'on ne regarde plus.
      */}
      <Saisie
        key={debut}
        dates={dates}
        defaut={defaut}
        recettes={recettes}
        entrees={semaine.jours.flatMap((j) => j.entrees)}
      />

      <div className="border-t border-bordure pt-6">
        <Tendances semaine={semaine} />
      </div>
    </main>
  );
}
