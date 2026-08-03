import type { TypeCarte } from "@/db/schema";

/**
 * Engendrement des cartes à partir d'une note.
 *
 * Une note saisie une fois peut donner plusieurs cartes : un texte à trous en
 * produit autant qu'il porte de repères distincts, une note inversée en produit
 * deux. Toutes partagent une `sourceCle` et se distinguent par leur `index` —
 * c'est ce couple qui permet, quand la note change, de retrouver chaque carte
 * existante et de lui garder sa mémoire au lieu de la recréer à zéro.
 */

export type NoteSource = {
  cle: string;
  recto: string;
  verso: string;
  type: TypeCarte;
  notes?: string;
  tags?: string[];
};

export type CarteEngendree = {
  sourceCle: string;
  /** Numéro du trou interrogé, ou sens de lecture d'une inversée. */
  index: number;
  recto: string;
  verso: string;
  type: TypeCarte;
  notes: string;
  tags: string[];
};

/** Repère un trou : {{c1::réponse}} ou {{c1::réponse::indice}}. */
const TROU = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g;

export function numerosDeTrous(texte: string): number[] {
  const numeros = new Set<number>();
  for (const trouve of texte.matchAll(TROU)) numeros.add(Number(trouve[1]));
  return [...numeros].sort((a, b) => a - b);
}

/**
 * Rend le texte pour un trou donné : celui qu'on interroge devient un blanc,
 * les autres sont révélés. Sur le verso, le trou interrogé est mis en évidence.
 */
export function rendreTrous(
  texte: string,
  numeroActif: number,
  face: "recto" | "verso",
): string {
  return texte.replace(TROU, (_tout, numero, reponse, indice) => {
    const n = Number(numero);
    if (n !== numeroActif) return reponse;
    if (face === "verso") return `**${reponse}**`;
    return indice ? `[${indice}]` : "[…]";
  });
}

export function engendrer(note: NoteSource): CarteEngendree[] {
  const commun = {
    sourceCle: note.cle,
    notes: note.notes ?? "",
    tags: note.tags ?? [],
  };

  if (note.type === "trous") {
    const numeros = numerosDeTrous(note.recto);
    // Sans repère valide, la note reste une carte simple plutôt que rien.
    if (numeros.length === 0) {
      return [
        { ...commun, index: 0, recto: note.recto, verso: note.verso, type: "recto_verso" },
      ];
    }
    return numeros.map((n) => ({
      ...commun,
      index: n,
      type: "trous" as const,
      recto: rendreTrous(note.recto, n, "recto"),
      verso: rendreTrous(note.recto, n, "verso") + (note.verso ? `\n\n${note.verso}` : ""),
    }));
  }

  if (note.type === "inversee") {
    return [
      { ...commun, index: 0, type: "inversee" as const, recto: note.recto, verso: note.verso },
      { ...commun, index: 1, type: "inversee" as const, recto: note.verso, verso: note.recto },
    ];
  }

  return [
    { ...commun, index: 0, type: "recto_verso" as const, recto: note.recto, verso: note.verso },
  ];
}

/** Plage arabe de base, plus les formes étendues. */
const ARABE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

/** Vrai si le texte est majoritairement écrit de droite à gauche. */
export function estRtl(texte: string): boolean {
  const sansBalises = texte.replace(/[^\p{L}]/gu, "");
  if (sansBalises.length === 0) return false;
  const arabes = [...sansBalises].filter((c) => ARABE.test(c)).length;
  return arabes / sansBalises.length > 0.3;
}
