"use client";

import { useState, useTransition } from "react";

import { actionCloreSaison } from "@/app/(app)/jour/actions";
import { COULEURS_PILIERS, LIBELLES_PILIERS, MOIS } from "@/lib/constantes";
import type { BilanSaison } from "@/lib/saisons";

/**
 * Clôture d'une saison.
 *
 * Ce qui a avancé, ce qui est resté silencieux, puis une question ouverte. Les
 * piliers silencieux sont nommés sans commentaire : ils ne sont pas un retard,
 * ils indiquent seulement où le temps n'est pas allé.
 */

function intervalle(debut: string, fin: string): string {
  const [, moisD, jourD] = debut.split("-").map(Number);
  const [, moisF, jourF] = fin.split("-").map(Number);
  return moisD === moisF
    ? `${jourD} – ${jourF} ${MOIS[moisF - 1]}`
    : `${jourD} ${MOIS[moisD - 1]} – ${jourF} ${MOIS[moisF - 1]}`;
}

export function EcranSaison({ saison }: { saison: BilanSaison }) {
  const [reponse, setReponse] = useState(saison.reponse);
  const [enAttente, demarrer] = useTransition();

  function clore(texte: string) {
    demarrer(async () => {
      await actionCloreSaison(saison.numero, texte);
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-7 px-7 py-16">
      <div className="apparait flex flex-col gap-7">
        <div className="flex flex-col gap-3">
          <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
            {intervalle(saison.debut, saison.fin)}
          </p>
          <h1 className="police-titre text-[34px] leading-none">
            Saison {saison.numero}
          </h1>
          <p className="text-[13.5px] leading-relaxed text-doux">
            Quatre semaines closes. {saison.totalValidations} validation
            {saison.totalValidations > 1 ? "s" : ""} sur {saison.joursActifs} jour
            {saison.joursActifs > 1 ? "s" : ""}.
          </p>
        </div>

        <div aria-hidden className="h-px w-full bg-bordure" />

        {saison.avance.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
              Ce qui a avancé
            </h2>
            {saison.avance.slice(0, 3).map((ligne) => (
              <div key={ligne.pilier} className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2.5 text-[15px] text-texte">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: COULEURS_PILIERS[ligne.pilier] }}
                  />
                  {LIBELLES_PILIERS[ligne.pilier]}
                </span>
                <span className="text-[13px] tabular-nums text-tres-doux">
                  {ligne.points} points
                </span>
              </div>
            ))}
          </section>
        )}

        {saison.stagnants.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
              Ce qui est resté silencieux
            </h2>
            <p className="text-[14.5px] leading-relaxed text-doux">
              {saison.stagnants.map((p) => LIBELLES_PILIERS[p]).join(", ")}.
            </p>
            <p className="text-[12.5px] leading-relaxed text-tres-doux">
              Ces piliers passeront devant dans la sélection tant qu'ils le resteront.
            </p>
          </section>
        )}

        <div aria-hidden className="h-px w-full bg-bordure" />

        <section className="flex flex-col gap-3">
          <p className="police-titre text-[19px] leading-relaxed text-texte">
            {saison.question}
          </p>
          <textarea
            value={reponse}
            onChange={(e) => setReponse(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder="Si tu veux."
            className="w-full resize-none rounded-2xl border border-bordure bg-surface px-5 py-4 text-[16px] leading-relaxed text-texte outline-none transition-colors duration-500 ease-calme placeholder:text-tres-doux focus:border-bordure-vive"
          />
        </section>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={enAttente}
            onClick={() => clore(reponse)}
            className="min-h-14 w-full rounded-2xl border border-bordure-vive bg-surface-haut text-[16px] text-texte transition-colors duration-300 active:bg-bordure disabled:opacity-50"
          >
            {enAttente ? "…" : "Clore la saison"}
          </button>
          <button
            type="button"
            disabled={enAttente}
            onClick={() => clore("")}
            className="min-h-12 w-full text-[13.5px] text-tres-doux transition-colors duration-300 active:text-doux disabled:opacity-50"
          >
            Passer sans répondre
          </button>
        </div>
      </div>
    </main>
  );
}
