import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { Courses } from "@/components/cuisine/courses";
import { chargerCourses } from "@/lib/cuisine/donnees";
import { diagnostiquer } from "@/lib/erreurs";
import type { ArticleCourses } from "@/db/cuisine";

export const metadata: Metadata = { title: "Questline — Courses" };
export const dynamic = "force-dynamic";

export default async function PageCourses() {
  let articles: ArticleCourses[];

  try {
    articles = await chargerCourses();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const restants = articles.filter((a) => !a.achete).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/cuisine" libelle="Cuisine" />
        <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
          {restants} à prendre
        </p>
        <h1 className="police-titre text-[34px] leading-none">Courses</h1>
      </header>

      <Courses articles={articles} />
    </main>
  );
}
