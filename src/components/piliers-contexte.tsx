"use client";

import { createContext, useContext, useMemo } from "react";

import {
  couleurPilier,
  nomPilier,
  PILIERS_ORIGINE,
  type PilierAffiche,
} from "@/lib/piliers-partage";
import {
  CATEGORIES_ORIGINE,
  couleurCategorieBloc,
  nomCategorieBloc,
  type CategorieAffichee,
} from "@/lib/categories-partage";

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

/**
 * Les catégories de créneau passent par le même canal, et pour la même
 * raison : leurs teintes viennent de la base, et ce sont des composants client
 * qui dessinent les blocs de l'emploi du temps.
 */
const ContexteCategories = createContext<CategorieAffichee[]>(CATEGORIES_ORIGINE);

export function PiliersProvider({
  valeur,
  categories = CATEGORIES_ORIGINE,
  children,
}: {
  valeur: PilierAffiche[];
  categories?: CategorieAffichee[];
  children: React.ReactNode;
}) {
  return (
    <Contexte.Provider value={valeur}>
      <ContexteCategories.Provider value={categories}>
        {children}
      </ContexteCategories.Provider>
    </Contexte.Provider>
  );
}

export function useCategoriesCreneau() {
  const liste = useContext(ContexteCategories);

  return useMemo(
    () => ({
      liste,
      nom: (cle: string | null) => nomCategorieBloc(liste, cle),
      couleur: (cle: string | null) => couleurCategorieBloc(liste, cle),
    }),
    [liste],
  );
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
