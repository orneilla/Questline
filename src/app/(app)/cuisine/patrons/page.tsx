import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { Patrons } from "@/components/cuisine/patrons";
import { chargerEtatPatrons, type EtatPatron } from "@/lib/cuisine/patrons";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Patrons de plat" };
export const dynamic = "force-dynamic";

export default async function PagePatrons() {
  let etats: EtatPatron[];

  try {
    etats = await chargerEtatPatrons();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const actifs = etats.filter((e) => e.patron.actif);
  const endormis = etats.length - actifs.length;
  // Ce qui mérite d'être dit en tête, c'est ce qui cloche : un patron en
  // service dont une place reste vide ne produira rien aujourd'hui.
  const bloques = actifs.filter((e) => e.categoriesVides.length > 0).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/cuisine" libelle="Cuisine" />
        <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
          {actifs.length} en service
          {endormis > 0 ? ` · ${endormis} en sommeil` : ""}
          {bloques > 0
            ? ` · ${bloques} ne ${bloques > 1 ? "tiennent" : "tient"} pas aujourd'hui`
            : ""}
        </p>
        <h1 className="police-titre text-[34px] leading-none">Patrons de plat</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Un patron ne nomme aucun aliment : il dit une structure — un féculent,
          une protéine, un légume, à la poêle — et ton inventaire remplit ses
          places. C&apos;est de là que viennent les combinaisons proposées dans
          « Que cuisiner ».
        </p>
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          Ceux d&apos;origine décrivent une cuisine générique. Modifie-les jusqu&apos;à
          ce qu&apos;ils décrivent la tienne, ou mets-les en sommeil.
        </p>
      </header>

      <Patrons etats={etats} />
    </main>
  );
}
