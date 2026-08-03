import type { Metadata } from "next";

import { LienReglages } from "@/components/barre-navigation";
import { BarresMomentum } from "@/components/barres-momentum";
import { BasculeJourBas } from "@/components/bascule-jour-bas";
import { EcranInstallation } from "@/components/ecran-installation";
import { ListeQuetes } from "@/components/liste-quetes";
import { PhraseDuSoir } from "@/components/phrase-du-soir";
import { libelleCharge } from "@/lib/charge";
import { formaterDateLongue } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";
import { chargerJour, type EtatJour } from "@/lib/jour";

export const metadata: Metadata = { title: "Questline" };
export const dynamic = "force-dynamic";

export default async function PageJour() {
  let etat: EtatJour;
  try {
    etat = await chargerJour();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-11 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10">
      <header className="apparait flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
            {formaterDateLongue(etat.date)}
          </p>
          <LienReglages />
        </div>
        <h1 className="police-titre text-[34px] leading-none">{etat.salutation}</h1>
        <p className="text-[13.5px] text-doux">{libelleCharge(etat.charge)}</p>
      </header>

      <ListeQuetes quetes={etat.quetesDuJour} faites={etat.quetesFaites} />

      <BarresMomentum momentums={etat.momentums} />

      <BasculeJourBas actif={etat.journee.modeBas} />

      <div aria-hidden className="h-px w-full bg-bordure/60" />

      <PhraseDuSoir valeurInitiale={etat.journee.phrase} />
    </main>
  );
}
