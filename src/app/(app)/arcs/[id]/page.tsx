import type { Metadata } from "next";
import { Retour } from "@/components/retour";
import { notFound } from "next/navigation";

import { EcranInstallation } from "@/components/ecran-installation";
import { chargerArc, HORIZON_SEMAINES, type DetailArc } from "@/lib/arcs";
import { COULEURS_PILIERS, JOURS_SEMAINE, LIBELLES_PILIERS } from "@/lib/constantes";
import { formaterDateLongue } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Arc" };
export const dynamic = "force-dynamic";

function cadence(frequenceSem: number): string {
  if (frequenceSem >= 7) return "tous les jours";
  if (frequenceSem === 1) return "une fois par semaine";
  return `${frequenceSem} fois par semaine`;
}

export default async function PageArc({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero)) notFound();

  let arc: DetailArc | null;
  try {
    arc = await chargerArc(numero);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }
  if (!arc) notFound();

  const couleur = COULEURS_PILIERS[arc.pilier];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-9 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10">
      <header className="apparait flex flex-col gap-3">
        <Retour vers="/arcs" libelle="Arcs" />

        <p
          className="flex items-center gap-2 text-[12px] tracking-[0.14em] uppercase"
          style={{ color: couleur }}
        >
          <span
            aria-hidden
            className="size-1.5 rounded-full"
            style={{ backgroundColor: couleur }}
          />
          {LIBELLES_PILIERS[arc.pilier]}
        </p>

        <h1 className="police-titre text-[30px] leading-tight">{arc.nom}</h1>
        <p className="text-[14.5px] leading-relaxed text-doux">{arc.vision}</p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] tracking-[0.14em] text-doux uppercase">
            Progression
          </span>
          <span className="text-[15px] tabular-nums text-texte">{arc.progression} %</span>
        </div>

        <div className="h-[3px] w-full overflow-hidden rounded-full bg-bordure">
          <div
            className="h-full rounded-full"
            style={{ width: `${arc.progression}%`, backgroundColor: couleur }}
          />
        </div>

        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          {arc.points} points cumulés sur {arc.objectif} — ce que cet arc rapporterait
          en tenant son rythme pendant {HORIZON_SEMAINES} semaines.{" "}
          {arc.nombreValidations} validation{arc.nombreValidations > 1 ? "s" : ""}.
        </p>

        <p className="text-[12.5px] text-tres-doux">
          {arc.derniereActivite
            ? `Dernière activité : ${formaterDateLongue(arc.derniereActivite)}.`
            : "Aucune validation pour l'instant."}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Quêtes ({arc.quetes.length})
        </h2>

        {arc.quetes.map((quete) => (
          <div
            key={quete.id}
            className="flex flex-col gap-1.5 rounded-2xl border border-bordure bg-surface px-5 py-4"
            style={{ opacity: quete.actif ? 1 : 0.55 }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15.5px] leading-snug text-texte">{quete.titre}</span>
              <span className="shrink-0 text-[12px] tabular-nums text-tres-doux">
                {quete.nombreValidations}×
              </span>
            </div>
            <span className="text-[12px] text-tres-doux">
              poids {quete.poids} ·{" "}
              {quete.dureeMin > 0 ? `${quete.dureeMin} min` : "au fil du jour"} ·{" "}
              {cadence(quete.frequenceSem)}
              {quete.minimale ? " · minimale" : ""}
              {!quete.actif ? " · désactivée" : ""}
            </span>
            {quete.derniereActivite && (
              <span className="text-[12px] text-tres-doux">
                dernière le {formaterDateLongue(quete.derniereActivite)}
              </span>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Historique</h2>

        {arc.historique.length === 0 ? (
          <p className="rounded-2xl border border-bordure/60 px-5 py-6 text-center text-[14px] leading-relaxed text-doux">
            Rien encore. Cet arc attend son premier geste.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {arc.historique.map((ligne) => (
              <li key={ligne.id} className="flex items-baseline gap-3">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 translate-y-[-2px] rounded-full"
                  style={{ backgroundColor: couleur, opacity: ligne.bonusReprise ? 1 : 0.45 }}
                />
                <span className="w-[92px] shrink-0 text-[12px] text-tres-doux tabular-nums">
                  {JOURS_SEMAINE[
                    new Date(`${ligne.date}T00:00:00Z`).getUTCDay()
                  ].slice(0, 3)}{" "}
                  {Number(ligne.date.slice(8, 10))}/{Number(ligne.date.slice(5, 7))}
                </span>
                <span className="flex-1 text-[13.5px] leading-snug text-doux">
                  {ligne.titre}
                  {ligne.bonusReprise && (
                    <span className="text-tres-doux"> · reprise ×2</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
