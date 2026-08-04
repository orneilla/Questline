import type { Metadata } from "next";
import Link from "next/link";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { compterMots, racinesFrequentes, type RacineFrequente } from "@/lib/coran/donnees";
import { CORPUS_MORPHOLOGIE } from "@/lib/coran/sources";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Vocabulaire" };
export const dynamic = "force-dynamic";

/**
 * Le vocabulaire coranique.
 *
 * L'idée qui gouverne l'écran : les racines les plus fréquentes couvrent
 * l'essentiel du texte. On les montre donc par fréquence décroissante, en
 * marquant celles déjà travaillées — ce qui reste à apprendre saute aux yeux
 * sans qu'on ait à le reprocher à qui que ce soit.
 */
export default async function PageVocabulaire() {
  let racines: RacineFrequente[];
  let mots: number;

  try {
    [racines, mots] = await Promise.all([racinesFrequentes(300), compterMots()]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const connues = racines.filter((r) => r.connue);
  const couvertes = connues.reduce((total, r) => total + r.occurrences, 0);
  const totalRacines = racines.reduce((total, r) => total + r.occurrences, 0);
  const part = totalRacines === 0 ? 0 : Math.round((100 * couvertes) / totalRacines);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-7 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/coran" libelle="Coran" />
        <h1 className="police-titre text-[34px] leading-none">Vocabulaire</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Les trois cents racines les plus fréquentes du Coran, par fréquence
          décroissante. Les apprendre couvre l'essentiel du texte.
        </p>
      </header>

      {mots === 0 ? (
        <p className="text-[14px] leading-relaxed text-doux">
          L'analyse mot à mot n'est pas encore importée. Elle se lance depuis les
          réglages du Coran.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[19px] text-texte tabular-nums">
                {connues.length}
              </span>
              <span className="text-[11.5px] text-tres-doux">
                racines travaillées sur {racines.length}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[19px] text-texte tabular-nums">{part} %</span>
              <span className="text-[11.5px] text-tres-doux">
                des occurrences de ces racines
              </span>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
              Racines par fréquence
            </h2>
            <ul className="flex flex-col">
              {racines.map((racine, rang) => (
                <li
                  key={racine.racine}
                  className="flex items-center gap-3 border-b border-bordure py-2.5"
                >
                  <span className="w-8 shrink-0 text-[11px] text-tres-doux tabular-nums">
                    {rang + 1}
                  </span>
                  <span
                    dir="rtl"
                    lang="ar"
                    className="min-w-0 flex-1 text-[20px]"
                    style={{
                      fontFamily: '"Amiri Quran", "Amiri", "Noto Naskh Arabic", serif',
                      color: racine.connue ? "var(--color-texte)" : "var(--color-doux)",
                    }}
                  >
                    {racine.racine}
                  </span>
                  <span className="shrink-0 text-[12px] text-tres-doux tabular-nums">
                    {racine.occurrences}
                  </span>
                  <span
                    aria-label={racine.connue ? "déjà en carte" : "pas encore en carte"}
                    className="size-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: racine.connue ? "#8fa37e" : "var(--color-bordure-vive)",
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>

          <p className="text-[11.5px] leading-relaxed text-tres-doux">
            {CORPUS_MORPHOLOGIE.nom} — {CORPUS_MORPHOLOGIE.auteur}. {CORPUS_MORPHOLOGIE.lien}
          </p>

          <Link
            href="/coran/lire"
            className="flex min-h-12 items-center justify-center rounded-xl border border-bordure text-[14px] text-doux"
          >
            Lire, et appuyer sur un mot
          </Link>
        </>
      )}
    </main>
  );
}
