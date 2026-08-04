import type { Metadata } from "next";

import { EcranInstallation } from "@/components/ecran-installation";
import { Sauvegardes } from "@/components/reglages/sauvegardes";
import { Retour } from "@/components/retour";
import { diagnostiquer } from "@/lib/erreurs";
import { CONSERVEES, listerSauvegardes } from "@/lib/sauvegardes";
import type { FicheSauvegarde } from "@/lib/sauvegardes-partage";

export const metadata: Metadata = { title: "Questline — Sauvegardes" };
export const dynamic = "force-dynamic";

export default async function PageSauvegardes() {
  let liste: FicheSauvegarde[];
  try {
    liste = await listerSauvegardes();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/reglages" libelle="Réglages" />
        <h1 className="police-titre text-[34px] leading-none">Sauvegardes</h1>
        <p className="text-[13px] leading-relaxed text-doux">
          Automatiques, une par semaine. Rien à penser à faire.
        </p>
      </header>

      <Sauvegardes liste={liste} conservees={CONSERVEES} />
    </main>
  );
}
