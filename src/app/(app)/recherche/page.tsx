import type { Metadata } from "next";

import { EcranInstallation } from "@/components/ecran-installation";
import { RechercheGlobale } from "@/components/recherche-globale";
import { Retour } from "@/components/retour";
import { diagnostiquer } from "@/lib/erreurs";
import { chercher } from "@/lib/recherche";
import {
  LIBELLES_TYPES,
  type GroupeResultats,
  type TypeResultat,
} from "@/lib/recherche-partage";

/**
 * Recherche globale.
 *
 * Le champ est servi par le serveur : la requête passe par l'URL, donc un
 * résultat se partage, se met en signet et survit au retour arrière. Les
 * derniers termes cherchés sont gardés côté navigateur — c'est un confort
 * personnel, il n'a rien à faire en base.
 */

export const metadata: Metadata = { title: "Questline — Recherche" };
export const dynamic = "force-dynamic";

const TYPES = Object.keys(LIBELLES_TYPES) as TypeResultat[];

function typeValide(valeur: string | undefined): TypeResultat | undefined {
  return valeur && (TYPES as string[]).includes(valeur)
    ? (valeur as TypeResultat)
    : undefined;
}

export default async function PageRecherche({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  const requete = (q ?? "").trim();
  const filtre = typeValide(type);

  let groupes: GroupeResultats[] = [];
  let erreur: string | null = null;

  if (requete.length > 0) {
    try {
      groupes = await chercher(requete, filtre);
    } catch (probleme) {
      const diagnostic = diagnostiquer(probleme);
      if (diagnostic) return <EcranInstallation probleme={diagnostic} />;
      erreur = probleme instanceof Error ? probleme.message : String(probleme);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/jour" libelle="Jour" />
        <h1 className="police-titre text-[34px] leading-none">Recherche</h1>
      </header>

      <RechercheGlobale
        requete={requete}
        filtre={filtre}
        groupes={groupes}
        erreur={erreur}
      />
    </main>
  );
}
