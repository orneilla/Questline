"use client";

import { useMemo } from "react";
import { marked } from "marked";

/**
 * Rendu des instructions d'une recette.
 *
 * Markdown seulement — pas de LaTeX, contrairement aux cartes : une recette
 * n'a pas de formules, et charger KaTeX ici alourdirait la page pour rien.
 *
 * `breaks` est actif : dans une recette, un retour à la ligne est un retour à
 * la ligne. Demander une ligne vide entre chaque étape serait une convention
 * de rédacteur, pas de cuisinier.
 */

marked.setOptions({ breaks: true, gfm: true });

export function Instructions({ texte }: { texte: string }) {
  const html = useMemo(() => marked.parse(texte, { async: false }), [texte]);

  return (
    <div
      className="contenu-recette text-[14.5px] leading-relaxed text-doux"
      // Contenu écrit par l'utilisatrice, pour elle-même : pas de tiers.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
