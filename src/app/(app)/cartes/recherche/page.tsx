import type { Metadata } from "next";
import Link from "next/link";

import { EcranInstallation } from "@/components/ecran-installation";
import { Recherche } from "@/components/cartes/recherche";
import type { PaquetChoix } from "@/components/cartes/editeur-carte";
import { chargerArborescence } from "@/lib/cartes/edition";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Chercher" };
export const dynamic = "force-dynamic";

export default async function PageRecherche() {
  let choix: PaquetChoix[];

  try {
    const arbre = await chargerArborescence();
    choix = arbre.flatMap((espace) =>
      espace.paquets.map((p) => ({
        id: p.id,
        nom: p.nom,
        espaceNom: espace.nom,
        couleur: espace.couleur,
      })),
    );
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-7 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-3xl">
      <header className="apparait flex flex-col gap-2.5">
        <Link
          href="/cartes"
          className="text-[12px] tracking-[0.14em] text-tres-doux uppercase transition-colors duration-300 active:text-doux"
        >
          ← Cartes
        </Link>
        <h1 className="police-titre text-[34px] leading-none">Chercher</h1>
      </header>

      <Recherche paquets={choix} />
    </main>
  );
}
