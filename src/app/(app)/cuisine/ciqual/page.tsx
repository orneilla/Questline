import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { DepotCiqual } from "@/components/cuisine/depot-ciqual";
import { etatCatalogue, type EtatCatalogue } from "@/lib/cuisine/donnees";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Base nutritionnelle" };
export const dynamic = "force-dynamic";

export default async function PageCiqual() {
  let catalogue: EtatCatalogue;

  try {
    catalogue = await etatCatalogue();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/cuisine" libelle="Cuisine" />
        <h1 className="police-titre text-[30px] leading-tight">Base nutritionnelle</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Les valeurs viennent de la table Ciqual de l'Anses, publiée librement. Le
          fichier se récupère à la main sur ciqual.anses.fr, en XML ou en CSV, puis se
          dépose ici — rien n'est téléchargé automatiquement.
        </p>
      </header>

      <DepotCiqual dejaCharges={catalogue.ciqual} />

      <section className="flex flex-col gap-2 border-t border-bordure pt-5">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Comment les valeurs sont lues
        </h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[12.5px] leading-relaxed text-tres-doux">
          <li>
            « traces » vaut zéro — c'est ce que le mot veut dire.
          </li>
          <li>
            « &lt; 0,1 » vaut 0,1, la borne haute : sur le sel et les sucres, arrondir
            vers le bas embellirait le compte.
          </li>
          <li>
            Un tiret ou une case vide ne valent rien du tout et restent vides. Écrire
            zéro affirmerait une mesure qui n'existe pas.
          </li>
          <li>
            Cru ou cuit se lit dans le libellé Ciqual. Ce qui ne dit rien est rangé en
            cru — les deux référentiels ne se mélangent jamais.
          </li>
        </ul>
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          Un classeur XLS n'est pas lu : réenregistre-le en CSV depuis le tableur.
        </p>
      </section>
    </main>
  );
}
