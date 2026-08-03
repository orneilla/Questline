import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { EditeurCarte, type PaquetChoix } from "@/components/cartes/editeur-carte";
import { chargerArborescence } from "@/lib/cartes/edition";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Nouvelle carte" };
export const dynamic = "force-dynamic";

export default async function PageNouvelleCarte({
  searchParams,
}: {
  searchParams: Promise<{ paquet?: string }>;
}) {
  const { paquet } = await searchParams;
  const demande = Number(paquet);

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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-7 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-5xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/cartes" libelle="Cartes" />
        <h1 className="police-titre text-[34px] leading-none">Nouvelle carte</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Le formulaire se vide après validation et garde le paquet : écris-en
          plusieurs d'affilée sans revenir en arrière.
        </p>
      </header>

      <EditeurCarte
        paquets={choix}
        paquetInitial={Number.isInteger(demande) ? demande : undefined}
      />
    </main>
  );
}
