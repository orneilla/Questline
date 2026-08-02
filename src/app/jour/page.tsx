import type { Metadata } from "next";

import { BarresMomentum } from "@/components/barres-momentum";
import { BasculeJourBas } from "@/components/bascule-jour-bas";
import { ListeQuetes } from "@/components/liste-quetes";
import { PhraseDuSoir } from "@/components/phrase-du-soir";
import type { TypeJour } from "@/db/schema";
import { formaterDateLongue } from "@/lib/dates";
import { chargerJour } from "@/lib/jour";

export const metadata: Metadata = { title: "Questline" };
export const dynamic = "force-dynamic";

function intentionDuJour(typeJour: TypeJour, modeBas: boolean): string {
  if (modeBas) return "Jour bas. Un seul geste, et il compte autant.";
  if (typeJour === "shift") return "Journée de shift. Une quête, courte.";
  if (typeJour === "cours") return "Journée de cours. Deux gestes suffisent.";
  return "Journée libre. Trois gestes, trois piliers.";
}

export default async function PageJour() {
  const etat = await chargerJour();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-11 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-[calc(env(safe-area-inset-bottom)+3.5rem)]">
      <header className="apparait flex flex-col gap-2.5">
        <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
          {formaterDateLongue(etat.date)}
        </p>
        <h1 className="police-titre text-[34px] leading-none">{etat.salutation}</h1>
        <p className="text-[14px] leading-relaxed text-doux">
          {intentionDuJour(etat.journee.typeJour, etat.journee.modeBas)}
        </p>
      </header>

      <ListeQuetes quetes={etat.quetesDuJour} faites={etat.quetesFaites} />

      <BarresMomentum momentums={etat.momentums} />

      <BasculeJourBas actif={etat.journee.modeBas} />

      <div aria-hidden className="h-px w-full bg-bordure/60" />

      <PhraseDuSoir valeurInitiale={etat.journee.phrase} />
    </main>
  );
}
