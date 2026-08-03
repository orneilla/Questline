/**
 * Plantes en pixel art.
 *
 * Chaque stade est une grille de 12 × 12 décrite caractère par caractère, puis
 * rendue en carrés SVG. Pas de bibliothèque, pas d'image : le dessin reste net
 * à toutes les tailles et pèse quelques centaines d'octets.
 *
 * Palette accordée au thème sombre. Une plante délaissée est désaturée, jamais
 * fanée ni morte — l'app ne fait pas de reproche, même en dessin.
 */

export const STADES = [
  "graine",
  "pousse",
  "jeune-plant",
  "plante",
  "floraison",
  "maturite",
] as const;

export type Stade = (typeof STADES)[number];

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

const COULEURS: Record<string, string> = {
  t: "#3a3128", // terre
  s: "#6f8f5e", // tige
  f: "#8fa37e", // feuille
  F: "#a8bd94", // feuille claire
  l: "#c2a567", // pétale
  c: "#e0cf9a", // cœur
  g: "#a89070", // graine
};

/** '.' laisse le pixel vide. */
const DESSINS: Record<Stade, string[]> = {
  graine: [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    ".....gg.....",
    "....tggt....",
    "tttttttttttt",
  ],
  pousse: [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    ".....f......",
    "....fs......",
    ".....s......",
    "....tst.....",
    "tttttttttttt",
  ],
  "jeune-plant": [
    "............",
    "............",
    "............",
    "............",
    "......f.....",
    ".....fs.....",
    "......s.....",
    "....fs......",
    ".....s......",
    ".....s......",
    "....tst.....",
    "tttttttttttt",
  ],
  plante: [
    "............",
    "............",
    "......F.....",
    ".....Fs.....",
    "......s.....",
    "...ffs......",
    "......sff...",
    "....fs......",
    ".....s......",
    ".....s......",
    "....tst.....",
    "tttttttttttt",
  ],
  floraison: [
    "............",
    ".....l......",
    "....lcl.F...",
    ".....lFs....",
    "......s.....",
    "...ffs...l..",
    "......sfflcl",
    "....fs...l..",
    ".....s......",
    ".....s......",
    "....tst.....",
    "tttttttttttt",
  ],
  maturite: [
    "..l....l....",
    ".lcl..lcl...",
    "..l.F..l....",
    "...Fs.F.....",
    "....sF......",
    "..ffs..l....",
    "....sfflcl..",
    "..fs....l...",
    "....s.......",
    "....s.......",
    "...tst......",
    "tttttttttttt",
  ],
};

export type Props = {
  stade: Stade;
  /** Taille du rendu, en pixels CSS. */
  taille?: number;
  /** Paquet délaissé : couleurs adoucies, jamais mortes. */
  endormie?: boolean;
  /** Teinte de l'espace, appliquée aux fleurs pour la reconnaissance. */
  teinte?: string;
  titre?: string;
};

export function Plante({
  stade,
  taille = 72,
  endormie = false,
  teinte,
  titre,
}: Props) {
  const grille = DESSINS[stade];
  const cotes = 12;

  const carres: React.ReactElement[] = [];
  grille.forEach((ligne, y) => {
    [...ligne].forEach((symbole, x) => {
      if (symbole === ".") return;
      const couleur =
        teinte && (symbole === "l" || symbole === "c")
          ? symbole === "c"
            ? teinte
            : `${teinte}cc`
          : COULEURS[symbole];
      if (!couleur) return;
      carres.push(
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={couleur} />,
      );
    });
  });

  return (
    <svg
      viewBox={`0 0 ${cotes} ${cotes}`}
      width={taille}
      height={taille}
      role="img"
      aria-label={titre ?? LIBELLES_STADES[stade]}
      shapeRendering="crispEdges"
      style={{
        // Une plante délaissée perd en saturation, pas en vie.
        filter: endormie ? "saturate(0.35) brightness(0.85)" : undefined,
        transition: "filter 700ms cubic-bezier(0.22,0.61,0.36,1)",
      }}
    >
      {carres}
    </svg>
  );
}
