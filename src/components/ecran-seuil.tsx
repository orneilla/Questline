"use client";

import { useTransition } from "react";

import { actionSeuilVu } from "@/app/(app)/jour/actions";
import { COULEURS_PILIERS, LIBELLES_PILIERS } from "@/lib/constantes";
import { formaterDateLongue } from "@/lib/dates";
import type { SeuilAAnnoncer } from "@/lib/seuils";

/**
 * Écran plein d'un seuil franchi.
 *
 * Aucune fanfare : le nom de l'arc, le seuil, la vision rappelée, et une
 * phrase sur ce qui a été parcouru. On ne félicite pas, on marque le point.
 */

/** Ce que dit chaque seuil du chemin — constat, jamais compliment. */
const PHRASES: Record<number, string> = {
  10: "Le commencement est derrière. C'est le passage le plus difficile à obtenir, et le seul qu'on ne peut pas refaire.",
  25: "Un quart. L'arc a cessé d'être une intention : il a une histoire, des dates, des gestes répétés.",
  50: "La moitié. Ce qui reste ressemble à ce qui a déjà été fait — tu sais désormais ce que ça demande.",
  75: "Trois quarts. La question n'est plus de savoir si c'est tenable, mais jusqu'où ça va.",
  100: "L'arc a atteint ce qu'il visait. Il peut se clore, se rouvrir plus haut, ou céder la place. C'est à toi.",
};

export function EcranSeuil({ seuil }: { seuil: SeuilAAnnoncer }) {
  const [enAttente, demarrer] = useTransition();
  const couleur = COULEURS_PILIERS[seuil.pilier];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-7 px-7 py-16">
      <div className="apparait flex flex-col gap-7">
        <div className="flex flex-col gap-4">
          <span
            aria-hidden
            className="block h-10 w-px"
            style={{ background: `linear-gradient(to bottom, transparent, ${couleur})` }}
          />
          <p
            className="text-[12px] tracking-[0.22em] uppercase"
            style={{ color: couleur }}
          >
            {LIBELLES_PILIERS[seuil.pilier]}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="police-titre text-[64px] leading-none tabular-nums">
            {seuil.seuil}
            <span className="text-[28px] text-doux"> %</span>
          </p>
          <h1 className="police-titre text-[28px] leading-tight">{seuil.arcNom}</h1>
        </div>

        <div
          aria-hidden
          className="h-px w-full"
          style={{ backgroundColor: `${couleur}40` }}
        />

        <p className="text-[15px] leading-relaxed text-doux italic">
          {seuil.arcVision}
        </p>

        <p className="text-[15px] leading-relaxed text-texte">{PHRASES[seuil.seuil]}</p>

        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          {seuil.nombreValidations} validation{seuil.nombreValidations > 1 ? "s" : ""}{" "}
          depuis le début · franchi le {formaterDateLongue(seuil.atteintLe)}
        </p>

        <button
          type="button"
          disabled={enAttente}
          onClick={() => demarrer(async () => { await actionSeuilVu(seuil.id); })}
          className="mt-2 min-h-14 w-full rounded-2xl border border-bordure-vive bg-surface-haut text-[16px] text-texte transition-colors duration-300 active:bg-bordure disabled:opacity-50"
        >
          {enAttente ? "…" : "Continuer"}
        </button>
      </div>
    </main>
  );
}
