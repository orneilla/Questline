import type { Metadata } from "next";
import Link from "next/link";

import {
  FormulaireEvenement,
  FormulaireRecurrent,
} from "@/components/formulaires-semaine";
import { EcranInstallation } from "@/components/ecran-installation";
import { GrilleSemaine } from "@/components/grille-semaine";
import { MOIS } from "@/lib/constantes";
import { aujourdhui, jourDeLaSemaine } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";
import { chargerSemaine, type JourSemaine } from "@/lib/semaine";

export const metadata: Metadata = { title: "Questline — Semaine" };
export const dynamic = "force-dynamic";

function intervalle(debut: string, fin: string): string {
  const [, moisD, jourD] = debut.split("-").map(Number);
  const [, moisF, jourF] = fin.split("-").map(Number);
  return moisD === moisF
    ? `${jourD} – ${jourF} ${MOIS[moisF - 1]}`
    : `${jourD} ${MOIS[moisD - 1]} – ${jourF} ${MOIS[moisF - 1]}`;
}

export default async function PageSemaine() {
  let jours: JourSemaine[];
  try {
    jours = await chargerSemaine();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const cejour = aujourdhui();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-10 px-4 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-[calc(env(safe-area-inset-bottom)+3.5rem)]">
      <header className="apparait flex flex-col gap-2.5 px-2">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
            {intervalle(jours[0].date, jours[6].date)}
          </p>
          <Link
            href="/jour"
            className="shrink-0 text-[12px] tracking-[0.14em] text-tres-doux uppercase transition-colors duration-300 active:text-doux"
          >
            Jour
          </Link>
        </div>
        <h1 className="police-titre text-[34px] leading-none">Semaine</h1>
      </header>

      <GrilleSemaine jours={jours} />

      <div aria-hidden className="h-px w-full bg-bordure/60" />

      <div className="flex flex-col gap-9 px-2">
        <FormulaireRecurrent jourParDefaut={jourDeLaSemaine(cejour)} />
        <FormulaireEvenement dateParDefaut={cejour} />
      </div>
    </main>
  );
}
