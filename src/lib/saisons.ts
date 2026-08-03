import "server-only";

import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { arcs, journees, quetes, saisons, validations, type Pilier } from "@/db/schema";
import { LIBELLES_PILIERS, PILIERS } from "./constantes";
import { aujourdhui, decalerJours, ecartJours } from "./dates";
import { lundiDeLaSemaine } from "./semaine";

/**
 * Saisons : des cycles de quatre semaines, numérotés.
 *
 * Elles ne servent pas à noter mais à découper. À la fin de chacune, un écran
 * constate ce qui a bougé et pose une question ouverte — la réponse est
 * archivée telle quelle, sans traitement.
 */

const SEMAINES_PAR_SAISON = 4;
const JOURS_PAR_SAISON = SEMAINES_PAR_SAISON * 7;

/**
 * Les questions tournent avec le numéro de saison. Elles sont ouvertes et sans
 * bonne réponse : aucune ne demande de justifier un manque.
 */
const QUESTIONS = [
  "Qu'est-ce qui a été plus facile que prévu ?",
  "Qu'est-ce que tu as fait sans y penser, cette saison ?",
  "Qu'est-ce qui mérite d'occuper plus de place ?",
  "Qu'est-ce que tu portes encore par habitude, sans y tenir ?",
  "Où est-ce que le temps est passé, réellement ?",
  "Qu'est-ce que tu ferais à l'identique ?",
  "Qu'est-ce qui te manque pour la suite ?",
  "Qu'est-ce qui a changé sans que tu le décides ?",
];

export type BilanSaison = {
  numero: number;
  debut: string;
  fin: string;
  question: string;
  reponse: string;
  cloturee: boolean;
  /** Piliers qui ont le plus et le moins avancé sur la saison. */
  avance: { pilier: Pilier; points: number }[];
  stagnants: Pilier[];
  totalValidations: number;
  joursActifs: number;
};

/** Premier jour observé dans le journal ; à défaut, le lundi de cette semaine. */
async function origine(): Promise<string> {
  const [premiere] = await db
    .select({ date: journees.date })
    .from(journees)
    .orderBy(asc(journees.date))
    .limit(1);

  return lundiDeLaSemaine(premiere?.date ?? aujourdhui());
}

export function numeroDe(origineIso: string, date: string): number {
  const jours = ecartJours(origineIso, date);
  return Math.max(1, Math.floor(jours / JOURS_PAR_SAISON) + 1);
}

function bornes(origineIso: string, numero: number) {
  const debut = decalerJours(origineIso, (numero - 1) * JOURS_PAR_SAISON);
  return { debut, fin: decalerJours(debut, JOURS_PAR_SAISON - 1) };
}

/** Crée les lignes de saison manquantes jusqu'à aujourd'hui. */
export async function assurerSaisons(date = aujourdhui()): Promise<void> {
  const depart = await origine();
  const courante = numeroDe(depart, date);

  const existantes = await db.select({ numero: saisons.numero }).from(saisons);
  const connues = new Set(existantes.map((s) => s.numero));

  const manquantes = [];
  for (let n = 1; n <= courante; n += 1) {
    if (connues.has(n)) continue;
    const { debut, fin } = bornes(depart, n);
    manquantes.push({
      numero: n,
      debut,
      fin,
      question: QUESTIONS[(n - 1) % QUESTIONS.length],
    });
  }

  if (manquantes.length > 0) {
    await db.insert(saisons).values(manquantes).onConflictDoNothing();
  }
}

async function mesurer(debut: string, fin: string) {
  const [parPilier, jours] = await Promise.all([
    db
      .select({
        pilier: arcs.pilier,
        points: sql<number>`coalesce(sum(${quetes.poids} * case when ${validations.bonusReprise} then 2 else 1 end), 0)`,
        nombre: sql<number>`count(*)`,
      })
      .from(validations)
      .innerJoin(quetes, eq(validations.queteId, quetes.id))
      .innerJoin(arcs, eq(quetes.arcId, arcs.id))
      .where(and(gte(validations.date, debut), lte(validations.date, fin)))
      .groupBy(arcs.pilier),
    db
      .selectDistinct({ date: validations.date })
      .from(validations)
      .where(and(gte(validations.date, debut), lte(validations.date, fin))),
  ]);

  const points = new Map(parPilier.map((p) => [p.pilier, Number(p.points)]));

  return {
    avance: PILIERS.map((pilier) => ({ pilier, points: points.get(pilier) ?? 0 }))
      .filter((p) => p.points > 0)
      .sort((a, b) => b.points - a.points),
    stagnants: PILIERS.filter((p) => (points.get(p) ?? 0) === 0),
    totalValidations: parPilier.reduce((t, p) => t + Number(p.nombre), 0),
    joursActifs: jours.length,
  };
}

/** La saison achevée qui attend encore sa clôture, s'il y en a une. */
export async function saisonAClore(date = aujourdhui()): Promise<BilanSaison | null> {
  await assurerSaisons(date);

  const [ligne] = await db
    .select()
    .from(saisons)
    .where(and(isNull(saisons.clotureeLe), lte(saisons.fin, decalerJours(date, -1))))
    .orderBy(asc(saisons.numero))
    .limit(1);

  if (!ligne) return null;

  return {
    numero: ligne.numero,
    debut: ligne.debut,
    fin: ligne.fin,
    question: ligne.question,
    reponse: ligne.reponse,
    cloturee: false,
    ...(await mesurer(ligne.debut, ligne.fin)),
  };
}

/** Numéro et bornes de la saison en cours, pour l'afficher discrètement. */
export async function saisonCourante(date = aujourdhui()) {
  const depart = await origine();
  const numero = numeroDe(depart, date);
  const { debut, fin } = bornes(depart, numero);
  return { numero, debut, fin, jourDansLaSaison: ecartJours(debut, date) + 1 };
}

export async function cloreSaison(numero: number, reponse: string): Promise<void> {
  await db
    .update(saisons)
    .set({ reponse: reponse.slice(0, 4000), clotureeLe: aujourdhui() })
    .where(eq(saisons.numero, numero));
}

export type SaisonArchivee = {
  numero: number;
  debut: string;
  fin: string;
  question: string;
  reponse: string;
};

/** Les saisons closes, de la plus récente à la plus ancienne. */
export async function chargerSaisonsArchivees(): Promise<SaisonArchivee[]> {
  const lignes = await db
    .select()
    .from(saisons)
    .where(sql`${saisons.clotureeLe} is not null`)
    .orderBy(desc(saisons.numero));

  return lignes.map((l) => ({
    numero: l.numero,
    debut: l.debut,
    fin: l.fin,
    question: l.question,
    reponse: l.reponse,
  }));
}

export { LIBELLES_PILIERS };
