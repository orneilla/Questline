import type { Metadata } from "next";
import Link from "next/link";

import { LienReglages } from "@/components/barre-navigation";
import { BarrePaquet } from "@/components/cartes/barre-paquet";
import { EcranInstallation } from "@/components/ecran-installation";
import { Plante, stadePour } from "@/components/jardin/plante";
import { chargerPaquets, previsions, type ResumePaquet } from "@/lib/cartes/donnees";
import { JOURS_SEMAINE } from "@/lib/constantes";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Cartes" };
export const dynamic = "force-dynamic";

/** Au-delà, une plante s'assoupit. */
const SOMMEIL_JOURS = 14;

function CartePaquet({ paquet }: { paquet: ResumePaquet }) {
  const { repartition: r } = paquet;
  const endormie =
    paquet.joursSansRevision !== null && paquet.joursSansRevision > SOMMEIL_JOURS;

  return (
    <Link
      href={`/cartes/${paquet.id}`}
      className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-bordure bg-surface px-4 py-4 transition-colors duration-300 active:bg-surface-haut"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[2px] opacity-70"
        style={{ backgroundColor: paquet.couleur }}
      />

      <Plante
        stade={stadePour(r.maitrise)}
        taille={52}
        endormie={endormie}
        teinte={paquet.couleur}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[16px] text-texte">{paquet.nom}</span>
          <span className="shrink-0 text-[13px] tabular-nums text-doux">
            {r.maitrise} %
          </span>
        </span>

        <span className="mt-2 block">
          <BarrePaquet repartition={r} />
        </span>

        <span className="mt-2 block text-[12px] text-tres-doux">
          {r.total} carte{r.total > 1 ? "s" : ""}
          {paquet.duesAujourdhui > 0 ? ` · ${paquet.duesAujourdhui} dues` : " · à jour"}
          {endormie ? " · en sommeil" : ""}
        </span>
      </span>
    </Link>
  );
}

export default async function PageCartes() {
  let liste: ResumePaquet[];
  let prevision: { date: string; combien: number }[];

  try {
    [liste, prevision] = await Promise.all([chargerPaquets(), previsions(7)]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const dues = liste.reduce((t, p) => t + p.duesAujourdhui, 0);
  // Les trois plantes les plus avancées : un aperçu qui donne envie d'entrer.
  const apercuJardin = [...liste]
    .sort((a, b) => b.repartition.maitrise - a.repartition.maitrise)
    .slice(0, 3);
  const espaces = [...new Map(liste.map((p) => [p.espaceId, p])).values()];
  const maximum = Math.max(1, ...prevision.map((p) => p.combien));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-3xl">
      <header className="apparait flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
            {dues > 0 ? `${dues} cartes dues` : "rien à réviser"}
          </p>
          <h1 className="police-titre text-[34px] leading-none">Cartes</h1>
        </div>
        <div className="pt-1">
          <LienReglages />
        </div>
      </header>

      <Link
        href="/jardin"
        className="flex items-center justify-between gap-4 rounded-2xl border border-bordure bg-surface px-5 py-4 transition-colors duration-300 active:bg-surface-haut"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[16px] text-texte">Le jardin</span>
          <span className="text-[12px] text-tres-doux">
            {liste.length} plante{liste.length > 1 ? "s" : ""}, une par paquet
          </span>
        </span>
        <span aria-hidden className="flex items-end gap-1">
          {apercuJardin.map((paquet) => (
            <Plante
              key={paquet.id}
              stade={stadePour(paquet.repartition.maitrise)}
              taille={34}
              teinte={paquet.couleur}
              endormie={
                paquet.joursSansRevision !== null &&
                paquet.joursSansRevision > SOMMEIL_JOURS
              }
            />
          ))}
        </span>
      </Link>

      {dues > 0 && (
        <Link
          href="/cartes/tout"
          className="flex min-h-16 items-center justify-between rounded-2xl border border-bordure-vive bg-surface-haut px-5 text-[17px] text-texte transition-colors duration-300 active:bg-bordure"
        >
          Réviser tout
          <span className="text-[14px] tabular-nums text-doux">{dues}</span>
        </Link>
      )}

      {espaces.map((tete) => (
        <section key={tete.espaceId} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2.5 text-[13px] tracking-[0.14em] text-doux uppercase">
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ backgroundColor: tete.couleur }}
            />
            {tete.espaceNom}
          </h2>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
            {liste
              .filter((p) => p.espaceId === tete.espaceId)
              .map((paquet) => (
                <CartePaquet key={paquet.id} paquet={paquet} />
              ))}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Les sept prochains jours
        </h2>
        <div className="flex items-end gap-1.5">
          {prevision.map((jour) => (
            <div key={jour.date} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-tres-doux">
                {jour.combien || ""}
              </span>
              <div
                className="w-full rounded-sm bg-bordure-vive"
                style={{ height: `${8 + (56 * jour.combien) / maximum}px` }}
              />
              <span className="text-[10px] text-tres-doux">
                {JOURS_SEMAINE[
                  new Date(`${jour.date}T00:00:00Z`).getUTCDay()
                ].slice(0, 1)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
