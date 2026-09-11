import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { AlimentsEmballes } from "@/components/cuisine/aliments-emballes";
import { listerAlimentsManuels, type AlimentManuel } from "@/lib/cuisine/aliments";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Produits emballés" };
export const dynamic = "force-dynamic";

/**
 * Les produits emballés, saisis depuis leur étiquette.
 *
 * Le catalogue venait entièrement de Ciqual : des produits bruts. Une barre
 * achetée n'y est pas et n'y sera jamais, ce n'est pas le rôle de cette table.
 * Cet écran est la seule façon d'en ajouter, et il dit d'où viennent les
 * chiffres : d'une recopie, donc d'une source moins sûre que l'Anses.
 */
export default async function PageAliments() {
  let liste: AlimentManuel[];

  try {
    liste = await listerAlimentsManuels();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-7 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/cuisine" libelle="Cuisine" />
        <h1 className="police-titre text-[30px] leading-tight">Produits emballés</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          La table Ciqual ne contient que des produits bruts — une pomme, de la
          farine, du blanc de poulet. Une barre, un yaourt de marque, un plat
          préparé n&apos;y sont pas. Ici, tu recopies leur étiquette une fois, et
          ils rejoignent le catalogue comme les autres.
        </p>
      </header>

      <AlimentsEmballes liste={liste} />

      <section className="flex flex-col gap-2 border-t border-bordure pt-5">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          D&apos;où viennent ces chiffres
        </h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[12.5px] leading-relaxed text-tres-doux">
          <li>
            De ta recopie, donc de l&apos;emballage. C&apos;est la{" "}
            <span className="text-doux">source la moins sûre</span> des trois,
            parce qu&apos;elle dépend d&apos;une saisie : un chiffre mal recopié
            se retrouvera ensuite dans chaque repas noté.
          </li>
          <li>
            Rien n&apos;est deviné ni complété par ressemblance avec un produit
            voisin. Une valeur non imprimée reste vide, et le journal sait déjà
            dire qu&apos;un nutriment n&apos;est pas couvert.
          </li>
          <li>
            Le contrôle de saisie ne fait qu&apos;une chose : signaler un chiffre
            qui dépasse ce qu&apos;un aliment peut contenir. Il ne corrige rien.
          </li>
          <li>
            Retirer un produit ne touche pas aux repas déjà notés : chaque entrée
            du journal garde son propre instantané des valeurs.
          </li>
        </ul>
      </section>
    </main>
  );
}
