import type { Metadata } from "next";
import Link from "next/link";

import { EcranInstallation } from "@/components/ecran-installation";
import { Inventaire } from "@/components/cuisine/inventaire";
import {
  chargerInventaire,
  etatCatalogue,
  type EtatCatalogue,
  type LigneInventaire,
} from "@/lib/cuisine/donnees";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Cuisine" };
export const dynamic = "force-dynamic";

export default async function PageCuisine() {
  let articles: LigneInventaire[];
  let catalogue: EtatCatalogue;

  try {
    [articles, catalogue] = await Promise.all([chargerInventaire(), etatCatalogue()]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const epuises = articles.filter((a) => a.niveau === "epuise").length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-7 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
          {articles.length} article{articles.length > 1 ? "s" : ""}
          {epuises > 0 ? ` · ${epuises} épuisé${epuises > 1 ? "s" : ""}` : ""}
        </p>
        <h1 className="police-titre text-[34px] leading-none">Cuisine</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Ce que tu as chez toi, à la louche. Un tap sur un article fait tourner son
          niveau : beaucoup, un peu, épuisé.
        </p>
      </header>

      <div className="flex flex-col gap-2">
      <Link
        href="/cuisine/suggestions"
        className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-bordure-vive bg-surface-haut px-5 transition-colors duration-300 active:bg-bordure"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[16px] text-texte">Que cuisiner</span>
          <span className="text-[12px] text-tres-doux">
            À partir de ce que tu as, sans rien inventer
          </span>
        </span>
        <span aria-hidden className="text-tres-doux">
          →
        </span>
      </Link>

      <Link
        href="/cuisine/courses"
        className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-bordure bg-surface px-5 transition-colors duration-300 active:bg-surface-haut"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[16px] text-texte">Liste de courses</span>
          <span className="text-[12px] text-tres-doux">
            Cocher « acheté » remplit l'inventaire
          </span>
        </span>
        <span aria-hidden className="text-tres-doux">
          →
        </span>
      </Link>

      <Link
        href="/cuisine/recettes"
        className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-bordure bg-surface px-5 transition-colors duration-300 active:bg-surface-haut"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[16px] text-texte">Recettes</span>
          <span className="text-[12px] text-tres-doux">
            Grammages crus, valeurs nutritionnelles
          </span>
        </span>
        <span aria-hidden className="text-tres-doux">
          →
        </span>
      </Link>
      </div>

      <Inventaire articles={articles} />

      {/*
        Le catalogue nutritionnel n'est pas nécessaire pour tenir un inventaire.
        Tant qu'il est vide, on le signale sans en faire un obstacle : les
        phases suivantes en auront besoin, pas celle-ci.
      */}
      <section className="flex flex-col gap-2 border-t border-bordure pt-5">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Base nutritionnelle
        </h2>
        {catalogue.total === 0 ? (
          <>
            <p className="text-[12.5px] leading-relaxed text-tres-doux">
              Aucun aliment de référence pour l'instant. Les valeurs nutritionnelles
              viendront de la table Ciqual de l'Anses, à déposer une fois.
            </p>
            <Link
              href="/cuisine/ciqual"
              className="mt-1 flex min-h-12 items-center justify-center rounded-xl border border-bordure text-[13.5px] text-doux transition-colors duration-300 active:bg-surface-haut"
            >
              Déposer la table Ciqual
            </Link>
          </>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-tres-doux">
            {catalogue.total.toLocaleString("fr-FR")} aliments de référence —{" "}
            {catalogue.ciqual.toLocaleString("fr-FR")} depuis Ciqual (Anses)
            {catalogue.manuel > 0 ? `, ${catalogue.manuel} saisis à la main` : ""}.{" "}
            <Link href="/cuisine/ciqual" className="underline underline-offset-4">
              Remettre à jour
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
