import { ecartJours } from "./dates";
import { QUETES_RARES, type QueteRare } from "./recits/quetes-rares";
import {
  TITRES,
  convient,
  specificite,
  type ContexteTitre,
  type NiveauElan,
  type Saison,
  type Titre,
} from "./recits/titres";

/**
 * Choix du titre du jour et de la quête rare.
 *
 * Tout est déterministe : la même date dans le même contexte donne le même
 * résultat. Rien n'est tiré au hasard à l'exécution, donc rien ne change en
 * rechargeant la page.
 */

/** Repère fixe pour cadencer les raretés. Antérieur à tout usage de l'app. */
const EPOQUE = "2026-01-01";

/** Une journée sur cinq, en moyenne. */
const RARETE = 5;

/** Un titre ne revient pas avant ce nombre de jours. */
export const MEMOIRE_TITRES_JOURS = 15;

/** FNV-1a, 32 bits : petit, stable, suffisant pour départager. */
function empreinte(chaine: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < chaine.length; i += 1) {
    h ^= chaine.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function saisonDe(date: string): Saison {
  const mois = Number(date.slice(5, 7));
  if (mois === 12 || mois <= 2) return "hiver";
  if (mois <= 5) return "printemps";
  if (mois <= 8) return "ete";
  return "automne";
}

export function niveauElan(valeurs: number[]): NiveauElan {
  if (valeurs.length === 0) return "bas";
  const moyenne = valeurs.reduce((t, v) => t + v, 0) / valeurs.length;
  if (moyenne < 15) return "bas";
  if (moyenne < 45) return "moyen";
  return "haut";
}

/**
 * Seuil à partir duquel une condition est jugée marquante : jour bas,
 * lendemain de nuit, heure inhabituelle.
 */
const SPECIFICITE_MARQUANTE = 3;

/**
 * Le titre du jour.
 *
 * Une journée vraiment marquée — jour bas, lendemain de nuit, ouverture en
 * pleine nuit — est nommée par ce qui la marque. Une journée ordinaire puise
 * dans tout le catalogue, fond commun compris : sans cela les titres neutres
 * ne sortiraient jamais, et l'app se répéterait vite.
 *
 * À égalité, la date départage. Les titres vus récemment sont écartés, sauf
 * s'il ne reste plus rien.
 */
export function choisirTitre(
  date: string,
  ctx: ContexteTitre,
  clesRecentes: readonly string[],
): Titre {
  const eligibles = TITRES.filter((t) => convient(t, ctx));
  const recentes = new Set(clesRecentes);
  const frais = eligibles.filter((t) => !recentes.has(t.cle));
  const bassin = frais.length > 0 ? frais : eligibles;

  const meilleure = Math.max(...bassin.map(specificite));
  const retenus = (
    meilleure >= SPECIFICITE_MARQUANTE
      ? bassin.filter((t) => specificite(t) === meilleure)
      : bassin
  ).sort((a, b) => a.cle.localeCompare(b.cle));

  return retenus[empreinte(date) % retenus.length];
}

export function estJourRare(date: string): boolean {
  return empreinte(`${date}|rare`) % RARETE === 0;
}

/**
 * La quête rare du jour, ou null si le jour n'en porte pas.
 *
 * Le rang compte les jours rares depuis l'époque : le catalogue est parcouru
 * en entier avant qu'une quête ne revienne.
 */
export function queteRareDu(date: string): QueteRare | null {
  if (!estJourRare(date)) return null;

  const jours = ecartJours(EPOQUE, date);
  if (jours < 0) return null;

  let rang = 0;
  for (let i = 1; i <= jours; i += 1) {
    const veille = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000);
    const iso = veille.toISOString().slice(0, 10);
    if (estJourRare(iso)) rang += 1;
  }

  return QUETES_RARES[(rang - 1 + QUETES_RARES.length) % QUETES_RARES.length];
}

/** Le texte d'un titre à partir de sa clé enregistrée. */
export function texteDuTitre(cle: string): string {
  return TITRES.find((t) => t.cle === cle)?.texte ?? "Aujourd'hui";
}

export type { ContexteTitre, NiveauElan, Saison, Titre, QueteRare };
