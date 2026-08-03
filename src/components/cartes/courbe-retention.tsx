import { COULEURS_ETATS } from "./barre-paquet";

/**
 * Courbe de rétention sur trente jours.
 *
 * Elle dit une seule chose : la part de cartes retrouvées du premier coup,
 * jour après jour. Les jours sans révision ne sont pas tracés à zéro — ils
 * n'ont rien à dire, et un creux inventé ressemblerait à un reproche.
 */

export type Jour = { date: string; taux: number; total: number };

const LARGEUR = 300;
const HAUTEUR = 96;
const MARGE = 6;

function positionX(index: number, nombre: number): number {
  if (nombre <= 1) return LARGEUR / 2;
  return MARGE + (index * (LARGEUR - 2 * MARGE)) / (nombre - 1);
}

function positionY(taux: number): number {
  // L'échelle démarre à 50 % : entre 0 et 50, une courbe de révision n'existe pas.
  const borne = Math.max(50, Math.min(100, taux));
  return HAUTEUR - MARGE - ((borne - 50) / 50) * (HAUTEUR - 2 * MARGE);
}

export function CourbeRetention({
  jours,
  cible,
}: {
  jours: Jour[];
  /** Rétention visée, en pourcentage. */
  cible: number;
}) {
  const avecDonnees = jours
    .map((jour, index) => ({ ...jour, index }))
    .filter((jour) => jour.total > 0);

  const revues = avecDonnees.reduce((total, jour) => total + jour.total, 0);

  if (avecDonnees.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-bordure px-4 py-7 text-center text-[13px] text-tres-doux">
        Pas encore de révisions sur les trente derniers jours.
      </p>
    );
  }

  const moyenne = Math.round(
    avecDonnees.reduce((total, jour) => total + jour.taux * jour.total, 0) /
      Math.max(1, revues),
  );

  const trace = avecDonnees
    .map(
      (jour, rang) =>
        `${rang === 0 ? "M" : "L"}${positionX(jour.index, jours.length).toFixed(1)} ${positionY(jour.taux).toFixed(1)}`,
    )
    .join("");

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        className="w-full"
        role="img"
        aria-label={`Rétention moyenne de ${moyenne} % sur ${revues} révisions en trente jours`}
      >
        <line
          x1={MARGE}
          x2={LARGEUR - MARGE}
          y1={positionY(cible)}
          y2={positionY(cible)}
          stroke="var(--color-bordure-vive)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />

        <path
          d={trace}
          fill="none"
          stroke={COULEURS_ETATS.mures}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {avecDonnees.map((jour) => (
          <circle
            key={jour.date}
            cx={positionX(jour.index, jours.length)}
            cy={positionY(jour.taux)}
            r={1.8}
            fill={COULEURS_ETATS.mures}
            opacity={0.85}
          />
        ))}
      </svg>

      <figcaption className="flex items-baseline justify-between text-[11.5px] text-tres-doux">
        <span>
          {moyenne} % retrouvées du premier coup · {revues} révisions
        </span>
        <span>visé {cible} %</span>
      </figcaption>
    </figure>
  );
}
