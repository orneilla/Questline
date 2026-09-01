import "server-only";

import { and, desc, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { journees, saisons } from "@/db/schema";

/**
 * Les phrases du soir, relues.
 *
 * Elles étaient écrites et gardées, mais rendues nulle part sauf le jour même :
 * on pouvait les écrire sans jamais les revoir. Ce module les rend, de la plus
 * récente à la plus ancienne — c'est un journal, et un journal se relit.
 *
 * Rien n'est interprété, résumé ni classé : le texte est rendu tel qu'il a été
 * écrit, avec sa date.
 */

export type PhraseJournal = {
  date: string;
  texte: string;
};

export async function chargerPhrases(): Promise<PhraseJournal[]> {
  const lignes = await db
    .select({ date: journees.date, phrase: journees.phrase })
    .from(journees)
    .where(and(ne(journees.phrase, ""), sql`btrim(${journees.phrase}) <> ''`))
    .orderBy(desc(journees.date));

  return lignes.map((l) => ({ date: l.date, texte: l.phrase }));
}

/* ─────────────────────────── Correction ─────────────────────────── */

/**
 * Corrige une phrase déjà écrite.
 *
 * Une journée absente n'est jamais créée : on corrige ce qui a été vécu, on
 * n'invente pas un jour. Vider entièrement le texte retire simplement la
 * phrase du journal — c'est la même chose que d'effacer le champ du soir.
 */
export async function corrigerPhrase(date: string, texte: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const lignes = await db
    .update(journees)
    .set({ phrase: texte.slice(0, 2000) })
    .where(eq(journees.date, date))
    .returning({ date: journees.date });

  return lignes.length > 0;
}

/**
 * Corrige la réponse de fin d'une saison close.
 *
 * La question, elle, ne bouge pas : c'est celle qui a été posée ce jour-là.
 */
export async function corrigerReponseSaison(
  numero: number,
  texte: string,
): Promise<boolean> {
  if (!Number.isInteger(numero) || numero < 1) return false;

  const lignes = await db
    .update(saisons)
    .set({ reponse: texte.slice(0, 4000) })
    .where(eq(saisons.numero, numero))
    .returning({ numero: saisons.numero });

  return lignes.length > 0;
}
