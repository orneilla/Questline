import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { TableauNutrition } from "@/components/cuisine/bilan-nutrition";
import { Instructions } from "@/components/cuisine/instructions";
import {
  ApresCuisine,
  FicheRecette,
  Ingredients,
} from "@/components/cuisine/editeur-recette";
import { chargerRecette, type DetailRecette } from "@/lib/cuisine/recettes";
import { etatCatalogue, type EtatCatalogue } from "@/lib/cuisine/donnees";
import { nomCuisson } from "@/lib/cuisine/nutrition";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Recette" };
export const dynamic = "force-dynamic";

export default async function PageRecette({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero)) notFound();

  let detail: DetailRecette | null;
  let catalogue: EtatCatalogue;
  try {
    [detail, catalogue] = await Promise.all([chargerRecette(numero), etatCatalogue()]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }
  if (!detail) notFound();

  const { recette, ingredients, bilan } = detail;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2">
        <Retour vers="/cuisine/recettes" libelle="Recettes" />
        <h1 className="police-titre text-[30px] leading-tight">{recette.nom}</h1>
        <p className="text-[12.5px] text-tres-doux">
          {nomCuisson(recette.modeCuisson)}
          {recette.tempsMinutes > 0 ? ` · ${recette.tempsMinutes} min` : ""} ·{" "}
          {recette.nbPortions} portion{recette.nbPortions > 1 ? "s" : ""}
        </p>
      </header>

      <ApresCuisine recette={recette} />

      <Ingredients
        recetteId={recette.id}
        ingredients={ingredients}
        catalogueVide={catalogue.total === 0}
      />

      <TableauNutrition
        bilan={bilan}
        nbPortions={recette.nbPortions}
        poidsTotalCuitG={recette.poidsTotalCuitG}
      />

      {recette.instructions.trim().length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
            Préparation
          </h2>
          <Instructions texte={recette.instructions} />
        </section>
      )}

      <section className="flex flex-col gap-3 border-t border-bordure pt-6">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Modifier
        </h2>
        <FicheRecette recette={recette} />
      </section>
    </main>
  );
}
