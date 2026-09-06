import type { Metadata } from "next";
import Link from "next/link";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { NouvelleRecette } from "@/components/cuisine/nouvelle-recette";
import { chargerRecettes, type ResumeRecette } from "@/lib/cuisine/recettes";
import { nomCuisson } from "@/lib/cuisine/nutrition";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Recettes" };
export const dynamic = "force-dynamic";

export default async function PageRecettes() {
  let recettes: ResumeRecette[];

  try {
    recettes = await chargerRecettes();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/cuisine" libelle="Cuisine" />
        <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
          {recettes.length} recette{recettes.length > 1 ? "s" : ""}
        </p>
        <h1 className="police-titre text-[34px] leading-none">Recettes</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Les grammages sont toujours en poids cru. Une recette se refait en la
          copiant : tu ne changes que les lignes qui changent.
        </p>
      </header>

      <NouvelleRecette />

      {recettes.length === 0 ? (
        <p className="rounded-2xl border border-bordure/60 px-5 py-6 text-center text-[14px] leading-relaxed text-doux">
          Aucune recette. La première se crée ci-dessus, et se remplit ingrédient
          par ingrédient — approximatif d'abord, pesé ensuite.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {recettes.map((r) => (
            <li key={r.id}>
              <Link
                href={`/cuisine/recettes/${r.id}`}
                className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-bordure bg-surface px-5 transition-colors duration-300 active:bg-surface-haut"
                style={{ opacity: r.jeReferai ? 1 : 0.6 }}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[16px] text-texte">{r.nom}</span>
                  <span className="text-[12px] text-tres-doux">
                    {r.nbIngredients} ingrédient{r.nbIngredients > 1 ? "s" : ""} ·{" "}
                    {nomCuisson(r.modeCuisson)}
                    {r.tempsMinutes > 0 ? ` · ${r.tempsMinutes} min` : ""}
                    {r.nbFoisCuisinee > 0 ? ` · ${r.nbFoisCuisinee}×` : ""}
                    {r.nbSansFiche > 0 ? ` · ${r.nbSansFiche} sans fiche` : ""}
                    {!r.jeReferai ? " · à ne pas refaire" : ""}
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-tres-doux">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
