/**
 * Les formats de carte pour la mémorisation — logique pure.
 *
 * Ce module ne touche ni à la base ni au réseau : il décrit les trois formats
 * et sait masquer la fin d'un verset sans en altérer un seul caractère. Il est
 * séparé du reste pour être importable par l'écran de lecture, qui est un
 * composant client.
 */

export type FormatHifz = "traduction" | "enchainement" | "fin_masquee";

export const FORMATS: { valeur: FormatHifz; libelle: string; aide: string }[] = [
  {
    valeur: "traduction",
    libelle: "Depuis la traduction",
    aide: "La traduction au recto, le verset arabe au verso.",
  },
  {
    valeur: "enchainement",
    libelle: "Verset suivant",
    aide: "Le verset au recto, celui qui le suit au verso.",
  },
  {
    valeur: "fin_masquee",
    libelle: "Fin masquée",
    aide: "Le verset avec ses derniers mots cachés. Aucun caractère n'est modifié.",
  },
];

/**
 * Masque la fin d'un verset sans toucher au texte.
 *
 * Le découpage garde les séparateurs : recoller tous les morceaux redonne
 * exactement la chaîne d'origine. Seules les marques de trou sont ajoutées,
 * autour d'une portion — jamais à l'intérieur d'un mot, jamais en remplacement
 * de quoi que ce soit.
 *
 * Ce sont les derniers mots qui sont masqués, mécaniquement : décider quels
 * mots seraient « clés » demanderait un jugement sur le sens, et ce module n'en
 * porte aucun.
 */
export function masquerLaFin(texte: string, part = 0.4): string {
  const morceaux = texte.split(/(\s+)/);
  const indicesMots = morceaux
    .map((m, i) => (m.trim().length > 0 ? i : -1))
    .filter((i) => i >= 0);

  if (indicesMots.length < 3) return `{{c1::${texte}}}`;

  const combien = Math.max(1, Math.round(indicesMots.length * part));
  const depart = indicesMots[indicesMots.length - combien];

  return (
    morceaux.slice(0, depart).join("") +
    "{{c1::" +
    morceaux.slice(depart).join("") +
    "}}"
  );
}
