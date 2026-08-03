"use client";

import { useState, useTransition } from "react";

import { actionModeBas } from "@/app/(app)/jour/actions";

type Props = { actif: boolean };

/**
 * Le jour bas n'est pas un abandon : il réduit la journée à un seul geste
 * minimal. Le libellé et le ton doivent le dire.
 */
export function BasculeJourBas({ actif }: Props) {
  const [local, setLocal] = useState(actif);
  const [enAttente, demarrer] = useTransition();

  function basculer() {
    const suivant = !local;
    setLocal(suivant);
    demarrer(async () => {
      await actionModeBas(suivant);
    });
  }

  return (
    <button
      type="button"
      onClick={basculer}
      aria-pressed={local}
      disabled={enAttente}
      className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-bordure/70 px-5 text-left transition-colors duration-500 ease-calme active:bg-surface disabled:opacity-60"
      style={{
        backgroundColor: local ? "var(--color-surface)" : "transparent",
        borderColor: local ? "var(--color-bordure-vive)" : undefined,
      }}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] text-texte">
          {local ? "Jour bas" : "Passer en jour bas"}
        </span>
        <span className="text-[12.5px] text-tres-doux">
          {local ? "Une seule quête minimale" : "Quand la journée ne s'y prête pas"}
        </span>
      </span>

      <span
        aria-hidden
        className="relative h-[26px] w-[46px] shrink-0 rounded-full border transition-colors duration-500 ease-calme"
        style={{
          borderColor: local ? "var(--color-bordure-vive)" : "var(--color-bordure)",
          backgroundColor: local ? "var(--color-surface-haut)" : "transparent",
        }}
      >
        <span
          className="absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full transition-all duration-500 ease-calme"
          style={{
            left: local ? "22px" : "3px",
            backgroundColor: local ? "var(--color-doux)" : "var(--color-tres-doux)",
          }}
        />
      </span>
    </button>
  );
}
