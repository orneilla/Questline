"use client";

import { useState, useTransition } from "react";

import { actionValiderRare } from "@/app/(app)/jour/actions";
import { COULEURS_PILIERS, LIBELLES_PILIERS } from "@/lib/constantes";
import type { QueteRare as Donnees } from "@/lib/recit";

/**
 * La quête rare, distincte du reste : encadrée d'un trait complet plutôt que
 * d'une simple barre latérale, et titrée en serif. Elle n'est jamais
 * obligatoire — le libellé le dit — et disparaît à minuit sans rien laisser.
 */
export function QueteRare({ quete, faite }: { quete: Donnees; faite: boolean }) {
  const [valide, setValide] = useState(faite);
  const [enCours, setEnCours] = useState(false);
  const [, demarrer] = useTransition();

  const couleur = COULEURS_PILIERS[quete.pilier];

  function valider() {
    if (valide || enCours) return;
    setEnCours(true);
    setTimeout(() => {
      setValide(true);
      setEnCours(false);
    }, 560);
    demarrer(async () => {
      await actionValiderRare();
    });
  }

  return (
    <section aria-label="Quête rare" className="flex flex-col gap-2">
      <p className="flex items-center gap-2 px-1 text-[11.5px] tracking-[0.18em] text-tres-doux uppercase">
        <span aria-hidden style={{ color: couleur }}>
          ◇
        </span>
        De passage
      </p>

      <button
        type="button"
        onClick={valider}
        disabled={valide}
        aria-label={`Valider la quête rare : ${quete.texte}`}
        className="apparait relative flex min-h-[84px] w-full items-center gap-4 overflow-hidden rounded-2xl px-5 py-4 text-left transition-all duration-500 ease-calme active:scale-[0.99] disabled:active:scale-100"
        style={{
          border: `1px solid ${couleur}${valide ? "40" : "66"}`,
          backgroundColor: `${couleur}0f`,
          opacity: valide ? 0.55 : 1,
        }}
      >
        {enCours && (
          <span
            aria-hidden
            className="souffle pointer-events-none absolute inset-0 rounded-2xl"
            style={{ backgroundColor: couleur }}
          />
        )}

        <span className="relative flex-1">
          <span
            className="police-titre block text-[18px] leading-snug"
            style={{ textDecoration: valide ? "line-through" : undefined }}
          >
            {quete.texte}
          </span>
          <span className="mt-1.5 block text-[12px] text-tres-doux">
            {LIBELLES_PILIERS[quete.pilier]} ·{" "}
            {quete.dureeMin > 0 ? `${quete.dureeMin} min` : "au fil du jour"} · compte
            double
          </span>
        </span>

        <span
          aria-hidden
          className="relative grid size-7 shrink-0 place-items-center transition-all duration-500 ease-calme"
          style={{ transform: valide || enCours ? "scale(1.1)" : "scale(1)" }}
        >
          <span
            className="text-[15px] transition-opacity duration-500"
            style={{ color: couleur, opacity: valide || enCours ? 1 : 0.45 }}
          >
            {valide || enCours ? "◆" : "◇"}
          </span>
        </span>
      </button>

      <p className="px-1 text-[11.5px] leading-relaxed text-tres-doux">
        {valide
          ? "Fait. Elle ne reviendra pas de sitôt."
          : "Facultative. Elle disparaît à minuit, sans rien retirer."}
      </p>
    </section>
  );
}
