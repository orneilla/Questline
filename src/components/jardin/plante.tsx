import {
  especePour,
  tracer,
  type Espece,
  type Role,
  type Stade,
  ESPECES,
  STADES,
} from "./botanique";

/**
 * Une plante du jardin, dessinée au trait.
 *
 * Le rendu est purement géométrique : ni image, ni police, ni bibliothèque.
 * La planche reste nette à toutes les tailles et pèse ce que pèse un SVG.
 *
 * Une plante délaissée pâlit et se désature — elle ne fane jamais, ne brunit
 * jamais, ne meurt jamais. Rien ici ne doit ressembler à un reproche.
 */

export { ESPECES, STADES, especePour };
export type { Espece, Stade };

export const LIBELLES_STADES: Record<Stade, string> = {
  graine: "Graine",
  pousse: "Pousse",
  "jeune-plant": "Jeune plant",
  plante: "Plante",
  floraison: "Floraison",
  maturite: "Maturité",
};

/** Seuils de maîtrise, en pourcentage de cartes mûres. */
const SEUILS: { stade: Stade; minimum: number }[] = [
  { stade: "maturite", minimum: 85 },
  { stade: "floraison", minimum: 60 },
  { stade: "plante", minimum: 40 },
  { stade: "jeune-plant", minimum: 20 },
  { stade: "pousse", minimum: 5 },
  { stade: "graine", minimum: 0 },
];

export function stadePour(maitrise: number): Stade {
  return SEUILS.find((s) => maitrise >= s.minimum)?.stade ?? "graine";
}

export function prochainSeuil(stade: Stade): number | null {
  const index = STADES.indexOf(stade);
  if (index >= STADES.length - 1) return null;
  const suivant = STADES[index + 1];
  return SEUILS.find((s) => s.stade === suivant)?.minimum ?? null;
}

/**
 * Palette d'herbier : encre végétale sourde, ocres, un accent floral. Aucune
 * couleur saturée, rien qui jure avec le fond.
 */
const TEINTES: Record<Role, string> = {
  sol: "#4a4235",
  graine: "#a4885f",
  tige: "#7d8f6a",
  feuille: "#94a683",
  nervure: "#94a683",
  fleur: "#c2a567",
  coeur: "#dcc188",
};

/** Épaisseur de référence, dans le repère du dessin (48 × 56). */
const TRAIT = 1.05;

export type Props = {
  stade: Stade;
  /** Espèce de la plante ; par défaut, une plante à fleur. */
  espece?: Espece;
  /** Hauteur du rendu, en pixels CSS. */
  taille?: number;
  /** Paquet délaissé : couleurs adoucies, jamais mortes. */
  endormie?: boolean;
  /** Teinte de l'espace, portée par les fleurs pour la reconnaissance. */
  teinte?: string;
  titre?: string;
  /** Fait pousser le dessin trait par trait. Réservé aux fins de session. */
  anime?: boolean;
};

export function Plante({
  stade,
  espece = "fleurie",
  taille = 72,
  endormie = false,
  teinte,
  titre,
  anime = false,
}: Props) {
  const traits = tracer(espece, stade);

  const couleur = (role: Role): string => {
    if (!teinte) return TEINTES[role];
    if (role === "fleur") return teinte;
    if (role === "coeur") return teinte;
    return TEINTES[role];
  };

  return (
    <svg
      viewBox="0 0 48 56"
      width={Math.round((taille * 48) / 56)}
      height={taille}
      role="img"
      aria-label={titre ?? LIBELLES_STADES[stade]}
      className={anime ? "plante-pousse" : undefined}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        // Une plante délaissée perd en éclat, pas en vie.
        opacity: endormie ? 0.5 : 1,
        filter: endormie ? "saturate(0.3)" : undefined,
        transition: "opacity 700ms cubic-bezier(0.22,0.61,0.36,1), filter 700ms cubic-bezier(0.22,0.61,0.36,1)",
        overflow: "visible",
      }}
    >
      {traits.map((trait, index) => (
        <path
          key={index}
          d={trait.d}
          // La plante se dessine du sol vers la pointe, dans l'ordre des traits.
          style={anime ? { animationDelay: `${index * 16}ms` } : undefined}
          stroke={couleur(trait.role)}
          strokeWidth={TRAIT * (trait.epaisseur ?? 1)}
          strokeOpacity={trait.opacite ?? 1}
          // Le cœur des fleurs est le seul aplat de la planche : un point.
          fill={trait.role === "coeur" ? couleur("coeur") : "none"}
          fillOpacity={trait.role === "coeur" ? 0.35 : undefined}
        />
      ))}
    </svg>
  );
}
