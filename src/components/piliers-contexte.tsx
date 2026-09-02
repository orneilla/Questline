"use client";

import { createContext, useContext, useMemo } from "react";

import {
  couleurPilier,
  nomPilier,
  PILIERS_ORIGINE,
  type PilierAffiche,
} from "@/lib/piliers-partage";

/**
 * Les piliers, mis à disposition des composants client.
 *
 * Ils viennent de la base, et la base ne se lit pas depuis le navigateur. La
 * coque de l'application les charge une fois et les passe ici ; tout ce qui
 * affiche un nom ou une teinte de pilier les lit par ce canal plutôt que par
 * une constante figée.
 *
 * Le repli sur les piliers d'origine n'est pas décoratif : un composant peut
 * être rendu hors de la coque — un écran d'installation, un test — et il doit
 * afficher quelque chose de juste plutôt que de casser.
 */

const Contexte = createContext<PilierAffiche[]>(PILIERS_ORIGINE);

export function PiliersProvider({
  valeur,
  children,
}: {
  valeur: PilierAffiche[];
  children: React.ReactNode;
}) {
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function usePiliers() {
  const liste = useContext(Contexte);

  return useMemo(
    () => ({
      liste,
      nom: (cle: string | null) => nomPilier(liste, cle),
      couleur: (cle: string | null) => couleurPilier(liste, cle),
    }),
    [liste],
  );
}
