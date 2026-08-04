import type { Metadata } from "next";
import Link from "next/link";

import { EcranInstallation } from "@/components/ecran-installation";
import { LienReglages } from "@/components/barre-navigation";
import { chargerArcs, type ResumeArc } from "@/lib/arcs";
import { COULEURS_PILIERS, LIBELLES_PILIERS, PILIERS } from "@/lib/constantes";
import { formaterDateLongue } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Arcs" };
export const dynamic = "force-dynamic";

function CarteArc({ arc }: { arc: ResumeArc }) {
  const couleur = COULEURS_PILIERS[arc.pilier];

  return (
    <Link
      href={`/arcs/${arc.id}`}
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-bordure bg-surface px-5 py-4 transition-colors duration-300 active:bg-surface-haut"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[2px] opacity-70"
        style={{ backgroundColor: couleur }}
      />

      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[17px] leading-snug text-texte">
          {arc.nom}
          {!arc.actif && <span className="text-tres-doux"> · en sommeil</span>}
        </h3>
        <span className="shrink-0 text-[13px] tabular-nums text-doux">
          {arc.progression} %
        </span>
      </div>

      <div className="h-[3px] w-full overflow-hidden rounded-full bg-bordure">
        <div
          className="h-full rounded-full"
          style={{ width: `${arc.progression}%`, backgroundColor: couleur }}
        />
      </div>

      <p className="text-[13.5px] leading-relaxed text-doux">{arc.vision}</p>

      {arc.etapesTotal > 0 && (
        <p className="text-[12px] text-tres-doux tabular-nums">
          {arc.etapesFaites} étape{arc.etapesFaites > 1 ? "s" : ""} sur{" "}
          {arc.etapesTotal}
        </p>
      )}

      <p className="text-[12px] text-tres-doux">
        {arc.nombreValidations} validation{arc.nombreValidations > 1 ? "s" : ""} ·{" "}
        {arc.points} points
        {arc.derniereActivite
          ? ` · dernière le ${formaterDateLongue(arc.derniereActivite)}`
          : " · pas encore commencé"}
      </p>
    </Link>
  );
}

export default async function PageArcs() {
  let liste: ResumeArc[];
  try {
    liste = await chargerArcs();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  // Les arcs accomplis ont leur propre page : ils ne se mêlent pas aux vivants.
  const enCours = liste.filter((a) => a.accompliLe === null);
  const accomplis = liste.length - enCours.length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-9 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10">
      <header className="apparait flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
            {enCours.length} arcs en cours
          </p>
          <h1 className="police-titre text-[34px] leading-none">Arcs</h1>
        </div>
        <div className="pt-1">
          <LienReglages />
        </div>
      </header>

      <div className="flex gap-2">
        <Link
          href="/arcs/nouveau"
          className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte"
        >
          Nouvel arc
        </Link>
        <Link
          href="/arcs/accomplis"
          className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-bordure text-[13.5px] text-doux"
        >
          Accomplis{accomplis > 0 ? ` · ${accomplis}` : ""}
        </Link>
      </div>

      {PILIERS.map((pilier) => {
        const duPilier = enCours.filter((a) => a.pilier === pilier);
        if (duPilier.length === 0) return null;

        return (
          <section key={pilier} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2.5 text-[13px] tracking-[0.14em] text-doux uppercase">
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: COULEURS_PILIERS[pilier] }}
              />
              {LIBELLES_PILIERS[pilier]}
            </h2>
            {duPilier.map((arc) => (
              <CarteArc key={arc.id} arc={arc} />
            ))}
          </section>
        );
      })}

      <p className="text-[12px] leading-relaxed text-tres-doux">
        La progression se lit dans les validations : poids cumulés rapportés à ce que
        l'arc rapporterait en tenant son rythme pendant douze semaines. Rien n'est
        saisi à la main.
      </p>
    </main>
  );
}
