import "server-only";

import { and, desc, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { journees } from "@/db/schema";

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
