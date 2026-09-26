/**
 * Un catalogue : un jeu de cartes de cours, écrit dans le code et installable
 * d'un geste depuis les réglages des cartes.
 *
 * Chaque note porte une clé stable. C'est ce qui permet de réinstaller un
 * catalogue corrigé ou enrichi sans rien perdre : les cartes déjà connues sont
 * retrouvées par leur clé et réécrites sur place, mémoire FSRS comprise.
 *
 * Les images s'écrivent `[[structure:clé]]` dans le texte. À l'installation,
 * chaque dessin devient une image de la table `medias` et le repère, un lien
 * Markdown vers `/api/cartes/media/<id>.svg`.
 */

import type { TypeCarte } from "@/db/schema";

export type NoteCatalogue = {
  /** Unique dans le catalogue, stable d'une version à l'autre. */
  cle: string;
  recto: string;
  verso: string;
  type?: TypeCarte;
  notes?: string;
  tags?: string[];
};

export type PaquetCatalogue = {
  /** Stable : c'est par elle qu'on retrouve le paquet après un renommage. */
  cle: string;
  nom: string;
  notes: NoteCatalogue[];
};

export type Catalogue = {
  id: string;
  titre: string;
  /** D'où vient la matière. */
  source: string;
  description: string;
  espace: { nom: string; couleur: string };
  /** Paquet parent de tous ceux du catalogue. */
  racine: string;
  paquets: PaquetCatalogue[];
  /** Dessins SVG, par clé. */
  images: Record<string, string>;
};

/** Repère d'image dans le texte d'une note. */
export const REPERE_IMAGE = /\[\[structure:([a-z0-9-]+)\]\]/g;
