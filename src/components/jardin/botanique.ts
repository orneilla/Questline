/**
 * Dessin des plantes du jardin.
 *
 * Style de planche d'herbier : tout est tracé au trait, rien n'est rempli.
 * Les silhouettes sont calculées plutôt que recopiées — une fronde de fougère
 * est une courbe et ses folioles, une graminée un faisceau de limbes — ce qui
 * donne des plantes cohérentes entre elles et lisibles à 34 comme à 96 pixels.
 *
 * Repère : 48 de large, 56 de haut, sol à y = 52. Le dessin monte vers le haut
 * de la boîte à mesure que la plante grandit, ce qui suffit à distinguer les
 * six stades d'un coup d'œil, avant même d'en lire le détail.
 */

export const ESPECES = ["fougere", "graminee", "fleurie", "grimpante"] as const;

export type Espece = (typeof ESPECES)[number];

export const LIBELLES_ESPECES: Record<Espece, string> = {
  fougere: "fougère",
  graminee: "graminée",
  fleurie: "plante à fleur",
  grimpante: "grimpante",
};

export const STADES = [
  "graine",
  "pousse",
  "jeune-plant",
  "plante",
  "floraison",
  "maturite",
] as const;

export type Stade = (typeof STADES)[number];

/** Ce qu'un trait représente : c'est ce qui décide de sa teinte. */
export type Role = "sol" | "graine" | "tige" | "feuille" | "nervure" | "fleur" | "coeur";

export type Trait = {
  d: string;
  role: Role;
  /** Multiplie l'épaisseur courante. */
  epaisseur?: number;
  opacite?: number;
};

/**
 * Espèce d'un espace. Déterministe : un même espace garde sa plante d'une
 * session à l'autre, et deux espaces voisins n'ont presque jamais la même.
 */
export function especePour(cle: number): Espece {
  const rang = Math.abs(Math.trunc(cle));
  return ESPECES[rang % ESPECES.length];
}

/* ───────────────────────────── Géométrie ───────────────────────────── */

type Pt = readonly [number, number];

const DEG = Math.PI / 180;
const SOL_Y = 52;
const AXE = 24;
const PIED: Pt = [AXE, SOL_Y];

function net(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

function ecrire(p: Pt): string {
  return `${net(p[0])} ${net(p[1])}`;
}

function plus(a: Pt, b: Pt): Pt {
  return [a[0] + b[0], a[1] + b[1]];
}

function fois(v: Pt, k: number): Pt {
  return [v[0] * k, v[1] * k];
}

function unitaire(v: Pt): Pt {
  const longueur = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / longueur, v[1] / longueur];
}

/** Vecteur unitaire pour un angle mesuré depuis la verticale, positif à droite. */
function direction(angle: number): Pt {
  return [Math.sin(angle * DEG), -Math.cos(angle * DEG)];
}

/** Quart de tour dans le repère écran (y vers le bas). */
function normale(v: Pt): Pt {
  return [-v[1], v[0]];
}

function courbe(depart: Pt, controle: Pt, arrivee: Pt): string {
  return `M${ecrire(depart)}Q${ecrire(controle)} ${ecrire(arrivee)}`;
}

function surCourbe(depart: Pt, controle: Pt, arrivee: Pt, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * depart[0] + 2 * u * t * controle[0] + t * t * arrivee[0],
    u * u * depart[1] + 2 * u * t * controle[1] + t * t * arrivee[1],
  ];
}

function tangente(depart: Pt, controle: Pt, arrivee: Pt, t: number): Pt {
  const u = 1 - t;
  return unitaire([
    2 * u * (controle[0] - depart[0]) + 2 * t * (arrivee[0] - controle[0]),
    2 * u * (controle[1] - depart[1]) + 2 * t * (arrivee[1] - controle[1]),
  ]);
}

/**
 * Un limbe : le contour fermé d'une feuille, d'une lame ou d'un pétale. Deux
 * arcs symétriques autour de l'axe, écartés à hauteur du point de contrôle.
 */
function limbe(base: Pt, pointe: Pt, controle: Pt, demiLargeur: number): string {
  const axe = normale(unitaire([pointe[0] - base[0], pointe[1] - base[1]]));
  const gauche = plus(controle, fois(axe, demiLargeur));
  const droite = plus(controle, fois(axe, -demiLargeur));
  return `M${ecrire(base)}Q${ecrire(gauche)} ${ecrire(pointe)}Q${ecrire(droite)} ${ecrire(base)}Z`;
}

function cercle(centre: Pt, rayon: number): string {
  const r = net(rayon);
  return `M${net(centre[0] - rayon)} ${net(centre[1])}a${r} ${r} 0 1 0 ${net(2 * rayon)} 0a${r} ${r} 0 1 0 ${net(-2 * rayon)} 0Z`;
}

/** Le sol : un simple arc, jamais un bac ni un pot. */
const SOL: Trait = {
  d: courbe([7, SOL_Y + 0.2], [24, SOL_Y - 1.4], [41, SOL_Y + 0.2]),
  role: "sol",
  epaisseur: 0.9,
  opacite: 0.7,
};

/* ─────────────────────────── Motifs végétaux ─────────────────────────── */

/** Une feuille entière : contour et nervure médiane. */
function feuille(
  base: Pt,
  longueur: number,
  angle: number,
  largeurRelative = 0.32,
  courbureRelative = 0.14,
): Trait[] {
  const dir = direction(angle);
  const pointe = plus(base, fois(dir, longueur));
  const signe = angle >= 0 ? 1 : -1;
  const controle = plus(
    plus(base, fois(dir, longueur * 0.5)),
    fois(normale(dir), signe * courbureRelative * longueur),
  );

  return [
    { d: limbe(base, pointe, controle, longueur * largeurRelative), role: "feuille", epaisseur: 0.85 },
    { d: courbe(base, controle, pointe), role: "nervure", epaisseur: 0.5, opacite: 0.55 },
  ];
}

/**
 * Une fronde de fougère : un rachis arqué et ses folioles, plus courtes vers
 * la pointe. Les sores — les amas de spores — ne se montrent qu'à maturité.
 */
function fronde(
  base: Pt,
  longueur: number,
  angle: number,
  folioles: number,
  sores = false,
): Trait[] {
  const dir = direction(angle);
  const pointe = plus(base, fois(dir, longueur));
  const signe = angle >= 0 ? 1 : -1;
  const controle = plus(
    plus(base, fois(dir, longueur * 0.5)),
    fois(normale(dir), signe * 0.26 * longueur),
  );

  const traits: Trait[] = [
    { d: courbe(base, controle, pointe), role: "tige", epaisseur: 0.8 },
  ];

  for (let i = 0; i < folioles; i += 1) {
    const t = 0.16 + (0.76 * i) / Math.max(1, folioles - 1);
    const point = surCourbe(base, controle, pointe, t);
    const tan = tangente(base, controle, pointe, t);
    const nor = normale(tan);
    // Les pinnules raccourcissent vers la pointe : c'est ce qui donne à la
    // fronde son profil de lance plutôt que de branche.
    const taille = longueur * 0.3 * (1 - 0.78 * t);

    for (const cote of [1, -1] as const) {
      const sortie = unitaire(plus(fois(nor, cote), fois(tan, 0.42)));
      const bout = plus(point, fois(sortie, taille));
      const milieu = plus(plus(point, fois(tan, taille * 0.1)), fois(sortie, taille * 0.5));
      traits.push({
        d: limbe(point, bout, milieu, taille * 0.3),
        role: "feuille",
        epaisseur: 0.65,
        opacite: 0.95,
      });

      if (sores && i % 3 === 1 && taille > 2.4) {
        traits.push({
          d: cercle(plus(point, fois(sortie, taille * 0.52)), 0.36),
          role: "fleur",
          epaisseur: 0.45,
          opacite: 0.7,
        });
      }
    }
  }

  return traits;
}

/** La crosse : une jeune fronde encore enroulée, signature de la fougère. */
function crosse(base: Pt, hauteur: number, angle: number, sens: 1 | -1): Trait[] {
  const dir = direction(angle);
  const sommet = plus(base, fois(dir, hauteur));
  const controle = plus(
    plus(base, fois(dir, hauteur * 0.55)),
    fois(normale(dir), -sens * hauteur * 0.16),
  );
  return [
    { d: courbe(base, controle, sommet), role: "tige", epaisseur: 0.9 },
    vrille(sommet, hauteur * 0.16, 1.15, sens, "tige"),
  ];
}

/** Une lame de graminée : longue, étroite, arquée par son propre poids. */
function lame(base: Pt, longueur: number, angle: number, largeur = 0.075): Trait {
  const dir = direction(angle);
  const signe = angle >= 0 ? 1 : -1;
  const pointe = plus(
    plus(base, fois(dir, longueur)),
    fois(normale(dir), signe * longueur * 0.3),
  );
  const controle = plus(
    plus(base, fois(dir, longueur * 0.58)),
    fois(normale(dir), signe * longueur * 0.08),
  );
  return {
    d: limbe(base, pointe, controle, longueur * largeur),
    role: "feuille",
    epaisseur: 0.8,
  };
}

/** Un chaume et son épi : les épillets s'inclinent tous du même côté. */
function epi(base: Pt, hauteur: number, angle: number, epillets: number): Trait[] {
  const dir = direction(angle);
  const signe = angle >= 0 ? 1 : -1;
  const sommet = plus(base, fois(dir, hauteur));
  const controle = plus(
    plus(base, fois(dir, hauteur * 0.6)),
    fois(normale(dir), signe * hauteur * 0.1),
  );

  const traits: Trait[] = [
    { d: courbe(base, controle, sommet), role: "tige", epaisseur: 0.75 },
  ];

  const depart = surCourbe(base, controle, sommet, 0.66);
  for (let i = 0; i < epillets; i += 1) {
    const t = i / Math.max(1, epillets - 1);
    const axeI = plus(depart, fois(unitaire([sommet[0] - depart[0], sommet[1] - depart[1]]), t * distance(depart, sommet)));
    const cote = i % 2 === 0 ? 1 : -1;
    const taille = 3 - 1.2 * t;
    const sortie = unitaire([cote * 0.72, 0.62]);
    const bout = plus(axeI, fois(sortie, taille));
    traits.push({
      d: limbe(axeI, bout, plus(axeI, fois(sortie, taille * 0.5)), taille * 0.25),
      role: "fleur",
      epaisseur: 0.65,
    });
  }

  return traits;
}

function distance(a: Pt, b: Pt): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Une fleur ouverte : pétales rayonnants et cœur. */
function fleur(centre: Pt, rayon: number, petales: number, rotation = 0): Trait[] {
  const traits: Trait[] = [];

  for (let i = 0; i < petales; i += 1) {
    const dir = direction(rotation + (360 * i) / petales);
    const bout = plus(centre, fois(dir, rayon));
    const milieu = plus(centre, fois(dir, rayon * 0.52));
    traits.push({
      d: limbe(centre, bout, milieu, rayon * 0.36),
      role: "fleur",
      epaisseur: 0.75,
    });
  }

  traits.push({ d: cercle(centre, rayon * 0.22), role: "coeur", epaisseur: 0.85 });
  return traits;
}

/** Un bouton encore fermé : la promesse d'une fleur, pas une fleur. */
function bouton(base: Pt, hauteur: number, angle: number): Trait {
  const dir = direction(angle);
  const pointe = plus(base, fois(dir, hauteur));
  const milieu = plus(base, fois(dir, hauteur * 0.45));
  return { d: limbe(base, pointe, milieu, hauteur * 0.42), role: "fleur", epaisseur: 0.75 };
}

/** Une vrille : la spirale par laquelle une grimpante s'accroche. */
function vrille(depart: Pt, rayon: number, tours: number, sens: 1 | -1, role: Role = "tige"): Trait {
  const centre: Pt = [depart[0] + sens * rayon, depart[1]];
  const pas = 26;
  const points: string[] = [];

  for (let i = 0; i <= pas; i += 1) {
    const avance = i / pas;
    const angle = avance * tours * 2 * Math.PI;
    const r = rayon * (1 - 0.62 * avance);
    points.push(
      ecrire([centre[0] - sens * r * Math.cos(angle), centre[1] + r * Math.sin(angle)]),
    );
  }

  return { d: `M${points.join("L")}`, role, epaisseur: 0.6, opacite: 0.85 };
}

/** Une liane qui s'enroule : arcs alternés, et les nœuds où naissent feuilles. */
function liane(hauteur: number, ondes: number, amplitude: number): { trait: Trait; noeuds: Pt[] } {
  const morceaux: string[] = [`M${ecrire(PIED)}`];
  const noeuds: Pt[] = [];
  const pasY = hauteur / ondes;

  for (let i = 0; i < ondes; i += 1) {
    const cote = i % 2 === 0 ? 1 : -1;
    const y = SOL_Y - pasY * (i + 1);
    const noeud: Pt = [AXE + cote * amplitude * 0.35, y];
    morceaux.push(`Q${ecrire([AXE + cote * amplitude, y + pasY * 0.55])} ${ecrire(noeud)}`);
    noeuds.push(noeud);
  }

  return {
    trait: { d: morceaux.join(""), role: "tige", epaisseur: 1 },
    noeuds,
  };
}

/* ──────────────────────────── Les espèces ──────────────────────────── */

function fougere(stade: Stade): Trait[] {
  switch (stade) {
    case "graine":
      return [
        { d: cercle([24, 49.2], 2.5), role: "graine", epaisseur: 0.9 },
        { d: courbe([24, 49.2], [25.9, 48.1], [25, 50.6]), role: "graine", epaisseur: 0.55, opacite: 0.7 },
        { d: courbe([23.2, 51.6], [22.2, 53.4], [20.4, 54.2]), role: "tige", epaisseur: 0.6, opacite: 0.45 },
      ];
    case "pousse":
      return [
        ...crosse(PIED, 11, 3, 1),
        ...fronde([24, 52], 6, -34, 3),
      ];
    case "jeune-plant":
      return [
        ...fronde(PIED, 15, -27, 4),
        ...fronde(PIED, 18.5, 2, 5),
        ...fronde(PIED, 14, 26, 4),
      ];
    case "plante":
      return [
        ...fronde(PIED, 20, -38, 5),
        ...fronde(PIED, 26, -18, 6),
        ...fronde(PIED, 28.5, 1, 6),
        ...fronde(PIED, 25, 20, 6),
        ...fronde(PIED, 19, 39, 5),
      ];
    case "floraison":
      return [
        ...fronde(PIED, 23, -43, 5, true),
        ...fronde(PIED, 30, -24, 6, true),
        ...fronde(PIED, 34, -7, 7, true),
        ...fronde(PIED, 33, 10, 7, true),
        ...fronde(PIED, 29, 27, 6, true),
        ...fronde(PIED, 22, 44, 5, true),
        ...crosse([24, 52], 12, -2, -1),
      ];
    case "maturite":
      return [
        ...fronde(PIED, 25, -50, 6, true),
        ...fronde(PIED, 32, -33, 7, true),
        ...fronde(PIED, 38, -17, 8, true),
        ...fronde(PIED, 41, 0, 8, true),
        ...fronde(PIED, 37, 17, 8, true),
        ...fronde(PIED, 31, 34, 7, true),
        ...fronde(PIED, 24, 51, 6, true),
        ...crosse([22.4, 52], 14, -5, -1),
        ...crosse([25.6, 52], 10, 6, 1),
      ];
  }
}

function graminee(stade: Stade): Trait[] {
  switch (stade) {
    case "graine":
      return [
        { d: limbe([20.8, 50.6], [27.4, 49.1], [24.1, 49.7], 1.5), role: "graine", epaisseur: 0.9 },
        { d: courbe([27.4, 49.1], [29.8, 48.1], [31.4, 47.2]), role: "graine", epaisseur: 0.55, opacite: 0.7 },
      ];
    case "pousse":
      return [lame(PIED, 10, -16), lame(PIED, 12.5, 13)];
    case "jeune-plant":
      return [
        lame(PIED, 15, -31),
        lame(PIED, 18.5, -10),
        lame(PIED, 18, 11),
        lame(PIED, 14.5, 32),
      ];
    case "plante":
      return [
        lame(PIED, 20, -44),
        lame(PIED, 25, -27),
        lame(PIED, 28.5, -10),
        lame(PIED, 29, 8),
        lame(PIED, 26, 25),
        lame(PIED, 21, 42),
        lame(PIED, 16, 57),
      ];
    case "floraison":
      return [
        lame(PIED, 21, -46),
        lame(PIED, 26, -29),
        lame(PIED, 29, -12),
        lame(PIED, 29, 9),
        lame(PIED, 26, 27),
        lame(PIED, 21, 44),
        lame(PIED, 16, 59),
        ...epi(PIED, 36, -8, 7),
        ...epi(PIED, 32, 11, 6),
      ];
    case "maturite":
      return [
        lame(PIED, 22, -52),
        lame(PIED, 27, -36),
        lame(PIED, 30, -20),
        lame(PIED, 30, -3),
        lame(PIED, 29, 14),
        lame(PIED, 25, 31),
        lame(PIED, 20, 47),
        lame(PIED, 16, 61),
        ...epi(PIED, 44, -14, 9),
        ...epi(PIED, 41, -3, 8),
        ...epi(PIED, 38, 9, 8),
        ...epi(PIED, 33, 20, 7),
      ];
  }
}

function fleurie(stade: Stade): Trait[] {
  const tige = (hauteur: number, courbure = 1.4): Trait => ({
    d: courbe(PIED, [AXE + courbure, SOL_Y - hauteur * 0.55], [AXE, SOL_Y - hauteur]),
    role: "tige",
    epaisseur: 1,
  });

  switch (stade) {
    case "graine":
      return [
        { d: cercle([24, 49.4], 2.3), role: "graine", epaisseur: 0.9 },
        { d: courbe([24.6, 51.6], [25.4, 53.2], [27, 54]), role: "tige", epaisseur: 0.6, opacite: 0.45 },
      ];
    case "pousse":
      return [
        tige(8),
        ...feuille([24, 45], 6, -58, 0.42, 0.2),
        ...feuille([24, 45], 6, 58, 0.42, 0.2),
      ];
    case "jeune-plant":
      return [
        tige(16),
        ...feuille([24.5, 42], 8, -52),
        ...feuille([24.5, 42], 8, 52),
        ...feuille([24, 36.6], 7, -46),
        ...feuille([24, 36.6], 7, 46),
      ];
    case "plante":
      return [
        tige(24),
        ...feuille([25, 41], 10, -54),
        ...feuille([25, 41], 10, 54),
        ...feuille([24.6, 35], 9, -48),
        ...feuille([24.6, 35], 9, 48),
        ...feuille([24, 30], 7.5, -42),
        ...feuille([24, 30], 7.5, 42),
        bouton([24, 28], 4.6, 0),
      ];
    case "floraison":
      return [
        tige(30),
        ...feuille([25, 41], 11, -56),
        ...feuille([25, 41], 11, 56),
        ...feuille([24.6, 34.5], 9.5, -50),
        ...feuille([24.6, 34.5], 9.5, 50),
        ...feuille([24, 28.5], 8, -44),
        ...feuille([24, 28.5], 8, 44),
        { d: courbe([24, 27], [21.4, 25.4], [20.6, 23.2]), role: "tige", epaisseur: 0.7 },
        { d: courbe([24, 25.5], [26.8, 24.2], [27.6, 22.2]), role: "tige", epaisseur: 0.7 },
        bouton([20.6, 23.2], 3.6, -14),
        bouton([27.6, 22.2], 3.4, 12),
        ...fleur([24, 20.2], 4.2, 5, 0),
      ];
    case "maturite":
      return [
        tige(38),
        ...feuille([25.2, 42], 12, -58),
        ...feuille([25.2, 42], 12, 58),
        ...feuille([24.8, 35.5], 10.5, -52),
        ...feuille([24.8, 35.5], 10.5, 52),
        ...feuille([24.3, 29], 9, -46),
        ...feuille([24.3, 29], 9, 46),
        ...feuille([24, 23], 7, -40),
        ...feuille([24, 23], 7, 40),
        { d: courbe([24, 22], [19.6, 20.4], [18.4, 16.6]), role: "tige", epaisseur: 0.75 },
        { d: courbe([24, 20], [28.6, 18.6], [29.6, 15]), role: "tige", epaisseur: 0.75 },
        ...fleur([18.4, 15.4], 3.8, 5, 18),
        ...fleur([29.6, 13.8], 3.6, 5, -12),
        ...fleur([24, 10.6], 4.6, 6, 0),
        bouton([24, 16.4], 3.2, -8),
      ];
  }
}

function grimpante(stade: Stade): Trait[] {
  const monter = (hauteur: number, ondes: number, amplitude: number, feuilles: number) => {
    const { trait, noeuds } = liane(hauteur, ondes, amplitude);
    const traits: Trait[] = [trait];

    noeuds.forEach((noeud, i) => {
      if (i >= feuilles) return;
      const cote = i % 2 === 0 ? 1 : -1;
      const taille = 9.5 - i * 0.55;
      traits.push(...feuille(noeud, taille, cote * 68, 0.46, 0.24));
    });

    return { traits, noeuds };
  };

  switch (stade) {
    case "graine":
      return [
        { d: limbe([21.4, 50.8], [27, 48.8], [24.6, 50.6], 1.9), role: "graine", epaisseur: 0.9 },
        { d: courbe([22.6, 50.4], [24.2, 49.8], [25.8, 49.4]), role: "graine", epaisseur: 0.5, opacite: 0.6 },
      ];
    case "pousse":
      return [
        { d: courbe(PIED, [22.6, 47.6], [25.4, 44.6]), role: "tige", epaisseur: 1 },
        vrille([25.4, 44.6], 2, 0.9, 1),
        ...feuille([24.4, 47.4], 6.5, -64, 0.46, 0.24),
      ];
    case "jeune-plant": {
      const { traits, noeuds } = monter(17, 2, 5.5, 2);
      return [...traits, vrille(noeuds[noeuds.length - 1], 2.2, 1.1, -1)];
    }
    case "plante": {
      const { traits, noeuds } = monter(27, 3, 6.5, 3);
      return [
        ...traits,
        vrille(noeuds[0], 2.4, 1.2, -1),
        vrille(noeuds[noeuds.length - 1], 2.6, 1.3, 1),
      ];
    }
    case "floraison": {
      const { traits, noeuds } = monter(34, 4, 7, 4);
      return [
        ...traits,
        vrille(noeuds[1], 2.4, 1.2, 1),
        vrille(noeuds[noeuds.length - 1], 2.8, 1.4, -1),
        ...fleur(plus(noeuds[1], [-3.6, -2.4]), 3, 5, 0),
        ...fleur(plus(noeuds[3], [3.4, -2.2]), 2.7, 5, 20),
      ];
    }
    case "maturite": {
      const { traits, noeuds } = monter(43, 5, 7.5, 5);
      return [
        ...traits,
        vrille(noeuds[0], 2.4, 1.2, -1),
        vrille(noeuds[2], 2.6, 1.3, 1),
        vrille(noeuds[noeuds.length - 1], 3, 1.5, -1),
        ...fleur(plus(noeuds[1], [-3.8, -2.6]), 3.2, 5, 0),
        ...fleur(plus(noeuds[2], [3.6, -2.4]), 3, 5, 18),
        ...fleur(plus(noeuds[3], [-3.4, -2.8]), 2.8, 5, -14),
        ...fleur(plus(noeuds[4], [1.6, -3.6]), 3.4, 6, 8),
      ];
    }
  }
}

const DESSINS: Record<Espece, (stade: Stade) => Trait[]> = {
  fougere,
  graminee,
  fleurie,
  grimpante,
};

/** Tous les traits d'une plante, sol compris. */
export function tracer(espece: Espece, stade: Stade): Trait[] {
  return [SOL, ...DESSINS[espece](stade)];
}
