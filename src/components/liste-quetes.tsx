"use client";

import { useState, useTransition } from "react";

import { actionValider } from "@/app/(app)/jour/actions";
import type { Pilier } from "@/db/schema";
import { COULEURS_PILIERS, LIBELLES_PILIERS } from "@/lib/constantes";
import type { QueteProposable } from "@/lib/selection";

type Faite = { id: number; titre: string; pilier: Pilier };

type Props = {
  quetes: QueteProposable[];
  faites: Faite[];
};

export function ListeQuetes({ quetes, faites }: Props) {
  const [enCours, setEnCours] = useState<number | null>(null);
  const [validees, setValidees] = useState<number[]>([]);
  const [, demarrer] = useTransition();

  const restantes = quetes.filter((q) => !validees.includes(q.id));

  const accomplies: Faite[] = [
    ...faites,
    ...quetes
      .filter((q) => validees.includes(q.id) && !faites.some((f) => f.id === q.id))
      .map((q) => ({ id: q.id, titre: q.titre, pilier: q.pilier })),
  ];

  function valider(quete: QueteProposable) {
    if (enCours !== null) return;
    setEnCours(quete.id);
    // On laisse l'animation se dérouler avant de retirer la carte.
    setTimeout(() => {
      setValidees((v) => [...v, quete.id]);
      setEnCours(null);
    }, 560);
    demarrer(async () => {
      await actionValider(quete.id);
    });
  }

  return (
    <section aria-label="Quêtes du jour" className="flex flex-col gap-3">
      {restantes.map((quete, index) => {
        const couleur = COULEURS_PILIERS[quete.pilier];
        const actif = enCours === quete.id;

        return (
          <button
            key={quete.id}
            type="button"
            onClick={() => valider(quete)}
            aria-label={`Valider : ${quete.titre}`}
            style={{ animationDelay: `${index * 70}ms` }}
            className="apparait relative flex min-h-[72px] w-full items-center gap-4 overflow-hidden rounded-2xl border border-bordure bg-surface px-5 py-4 text-left transition-all duration-500 ease-calme active:scale-[0.99] active:bg-surface-haut"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-[2px] opacity-70"
              style={{ backgroundColor: couleur }}
            />
            {actif && (
              <span
                aria-hidden
                className="souffle pointer-events-none absolute inset-0 rounded-2xl"
                style={{ backgroundColor: couleur }}
              />
            )}

            <span className="relative flex-1">
              <span className="block text-[17px] leading-snug text-texte">
                {quete.titre}
              </span>
              <span className="mt-1.5 block text-[12.5px] text-tres-doux">
                {/* Une durée nulle signale une quête d'ambiance, sans créneau. */}
                {quete.arcNom} ·{" "}
                {quete.dureeMin > 0 ? `${quete.dureeMin} min` : "au fil du jour"}
                {quete.minimale ? " · minimale" : ""}
              </span>
            </span>

            <span
              aria-hidden
              className="relative grid size-7 shrink-0 place-items-center rounded-full border transition-all duration-500 ease-calme"
              style={{
                borderColor: actif ? couleur : "var(--color-bordure-vive)",
                backgroundColor: actif ? couleur : "transparent",
                transform: actif ? "scale(1.08)" : "scale(1)",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4 transition-opacity duration-300"
                style={{ opacity: actif ? 1 : 0 }}
                fill="none"
                stroke="var(--color-fond)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </button>
        );
      })}

      {restantes.length === 0 && (
        <p className="apparait rounded-2xl border border-bordure/60 px-5 py-6 text-center text-[15px] leading-relaxed text-doux">
          {accomplies.length > 0
            ? "La journée est faite. Le reste peut attendre demain."
            : "Rien à faire aujourd'hui. C'est un jour valable aussi."}
        </p>
      )}

      {accomplies.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2.5">
          {accomplies.map((faite) => (
            <li key={faite.id} className="flex items-center gap-3 px-1">
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: COULEURS_PILIERS[faite.pilier] }}
              />
              <span className="text-[14px] text-tres-doux line-through decoration-tres-doux/50">
                {faite.titre}
              </span>
              <span className="sr-only">
                {LIBELLES_PILIERS[faite.pilier]} — validée
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
