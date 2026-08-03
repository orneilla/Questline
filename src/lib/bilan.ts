import "server-only";

import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { arcs, journees, momentum, quetes, validations, type Pilier } from "@/db/schema";
import { PILIERS } from "./constantes";
import { aujourdhui, decalerJours } from "./dates";
import { lundiDeLaSemaine } from "./semaine";

/**
 * Bilan de la semaine, entièrement dérivé des chiffres en base.
 *
 * Aucun modèle de langage, aucun score global, aucune appréciation. On compte
 * ce qui s'est passé, on le met en regard de la semaine précédente, et on
 * s'arrête là. Les jours sans rien ne sont pas des échecs et ne sont pas
 * comptés comme tels.
 */

export type LignePilier = {
  pilier: Pilier;
  validations: number;
  points: number;
  validationsAvant: number;
  pointsAvant: number;
  momentum: number;
};

export type Bilan = {
  debut: string;
  fin: string;
  debutAvant: string;
  finAvant: string;
  parPilier: LignePilier[];
  total: number;
  totalAvant: number;
  /** Piliers extrêmes de la semaine, ou null si tout est à égalité. */
  plusActif: Pilier | null;
  plusDelaisse: Pilier | null;
  joursActifs: number;
  joursBas: string[];
  phrases: { date: string; phrase: string }[];
};

const POINTS = sql<number>`coalesce(sum(${quetes.poids} * case when ${validations.bonusReprise} then 2 else 1 end), 0)`;

async function comptesParPilier(debut: string, fin: string) {
  const lignes = await db
    .select({
      pilier: arcs.pilier,
      nombre: sql<number>`count(*)`,
      points: POINTS,
    })
    .from(validations)
    .innerJoin(quetes, eq(validations.queteId, quetes.id))
    .innerJoin(arcs, eq(quetes.arcId, arcs.id))
    .where(and(gte(validations.date, debut), lte(validations.date, fin)))
    .groupBy(arcs.pilier);

  return new Map(
    lignes.map((l) => [l.pilier, { nombre: Number(l.nombre), points: Number(l.points) }]),
  );
}

export async function chargerBilan(): Promise<Bilan> {
  const debut = lundiDeLaSemaine(aujourdhui());
  const fin = decalerJours(debut, 6);
  const debutAvant = decalerJours(debut, -7);
  const finAvant = decalerJours(debut, -1);

  const [semaine, precedente, lignesMomentum, joursDeLaSemaine, joursActifs] =
    await Promise.all([
      comptesParPilier(debut, fin),
      comptesParPilier(debutAvant, finAvant),
      db.select().from(momentum),
      db
        .select()
        .from(journees)
        .where(and(gte(journees.date, debut), lte(journees.date, fin)))
        .orderBy(asc(journees.date)),
      db
        .selectDistinct({ date: validations.date })
        .from(validations)
        .where(and(gte(validations.date, debut), lte(validations.date, fin))),
    ]);

  const parPilier: LignePilier[] = PILIERS.map((pilier) => ({
    pilier,
    validations: semaine.get(pilier)?.nombre ?? 0,
    points: semaine.get(pilier)?.points ?? 0,
    validationsAvant: precedente.get(pilier)?.nombre ?? 0,
    pointsAvant: precedente.get(pilier)?.points ?? 0,
    momentum: lignesMomentum.find((m) => m.pilier === pilier)?.valeur ?? 0,
  }));

  const total = parPilier.reduce((t, l) => t + l.validations, 0);
  const totalAvant = parPilier.reduce((t, l) => t + l.validationsAvant, 0);

  // À égalité parfaite, désigner un « plus actif » n'aurait aucun sens.
  const tries = [...parPilier].sort((a, b) => b.points - a.points);
  const distinct = tries[0].points !== tries[tries.length - 1].points;

  return {
    debut,
    fin,
    debutAvant,
    finAvant,
    parPilier,
    total,
    totalAvant,
    plusActif: distinct ? tries[0].pilier : null,
    plusDelaisse: distinct ? tries[tries.length - 1].pilier : null,
    joursActifs: joursActifs.length,
    joursBas: joursDeLaSemaine.filter((j) => j.modeBas).map((j) => j.date),
    phrases: joursDeLaSemaine
      .filter((j) => j.phrase.trim().length > 0)
      .map((j) => ({ date: j.date, phrase: j.phrase })),
  };
}
