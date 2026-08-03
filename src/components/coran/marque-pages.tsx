"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { supprimerMarquePage } from "@/app/(app)/coran/actions";

/** Les marque-pages posés, du plus récent au plus ancien. */
export type Signet = {
  id: number;
  versetNumero: number;
  nom: string;
  sourate: number;
  numeroDansSourate: number;
  nomSourate: string;
};

export function MarquePages({ signets }: { signets: Signet[] }) {
  const [enAttente, demarrer] = useTransition();
  const [retires, setRetires] = useState<Set<number>>(new Set());

  const visibles = signets.filter((s) => !retires.has(s.id));
  if (visibles.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Marque-pages</h2>
      <ul className="flex flex-col gap-2">
        {visibles.map((signet) => (
          <li
            key={signet.id}
            className="flex items-stretch overflow-hidden rounded-xl border border-bordure bg-surface"
          >
            <Link
              href={`/coran/lire?verset=${signet.versetNumero}`}
              className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3 transition-colors duration-200 active:bg-surface-haut"
            >
              <span className="truncate text-[14.5px] text-texte">
                {signet.nom || `${signet.nomSourate} ${signet.sourate}:${signet.numeroDansSourate}`}
              </span>
              <span className="text-[11.5px] text-tres-doux tabular-nums">
                {signet.nomSourate} · {signet.sourate}:{signet.numeroDansSourate}
              </span>
            </Link>
            <button
              type="button"
              disabled={enAttente}
              aria-label="Retirer ce marque-page"
              onClick={() =>
                demarrer(async () => {
                  setRetires((r) => new Set(r).add(signet.id));
                  await supprimerMarquePage(signet.id);
                })
              }
              className="flex w-12 shrink-0 items-center justify-center border-l border-bordure text-tres-doux transition-colors duration-200 active:text-texte"
            >
              <svg viewBox="0 0 24 24" className="size-[15px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
                <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
