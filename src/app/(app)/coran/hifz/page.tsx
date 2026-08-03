import type { Metadata } from "next";
import Link from "next/link";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { progresHifz, type ProgresSourate } from "@/lib/coran/donnees";
import { paquetsCoran } from "@/lib/coran/hifz";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Mémorisation" };
export const dynamic = "force-dynamic";

export default async function PageHifz() {
  let progres: ProgresSourate[];
  let paquets: { id: number; nom: string }[];

  try {
    [progres, paquets] = await Promise.all([progresHifz(), paquetsCoran()]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const versetsCommences = progres.reduce((total, s) => total + s.memorisees, 0);
  const consolides = progres.reduce((total, s) => total + s.consolidees, 0);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-7 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/coran" libelle="Coran" />
        <h1 className="police-titre text-[34px] leading-none">Mémorisation</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Les versets mis en carte passent par le module Cartes : même
          ordonnancement FSRS, même file d'apprentissage. Ce qui est compté ici,
          ce sont les cartes qui existent, pas une note attribuée à ta mémoire.
        </p>
      </header>

      {progres.length === 0 ? (
        <p className="text-[14px] leading-relaxed text-doux">
          Aucun verset mis en carte pour l'instant. Depuis la lecture, un appui sur
          le numéro d'un verset ouvre les trois formats possibles.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[19px] text-texte tabular-nums">
                {versetsCommences}
              </span>
              <span className="text-[11.5px] text-tres-doux">versets en carte</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[19px] text-texte tabular-nums">{consolides}</span>
              <span className="text-[11.5px] text-tres-doux">
                consolidés — intervalle au-delà de trois semaines
              </span>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
              Sourates commencées
            </h2>
            <ul className="flex flex-col gap-3">
              {progres.map((sourate) => (
                <li key={sourate.numero} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/coran/lire?sourate=${sourate.numero}`}
                      className="min-w-0 truncate text-[15px] text-texte underline-offset-4 active:underline"
                    >
                      {sourate.numero}. {sourate.nom}
                    </Link>
                    <span className="shrink-0 text-[12px] text-doux tabular-nums">
                      {sourate.part} %
                    </span>
                  </div>
                  <span
                    aria-hidden
                    className="flex h-1.5 w-full overflow-hidden rounded-full bg-bordure"
                  >
                    <span
                      style={{
                        width: `${Math.min(100, (100 * sourate.consolidees) / Math.max(1, sourate.versets))}%`,
                        backgroundColor: "#8fa37e",
                      }}
                    />
                    <span
                      style={{
                        width: `${Math.min(100, (100 * (sourate.memorisees - sourate.consolidees)) / Math.max(1, sourate.versets))}%`,
                        backgroundColor: "#c2a567",
                      }}
                    />
                  </span>
                  <span className="text-[11.5px] text-tres-doux tabular-nums">
                    {sourate.memorisees} verset{sourate.memorisees > 1 ? "s" : ""} sur{" "}
                    {sourate.versets} · {sourate.consolidees} consolidé
                    {sourate.consolidees > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {paquets.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
            Réviser
          </h2>
          <ul className="flex flex-col gap-2">
            {paquets.map((paquet) => (
              <li key={paquet.id}>
                <Link
                  href={`/cartes/${paquet.id}`}
                  className="flex min-h-12 items-center rounded-xl border border-bordure px-4 text-[14.5px] text-doux transition-colors duration-200 active:bg-surface"
                >
                  {paquet.nom}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
