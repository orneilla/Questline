import type { Metadata } from "next";
import Link from "next/link";

import { EcranInstallation } from "@/components/ecran-installation";
import { Retour } from "@/components/retour";
import { chargerArcs, type ResumeArc } from "@/lib/arcs";
import { COULEURS_PILIERS, LIBELLES_PILIERS } from "@/lib/constantes";
import { formaterDateLongue } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";

/**
 * Les arcs accomplis.
 *
 * Ce qui est terminé quitte la liste courante sans quitter l'histoire. La page
 * ne classe pas, ne note pas et ne compare pas : elle range par date, du plus
 * récent au plus ancien, et dit ce que chacun a demandé.
 */

export const metadata: Metadata = { title: "Questline — Arcs accomplis" };
export const dynamic = "force-dynamic";

export default async function PageArcsAccomplis() {
  let liste: ResumeArc[];
  try {
    liste = await chargerArcs();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const accomplis = liste
    .filter((a) => a.accompliLe !== null)
    .sort((a, b) => (b.accompliLe ?? "").localeCompare(a.accompliLe ?? ""));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/arcs" libelle="Arcs" />
        <h1 className="police-titre text-[34px] leading-none">Arcs accomplis</h1>
      </header>

      {accomplis.length === 0 ? (
        <p className="text-[13.5px] leading-relaxed text-doux">
          Rien ici pour l'instant. Un arc rejoint cette page le jour où tu le
          déclares accompli, depuis sa propre page.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {accomplis.map((arc) => (
            <li key={arc.id}>
              <Link
                href={`/arcs/${arc.id}`}
                className="relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-bordure bg-surface px-5 py-4 transition-colors duration-300 active:bg-surface-haut"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[2px]"
                  style={{ backgroundColor: COULEURS_PILIERS[arc.pilier] }}
                />
                <h2 className="text-[17px] leading-snug text-texte">{arc.nom}</h2>
                <p className="text-[12.5px] leading-relaxed text-doux">{arc.vision}</p>
                <p className="text-[12px] text-tres-doux">
                  {LIBELLES_PILIERS[arc.pilier]} · accompli le{" "}
                  {formaterDateLongue(arc.accompliLe ?? "")} ·{" "}
                  {arc.nombreValidations} validation
                  {arc.nombreValidations > 1 ? "s" : ""}
                  {arc.etapesTotal > 0
                    ? ` · ${arc.etapesFaites} étape${arc.etapesFaites > 1 ? "s" : ""} sur ${arc.etapesTotal}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
