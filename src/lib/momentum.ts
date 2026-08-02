import { MOMENTUM_MAX, SEUIL_REPRISE_JOURS, TAUX_DECROISSANCE } from "./constantes";
import { ecartJours } from "./dates";

/**
 * Règle centrale de l'app.
 *
 * L'élan d'un pilier ne se casse pas : il s'érode doucement (-5 % par jour
 * silencieux) et repart plus vite après une pause. Rien ici ne remet jamais
 * une valeur à zéro, et aucune fonction ne compte les échecs.
 */

export function borner(valeur: number): number {
  return Math.min(MOMENTUM_MAX, Math.max(0, valeur));
}

/** -5 % par jour d'inactivité, de façon multiplicative : jamais de retour à zéro. */
export function appliquerDecroissance(valeur: number, joursInactifs: number): number {
  if (joursInactifs <= 0) return borner(valeur);
  return borner(valeur * Math.pow(1 - TAUX_DECROISSANCE, joursInactifs));
}

/**
 * Après deux jours de silence sur un pilier, la première validation compte
 * double. Un pilier jamais entamé démarre normalement : ce n'est pas une reprise.
 */
export function meriteBonusReprise(
  derniereValidation: string | null,
  date: string,
): boolean {
  if (!derniereValidation) return false;
  return ecartJours(derniereValidation, date) >= SEUIL_REPRISE_JOURS;
}

export function gainValidation(poids: number, bonus: boolean): number {
  return bonus ? poids * 2 : poids;
}

/** Part de la barre à remplir, entre 0 et 1. */
export function intensite(valeur: number): number {
  return borner(valeur) / MOMENTUM_MAX;
}

/** Qualificatif sobre affiché sous la barre. Aucun de ces états n'est un échec. */
export function etatMomentum(valeur: number): string {
  if (valeur < 1) return "en attente";
  if (valeur < 20) return "amorcé";
  if (valeur < 45) return "en marche";
  if (valeur < 75) return "installé";
  return "ancré";
}
