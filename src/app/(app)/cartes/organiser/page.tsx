import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { Organisation } from "@/components/cartes/organisation";
import { chargerArborescence, type EspaceListe } from "@/lib/cartes/edition";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Organiser" };
export const dynamic = "force-dynamic";

export default async function PageOrganiser() {
  let espaces: EspaceListe[];

  try {
    espaces = await chargerArborescence();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/cartes" libelle="Cartes" />
        <h1 className="police-titre text-[34px] leading-none">Organiser</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Espaces et paquets. Tout se renomme, se déplace et se supprime ; chaque
          suppression dit d'abord ce qu'elle emporte.
        </p>
      </header>

      <Organisation espaces={espaces} />
    </main>
  );
}
