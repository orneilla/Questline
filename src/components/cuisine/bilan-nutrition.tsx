"use client";

import { useState } from "react";

import {
  formater,
  LIBELLES,
  NUTRIMENTS,
  portionPesee,
  type BilanNutrition,
} from "@/lib/cuisine/nutrition";

/**
 * Le tableau nutritionnel d'une recette.
 *
 * Trois colonnes possibles : la recette entière, une portion théorique, et —
 * quand le plat fini a été pesé — l'assiette réellement servie. La troisième
 * est la seule qui vaille vraiment : un plat perd ou prend du poids à la
 * cuisson, et diviser le cru par le nombre de parts ne dit rien de ce qu'on a
 * dans l'assiette.
 *
 * Ce qui manque est écrit, jamais arrondi à zéro. Un ingrédient sans fiche,
 * une valeur absente, une fiche saisie à la main : les trois se disent.
 */
export function TableauNutrition({
  bilan,
  nbPortions,
  poidsTotalCuitG,
}: {
  bilan: BilanNutrition;
  nbPortions: number;
  poidsTotalCuitG: number | null;
}) {
  const [assiette, setAssiette] = useState("");
  const pesee = portionPesee(bilan.total, poidsTotalCuitG, Number(assiette));

  const riens = NUTRIMENTS.every((c) => bilan.total[c] === undefined);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
        Valeurs nutritionnelles
      </h2>

      {riens ? (
        <p className="rounded-2xl border border-bordure/60 px-5 py-5 text-center text-[13.5px] leading-relaxed text-doux">
          Aucune valeur pour l'instant. Relie les ingrédients au catalogue pour
          que le calcul devienne possible.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[19rem] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-bordure text-[11.5px] tracking-[0.08em] text-tres-doux uppercase">
                <th className="py-2 text-left font-normal">Pour</th>
                <th className="py-2 text-right font-normal">
                  Tout{" "}
                  <span className="text-[10px] normal-case">
                    ({Math.round(bilan.poidsCruTotalG)} g crus)
                  </span>
                </th>
                <th className="py-2 text-right font-normal">
                  1 portion{" "}
                  <span className="text-[10px] normal-case">/ {nbPortions}</span>
                </th>
                {pesee && <th className="py-2 text-right font-normal">Assiette</th>}
              </tr>
            </thead>
            <tbody>
              {NUTRIMENTS.map((cle) => {
                const secondaire = cle === "sucres100g" || cle === "ags100g";
                return (
                  <tr key={cle} className="border-b border-bordure/50">
                    <td
                      className="py-2 pr-2"
                      style={{
                        color: secondaire
                          ? "var(--color-tres-doux)"
                          : "var(--color-doux)",
                        paddingLeft: secondaire ? "0.75rem" : 0,
                      }}
                    >
                      {LIBELLES[cle]}
                    </td>
                    <td className="py-2 text-right text-texte tabular-nums">
                      {formater(cle, bilan.total[cle])}
                    </td>
                    <td className="py-2 text-right text-texte tabular-nums">
                      {formater(cle, bilan.parPortion[cle])}
                    </td>
                    {pesee && (
                      <td className="py-2 text-right text-texte tabular-nums">
                        {formater(cle, pesee.valeurs[cle])}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {poidsTotalCuitG ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] tracking-[0.1em] text-tres-doux uppercase">
            Poids de mon assiette
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={assiette}
            onChange={(e) => setAssiette(e.target.value)}
            placeholder={`sur ${Math.round(poidsTotalCuitG)} g de plat fini`}
            className="min-h-12 rounded-xl border border-bordure bg-surface px-3 text-[15px] text-texte placeholder:text-tres-doux"
          />
          {pesee && (
            <span className="text-[12px] text-tres-doux">
              Soit {Math.round(pesee.part * 100)} % du plat.
            </span>
          )}
        </label>
      ) : (
        <p className="text-[12px] leading-relaxed text-tres-doux">
          Pèse le plat une fois terminé et note son poids dans la recette : tu
          pourras alors saisir le poids de ton assiette et obtenir la part réelle,
          au lieu d'une portion théorique.
        </p>
      )}

      {/*
        Les réserves. Elles sont dans le même bloc que les chiffres, pas dans
        une note de bas de page : un total incomplet lu sans sa réserve est un
        total faux.
      */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-bordure p-4">
        <span className="text-[11.5px] tracking-[0.1em] text-tres-doux uppercase">
          D'où viennent ces chiffres
        </span>
        <p className="text-[12px] leading-relaxed text-tres-doux">
          Somme des ingrédients en poids cru, d'après leurs fiches du catalogue.
        </p>

        {bilan.sansFiche.length > 0 && (
          <p className="text-[12px] leading-relaxed text-doux">
            Non comptés, faute de fiche : {bilan.sansFiche.join(", ")}. Leur poids
            n'entre dans aucun total.
          </p>
        )}

        {bilan.incomplets.length > 0 && (
          <p className="text-[12px] leading-relaxed text-doux">
            Incomplets — au moins une fiche ne donne pas la valeur :{" "}
            {bilan.incomplets.map((c) => LIBELLES[c]).join(", ")}.
          </p>
        )}

        {bilan.aVerifier.length > 0 && (
          <p className="text-[12px] leading-relaxed text-doux">
            ⚠ Saisis à la main, donc vérifiés par personne :{" "}
            {bilan.aVerifier.join(", ")}.
          </p>
        )}

        {bilan.melangeCruCuit && (
          <p className="text-[12px] leading-relaxed text-doux">
            ⚠ Une fiche « cuit » est utilisée alors que les grammages sont crus.
            Le total est faux tant que ce n'est pas corrigé.
          </p>
        )}
      </div>
    </section>
  );
}
