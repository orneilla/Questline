"use client";

import { useState } from "react";

import type { RepartitionPaquet } from "@/lib/cartes/donnees";

/** Teintes des quatre états, dans l'ordre de maturité. */
export const COULEURS_ETATS = {
  nouvelles: "#7e92b8",
  apprentissage: "#b58a93",
  jeunes: "#c2a567",
  mures: "#8fa37e",
} as const;

export type CleEtat = keyof typeof COULEURS_ETATS;

export const LIBELLES_ETATS: Record<CleEtat, string> = {
  nouvelles: "nouvelles",
  apprentissage: "apprentissage",
  jeunes: "jeunes",
  mures: "mûres",
};

/** Ordre d'affichage : du plus mûr au plus neuf, comme dans la barre. */
export const ORDRE_ETATS: CleEtat[] = ["mures", "jeunes", "apprentissage", "nouvelles"];

/**
 * Légende des quatre couleurs. Une barre sans légende n'est qu'un ruban :
 * elle se lit une fois qu'on sait ce que chaque teinte désigne.
 */
export function LegendeEtats({ compact = false }: { compact?: boolean }) {
  return (
    <ul
      className={`flex flex-wrap items-center gap-x-3.5 gap-y-1.5 ${
        compact ? "text-[10.5px]" : "text-[11.5px]"
      } text-tres-doux`}
    >
      {ORDRE_ETATS.map((cle) => (
        <li key={cle} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: COULEURS_ETATS[cle] }}
          />
          {LIBELLES_ETATS[cle]}
        </li>
      ))}
    </ul>
  );
}

function compte(repartition: RepartitionPaquet, cle: CleEtat): number {
  return repartition[cle];
}

/**
 * Répartition d'un paquet en barre segmentée. Honnête par construction : les
 * quatre segments couvrent exactement le total, rien n'est arrondi à
 * l'avantage. Un appui sur la barre en donne les nombres exacts — la couleur
 * seule ne dit pas combien.
 */
export function BarrePaquet({
  repartition,
  hauteur = 5,
  depliable = true,
}: {
  repartition: RepartitionPaquet;
  hauteur?: number;
  /** Faux dans une liste où l'appui doit rester à l'élément qui l'entoure. */
  depliable?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const { total } = repartition;

  const ruban = (
    <span
      className="flex w-full overflow-hidden rounded-full bg-bordure"
      style={{ height: hauteur }}
      aria-hidden
    >
      {total > 0 &&
        ORDRE_ETATS.filter((cle) => compte(repartition, cle) > 0).map((cle) => (
          <span
            key={cle}
            style={{
              width: `${(100 * compte(repartition, cle)) / total}%`,
              backgroundColor: COULEURS_ETATS[cle],
            }}
          />
        ))}
    </span>
  );

  const resume = ORDRE_ETATS.map(
    (cle) => `${compte(repartition, cle)} ${LIBELLES_ETATS[cle]}`,
  ).join(", ");

  if (!depliable) {
    return (
      <span role="img" aria-label={resume} className="block w-full">
        {ruban}
      </span>
    );
  }

  return (
    <span className="block w-full">
      <button
        type="button"
        aria-expanded={ouvert}
        aria-label={`${resume}. Appuyer pour le détail.`}
        onClick={(evenement) => {
          // La barre vit souvent dans un lien : l'appui montre le détail
          // au lieu d'ouvrir la révision.
          evenement.preventDefault();
          evenement.stopPropagation();
          setOuvert((o) => !o);
        }}
        // Une zone de touche haute autour d'un ruban fin.
        className="-my-2.5 block w-full cursor-default py-2.5"
      >
        {ruban}
      </button>

      {ouvert && (
        <span className="mt-2.5 flex flex-col gap-1">
          {ORDRE_ETATS.map((cle) => (
            <span key={cle} className="flex items-center gap-2 text-[12px] text-doux">
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: COULEURS_ETATS[cle] }}
              />
              <span className="flex-1">{LIBELLES_ETATS[cle]}</span>
              <span className="tabular-nums text-tres-doux">
                {compte(repartition, cle)}
              </span>
            </span>
          ))}
          <span className="mt-0.5 flex items-center gap-2 border-t border-bordure pt-1.5 text-[12px] text-tres-doux">
            <span className="flex-1">total</span>
            <span className="tabular-nums">{total}</span>
          </span>
        </span>
      )}
    </span>
  );
}
