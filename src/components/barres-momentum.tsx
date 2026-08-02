"use client";

import { useEffect, useState } from "react";

import type { Pilier } from "@/db/schema";
import { COULEURS_PILIERS, LIBELLES_PILIERS } from "@/lib/constantes";
import { etatMomentum, intensite } from "@/lib/momentum";

type Props = {
  momentums: { pilier: Pilier; valeur: number }[];
};

/**
 * Cinq barres, une par pilier. Elles montent depuis zéro à l'ouverture de
 * l'écran, en décalé, pour donner la sensation d'un élan qui se reconstitue.
 */
export function BarresMomentum({ momentums }: Props) {
  const [monte, setMonte] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMonte(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <section aria-label="Momentum des piliers" className="flex flex-col gap-4">
      {momentums.map(({ pilier, valeur }, index) => {
        const part = intensite(valeur);
        const couleur = COULEURS_PILIERS[pilier];

        return (
          <div key={pilier} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] tracking-[0.14em] text-doux uppercase">
                {LIBELLES_PILIERS[pilier]}
              </span>
              <span className="text-[12px] text-tres-doux">{etatMomentum(valeur)}</span>
            </div>

            <div
              className="h-[3px] w-full overflow-hidden rounded-full bg-bordure"
              role="meter"
              aria-valuenow={Math.round(valeur)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={LIBELLES_PILIERS[pilier]}
            >
              <div
                className="h-full rounded-full transition-[width] duration-[1100ms] ease-calme"
                style={{
                  width: monte ? `${Math.max(part * 100, valeur > 0 ? 2 : 0)}%` : "0%",
                  backgroundColor: couleur,
                  transitionDelay: `${index * 90}ms`,
                  boxShadow: part > 0 ? `0 0 12px -4px ${couleur}` : undefined,
                }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}
