import type { RepartitionPaquet } from "@/lib/cartes/donnees";

/** Teintes des quatre états, dans l'ordre de maturité. */
export const COULEURS_ETATS = {
  nouvelles: "#7e92b8",
  apprentissage: "#b58a93",
  jeunes: "#c2a567",
  mures: "#8fa37e",
} as const;

/**
 * Répartition d'un paquet en barre segmentée. Honnête par construction : les
 * quatre segments couvrent exactement le total, rien n'est arrondi à l'avantage.
 */
export function BarrePaquet({
  repartition,
  hauteur = 4,
}: {
  repartition: RepartitionPaquet;
  hauteur?: number;
}) {
  const { nouvelles, apprentissage, jeunes, mures, total } = repartition;
  if (total === 0) {
    return (
      <span
        className="block w-full rounded-full bg-bordure"
        style={{ height: hauteur }}
      />
    );
  }

  const segments = [
    { cle: "mures", valeur: mures },
    { cle: "jeunes", valeur: jeunes },
    { cle: "apprentissage", valeur: apprentissage },
    { cle: "nouvelles", valeur: nouvelles },
  ] as const;

  return (
    <span
      className="flex w-full overflow-hidden rounded-full bg-bordure"
      style={{ height: hauteur }}
      role="img"
      aria-label={`${mures} mûres, ${jeunes} jeunes, ${apprentissage} en apprentissage, ${nouvelles} nouvelles`}
    >
      {segments
        .filter((s) => s.valeur > 0)
        .map((s) => (
          <span
            key={s.cle}
            style={{
              width: `${(100 * s.valeur) / total}%`,
              backgroundColor: COULEURS_ETATS[s.cle],
            }}
          />
        ))}
    </span>
  );
}
