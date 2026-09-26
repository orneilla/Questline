import { engendrer } from "@/lib/cartes/generation";

import { GROUPES_PROTECTEURS } from "./groupes-protecteurs";
import { REPERE_IMAGE, type Catalogue, type NoteCatalogue } from "./types";

/**
 * Les catalogues connus de l'application. En ajouter un : écrire son module à
 * côté de `groupes-protecteurs.ts` et l'inscrire ici.
 */
export const CATALOGUES: Catalogue[] = [GROUPES_PROTECTEURS];

export function trouverCatalogue(id: string): Catalogue | undefined {
  return CATALOGUES.find((c) => c.id === id);
}

/** Préfixe des `sourceCle` d'un catalogue : c'est lui qui les retrouve en base. */
export function prefixeCatalogue(catalogue: Catalogue): string {
  return `cat:${catalogue.id}:`;
}

export function cleSource(catalogue: Catalogue, note: NoteCatalogue): string {
  return `${prefixeCatalogue(catalogue)}${note.cle}`;
}

/** Nombre de cartes qu'engendre le catalogue — une note inversée en donne deux. */
export function compterCartes(catalogue: Catalogue): { notes: number; cartes: number } {
  let notes = 0;
  let cartes = 0;
  for (const paquet of catalogue.paquets) {
    for (const note of paquet.notes) {
      notes += 1;
      cartes += engendrer({
        cle: note.cle,
        recto: note.recto,
        verso: note.verso,
        type: note.type ?? "recto_verso",
      }).length;
    }
  }
  return { notes, cartes };
}

/** Les clés d'image citées par les notes, dans l'ordre d'apparition. */
export function imagesCitees(catalogue: Catalogue): string[] {
  const vues = new Set<string>();
  for (const paquet of catalogue.paquets) {
    for (const note of paquet.notes) {
      for (const texte of [note.recto, note.verso]) {
        for (const trouve of texte.matchAll(REPERE_IMAGE)) vues.add(trouve[1]);
      }
    }
  }
  return [...vues];
}

/**
 * Vérifie un catalogue sans toucher la base : clés uniques, images présentes.
 * Renvoie la liste des problèmes, vide si tout va bien.
 */
export function verifierCatalogue(catalogue: Catalogue): string[] {
  const problemes: string[] = [];
  const cles = new Set<string>();
  for (const paquet of catalogue.paquets) {
    for (const note of paquet.notes) {
      if (cles.has(note.cle)) problemes.push(`Clé en double : ${note.cle}`);
      cles.add(note.cle);
      if (!note.recto.trim() || !note.verso.trim()) problemes.push(`Face vide : ${note.cle}`);
    }
  }
  for (const cle of imagesCitees(catalogue)) {
    if (!catalogue.images[cle]) problemes.push(`Image manquante : ${cle}`);
  }
  return problemes;
}
