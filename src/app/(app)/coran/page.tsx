import type { Metadata } from "next";
import Link from "next/link";

import { LienReglages } from "@/components/barre-navigation";
import { Heatmap } from "@/components/cartes/heatmap";
import { EcranInstallation } from "@/components/ecran-installation";
import { MarquePages } from "@/components/coran/marque-pages";
import {
  chargerMarquePages,
  chargerSourates,
  compterVersets,
  joursDeLecture,
  positionCourante,
  progression,
  type Progression,
} from "@/lib/coran/donnees";
import { aujourdhui } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";
import type { Sourate } from "@/db/schema";

export const metadata: Metadata = { title: "Questline — Coran" };
export const dynamic = "force-dynamic";

const LIBELLES_UNITE = {
  versets: "versets",
  pages: "pages",
  minutes: "minutes",
} as const;

function Avancement({ etat }: { etat: Progression }) {
  const part = Math.min(100, Math.round((100 * etat.aujourdhui) / Math.max(1, etat.objectif)));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Aujourd'hui</h2>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] text-texte tabular-nums">
          {etat.aujourdhui} {LIBELLES_UNITE[etat.unite]}
        </span>
        <span className="text-[12.5px] text-tres-doux tabular-nums">
          objectif {etat.objectif}
        </span>
      </div>
      <span aria-hidden className="flex h-1.5 w-full overflow-hidden rounded-full bg-bordure">
        <span
          className="transition-[width] duration-700 ease-calme"
          style={{ width: `${part}%`, backgroundColor: "var(--color-deen)" }}
        />
      </span>
      <p className="text-[12.5px] leading-relaxed text-tres-doux">
        {etat.atteint
          ? "L'objectif du jour est atteint ; la quête du Coran est validée."
          : "Ce qui est lu est compté, quelle que soit la quantité."}
        {" "}
        {etat.versetsParcourus} versets parcourus sur le moushaf, soit {etat.partMoushaf} %.
      </p>
    </section>
  );
}

export default async function PageCoran() {
  let sourates: Sourate[];
  let etat: Progression;
  let jours: { date: string; combien: number }[];
  let position: number;
  let signets: Awaited<ReturnType<typeof chargerMarquePages>>;
  let versetsImportes: number;

  try {
    [sourates, etat, jours, position, signets, versetsImportes] = await Promise.all([
      chargerSourates(),
      progression(),
      joursDeLecture(),
      positionCourante(),
      chargerMarquePages(),
      compterVersets(),
    ]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  if (versetsImportes === 0) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10">
        <h1 className="police-titre text-[34px] leading-none">Coran</h1>
        <p className="text-[14.5px] leading-relaxed text-doux">
          Le texte n'est pas encore importé. Ouvre l'adresse d'installation dans un
          onglet : elle charge les 114 sourates par lots et reprend d'elle-même
          jusqu'au bout. Tu peux la laisser travailler.
        </p>
        <p className="rounded-xl border border-bordure bg-surface px-4 py-3 text-[13px] break-all text-tres-doux">
          /api/setup/coran?key=…
        </p>
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          Le texte arabe est celui du projet Tanzil, riwaya Hafs ‘an ‘Asim en graphie
          uthmanienne. Les traductions et la translittération se choisissent ensuite,
          une par une, après lecture de leurs conditions.
        </p>
      </main>
    );
  }

  const parJuz = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-3xl">
      <header className="apparait flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
            {versetsImportes} versets
          </p>
          <h1 className="police-titre text-[34px] leading-none">Coran</h1>
        </div>
        <div className="pt-1">
          <LienReglages />
        </div>
      </header>

      <Link
        href={`/coran/lire?verset=${position}`}
        className="flex min-h-16 items-center justify-between rounded-2xl border border-bordure-vive bg-surface-haut px-5 text-[17px] text-texte transition-colors duration-300 active:bg-bordure"
      >
        Reprendre la lecture
        <span className="text-[13px] text-doux tabular-nums">verset {position}</span>
      </Link>

      <Avancement etat={etat} />

      <Heatmap
        jours={jours}
        aujourdhui={aujourdhui()}
        libelles={{
          unite: "verset lu",
          unites: "versets lus",
          parJour: "versets par jour",
        }}
      />

      <div className="grid grid-cols-3 gap-2">
        <Link
          href="/coran/hifz"
          className="flex min-h-11 items-center justify-center rounded-xl border border-bordure px-3 text-[13px] text-doux transition-colors duration-300 active:bg-surface"
        >
          Mémorisation
        </Link>
        <Link
          href="/coran/vocabulaire"
          className="flex min-h-11 items-center justify-center rounded-xl border border-bordure px-3 text-[13px] text-doux transition-colors duration-300 active:bg-surface"
        >
          Vocabulaire
        </Link>
        <Link
          href="/coran/reglages"
          className="flex min-h-11 items-center justify-center rounded-xl border border-bordure px-3 text-[13px] text-doux transition-colors duration-300 active:bg-surface"
        >
          Réglages
        </Link>
      </div>

      {signets.length > 0 && <MarquePages signets={signets} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Par juz’</h2>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {parJuz.map((juz) => (
            <Link
              key={juz}
              href={`/coran/lire?juz=${juz}`}
              className="flex min-h-11 items-center justify-center rounded-xl border border-bordure text-[13px] text-doux tabular-nums transition-colors duration-300 active:bg-surface"
            >
              {juz}
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Les 114 sourates
        </h2>
        <ul className="flex flex-col">
          {sourates.map((sourate) => (
            <li key={sourate.numero}>
              <Link
                href={`/coran/lire?sourate=${sourate.numero}`}
                className="flex items-center gap-3 border-b border-bordure py-3 transition-colors duration-200 active:bg-surface"
              >
                <span className="w-7 shrink-0 text-[12px] text-tres-doux tabular-nums">
                  {sourate.numero}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-texte">
                    {sourate.nomTranslittere}
                  </span>
                  <span className="block truncate text-[11.5px] text-tres-doux">
                    {sourate.sensDuNom} · {sourate.versets} versets ·{" "}
                    {sourate.revelation === "mecquoise" ? "mecquoise" : "médinoise"}
                  </span>
                </span>
                <span
                  dir="rtl"
                  lang="ar"
                  className="shrink-0 text-[17px] text-doux"
                  style={{ fontFamily: '"Amiri Quran", "Amiri", "Noto Naskh Arabic", serif' }}
                >
                  {sourate.nomArabe}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
