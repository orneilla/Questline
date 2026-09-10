import type { Metadata } from "next";
import { headers } from "next/headers";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { Categories } from "@/components/reglages/categories";
import { etatCategories, type EtatCategories } from "@/lib/categories";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Catégories" };
export const dynamic = "force-dynamic";

/** La clé de repli de `/api/setup`, quand SETUP_KEY n'est pas posée. */
const CLE_PAR_DEFAUT = "25afa9c6e7a8d65abf3f5e6f0b57ec8f";

/**
 * L'adresse d'installation, complète.
 *
 * Le domaine est lu dans l'en-tête de la requête plutôt qu'écrit en dur : une
 * adresse tronquée en `/api/setup?key=…` n'est pas ouvrable depuis une
 * tablette, où il n'y a pas de barre d'adresse à compléter à la main.
 */
async function adresseInstallation(): Promise<string> {
  const entetes = await headers();
  const hote = entetes.get("host") ?? "questline-six.vercel.app";
  const schema = hote.startsWith("localhost") ? "http" : "https";
  const cle = process.env.SETUP_KEY ?? CLE_PAR_DEFAUT;
  return `${schema}://${hote}/api/setup?key=${cle}`;
}

export default async function PageCategories() {
  let etat: EtatCategories;

  try {
    etat = await etatCategories();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/reglages" libelle="Réglages" />
        <h1 className="police-titre text-[30px] leading-tight">Catégories</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Chaque créneau de la semaine porte une catégorie, et chaque catégorie une
          teinte. C&apos;est ce qui permet de voir d&apos;un coup d&apos;œil où part
          la journée sans avoir à lire les titres.
        </p>
      </header>

      <Categories
        liste={etat.liste}
        regles={etat.regles}
        tableAbsente={etat.tableAbsente}
        adresseInstallation={await adresseInstallation()}
      />
    </main>
  );
}
