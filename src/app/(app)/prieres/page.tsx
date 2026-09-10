import type { Metadata } from "next";
import Link from "next/link";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { Journee } from "@/components/prieres/journee";
import { Mois } from "@/components/prieres/mois";
import {
  chargerJournee,
  chargerMois,
  reperesPour,
  type MoisPrieres,
} from "@/lib/prieres/donnees";
import { aujourdhui, formaterDateLongue } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Prières" };
export const dynamic = "force-dynamic";

/**
 * Le suivi des cinq prières.
 *
 * Un écran à part, qui ne parle à rien d'autre. Ce qui est coché ici ne
 * crédite aucun pilier, ne fait pas bouger l'élan, n'ouvre aucune journée dans
 * le journal et n'entre dans aucune saison. C'était la condition posée, et
 * elle tient par la structure : aucune des tables du suivi n'est lue ailleurs.
 */

function dateDemandee(valeur: string | undefined, cejour: string): string {
  if (!valeur || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return cejour;
  // Pas de jour futur : il n'y a rien à y cocher, et une coche posée d'avance
  // ne voudrait rien dire.
  return valeur > cejour ? cejour : valeur;
}

export default async function PagePrieres({
  searchParams,
}: {
  searchParams: Promise<{ jour?: string }>;
}) {
  const cejour = aujourdhui();
  const { jour } = await searchParams;
  const date = dateDemandee(jour, cejour);

  let journee: Awaited<ReturnType<typeof chargerJournee>>;
  let mois: MoisPrieres;

  try {
    [journee, mois] = await Promise.all([chargerJournee(date), chargerMois(date)]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const calcul = reperesPour(date, journee.reglages);
  const estAujourdhui = date === cejour;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/jour" libelle="Jour" />
        <h1 className="police-titre text-[34px] leading-none">Prières</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          {estAujourdhui
            ? formaterDateLongue(date)
            : `${formaterDateLongue(date)} — jour passé`}
        </p>
      </header>

      {calcul === null ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-bordure-vive p-4">
          <p className="text-[13.5px] leading-relaxed text-doux">
            Les heures dépendent de l&apos;endroit où tu es : la position du soleil
            n&apos;est pas la même à Lille et à Marseille. Tant que le lieu
            n&apos;est pas posé, aucune heure ne peut être affichée — et en inventer
            une serait pire que de n&apos;en montrer aucune.
          </p>
          <Link
            href="/prieres/reglages"
            className="flex min-h-12 items-center justify-center rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte"
          >
            Poser le lieu
          </Link>
        </section>
      ) : (
        <>
          <Journee
            date={date}
            reperes={calcul.reperes}
            faites={journee.faites}
            aujourdhui={estAujourdhui}
          />

          {journee.nuitCourte && (
            <p className="-mt-4 px-0.5 text-[11.5px] leading-relaxed text-tres-doux">
              À cette latitude, la nuit de cette saison est trop courte pour que le
              soleil atteigne l&apos;angle du Fajr ou de l&apos;Isha. L&apos;heure
              affichée — quand il y en a une — vient de la règle de repli choisie
              dans les réglages, pas d&apos;une observation.
            </p>
          )}

          <Mois libelle={mois.libelle} jours={mois.jours} dateChoisie={date} />
        </>
      )}

      <section className="flex flex-col gap-2 border-t border-bordure pt-5">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          D&apos;où viennent ces heures
        </h2>
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          Calcul de la position du soleil fait sur cet appareil, sans service
          extérieur. Convention retenue :{" "}
          <span className="text-doux">{journee.convention}</span>, publiée par{" "}
          {journee.sourceConvention}.
          {journee.reglages.lieu && (
            <>
              {" "}
              Lieu : <span className="text-doux">{journee.reglages.lieu}</span>.
            </>
          )}
        </p>
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          Un calcul et un calendrier imprimé diffèrent souvent d&apos;une ou deux
          minutes. Compare une fois avec celui de ta mosquée : si l&apos;écart est
          constant, la correction par prière le rattrape.
        </p>
        <Link
          href="/prieres/reglages"
          className="mt-1 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-bordure bg-surface px-5 transition-colors duration-300 active:bg-surface-haut"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] text-texte">Réglages des prières</span>
            <span className="text-[12px] text-tres-doux">
              Lieu, convention, corrections, rappels
            </span>
          </span>
          <span aria-hidden className="text-tres-doux">
            →
          </span>
        </Link>
      </section>
    </main>
  );
}
