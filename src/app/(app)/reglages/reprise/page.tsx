import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { Reprise } from "@/components/reglages/reprise";
import { apercuReprise, type ApercuReprise } from "@/lib/reprise";
import { saisonCourante } from "@/lib/saisons";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Repartir de zéro" };
export const dynamic = "force-dynamic";

export default async function PageReprise() {
  let apercu: ApercuReprise;
  let saison: Awaited<ReturnType<typeof saisonCourante>>;

  try {
    [apercu, saison] = await Promise.all([apercuReprise(), saisonCourante()]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/reglages" libelle="Réglages" />
        <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
          Saison {saison.numero} · jour {saison.jourDansLaSaison}
        </p>
        <h1 className="police-titre text-[30px] leading-tight">Repartir de zéro</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Rouvrir un cycle : le compte des saisons revient à un, et ce qui a été
          accumulé s&apos;efface. Ce n&apos;est pas une réparation, c&apos;est une
          décision — rien ici ne se déclenche tout seul.
        </p>
      </header>

      <Reprise apercu={apercu} />
    </main>
  );
}
