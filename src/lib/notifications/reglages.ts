import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { reglagesNotifications, type Canal } from "@/db/schema";
import { aujourdhui, decalerJours } from "@/lib/dates";

/**
 * Réglages des rappels.
 *
 * Une seule ligne, créée à la première lecture. Les valeurs par défaut sont
 * celles de la spécification : le push seul, les deux créneaux actifs, 7 h 30
 * et 21 h 30.
 */

export type ReglagesRappels = {
  canal: Canal;
  matinActif: boolean;
  soirActif: boolean;
  heureMatin: number;
  heureSoir: number;
  pauseJusqua: string | null;
  premiereOuverture: string | null;
  vapidInstallee: boolean;
};

const DEFAUTS = {
  canal: "push" as Canal,
  matinActif: true,
  soirActif: true,
  heureMatin: 7 * 60 + 30,
  heureSoir: 21 * 60 + 30,
};

export async function chargerReglagesRappels(): Promise<ReglagesRappels> {
  const [ligne] = await db
    .select()
    .from(reglagesNotifications)
    .where(eq(reglagesNotifications.id, 1))
    .limit(1);

  if (!ligne) {
    // La première ouverture est notée maintenant : c'est elle qui décide du
    // moment où l'on osera proposer les notifications.
    await db
      .insert(reglagesNotifications)
      .values({ id: 1, premiereOuverture: aujourdhui() })
      .onConflictDoNothing();

    return { ...DEFAUTS, pauseJusqua: null, premiereOuverture: aujourdhui(), vapidInstallee: false };
  }

  return {
    canal: ligne.canal,
    matinActif: ligne.matinActif,
    soirActif: ligne.soirActif,
    heureMatin: ligne.heureMatin,
    heureSoir: ligne.heureSoir,
    pauseJusqua: ligne.pauseJusqua,
    premiereOuverture: ligne.premiereOuverture,
    vapidInstallee: Boolean(ligne.vapidPublique && ligne.vapidPrivee),
  };
}

export type ModifsRappels = Partial<{
  canal: Canal;
  matinActif: boolean;
  soirActif: boolean;
  heureMatin: number;
  heureSoir: number;
  pauseJusqua: string | null;
}>;

function borner(minutes: number): number {
  return Math.min(23 * 60 + 59, Math.max(0, Math.round(minutes)));
}

export async function enregistrerReglagesRappels(modifs: ModifsRappels): Promise<void> {
  const valeurs = {
    ...modifs,
    ...(modifs.heureMatin !== undefined ? { heureMatin: borner(modifs.heureMatin) } : {}),
    ...(modifs.heureSoir !== undefined ? { heureSoir: borner(modifs.heureSoir) } : {}),
  };

  await db
    .insert(reglagesNotifications)
    .values({ id: 1, premiereOuverture: aujourdhui(), ...valeurs })
    .onConflictDoUpdate({ target: reglagesNotifications.id, set: valeurs });
}

/** Suspend tous les rappels pendant n jours, sans rien désactiver. */
export async function mettreEnPause(jours: number): Promise<string> {
  const bornes = Math.min(60, Math.max(1, Math.round(jours)));
  const jusqua = decalerJours(aujourdhui(), bornes - 1);
  await enregistrerReglagesRappels({ pauseJusqua: jusqua });
  return jusqua;
}

export async function reprendre(): Promise<void> {
  await enregistrerReglagesRappels({ pauseJusqua: null });
}

/** Vrai si les rappels sont suspendus aujourd'hui. */
export function enPause(reglages: ReglagesRappels, date = aujourdhui()): boolean {
  return reglages.pauseJusqua !== null && date <= reglages.pauseJusqua;
}

/** Jours écoulés depuis la première ouverture. */
export function anciennete(reglages: ReglagesRappels, date = aujourdhui()): number {
  if (!reglages.premiereOuverture) return 0;
  const a = Date.parse(`${reglages.premiereOuverture}T00:00:00Z`);
  const b = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Au-delà, on se permet de proposer les notifications sur l'écran du jour. */
export const JOURS_AVANT_PROPOSITION = 7;
