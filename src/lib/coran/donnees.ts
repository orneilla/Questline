import "server-only";

import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  arcs,
  editionsCoran,
  marquePages,
  positionLecture,
  quetes,
  reglagesCoran,
  seancesLecture,
  sourates,
  textesVersets,
  versets,
  type Sourate,
  type UniteObjectif,
} from "@/db/schema";
import { aujourdhui } from "@/lib/dates";
import { crediterPilier, validerQuete } from "@/lib/jour";
import { TOTAL_VERSETS } from "./import";

/**
 * Lecture du module Coran.
 *
 * Rien ici ne fabrique ni ne retouche du texte : les fonctions vont chercher en
 * base ce qui y a été importé et le rendent tel quel. Le seul calcul est celui
 * de la progression, et il compte — il ne juge pas.
 */

export type ReglagesCoranComplets = {
  traduction: string | null;
  translitteration: string | null;
  reciteur: string;
  tailleArabe: number;
  policeArabe: string;
  afficherArabe: boolean;
  afficherTranslitteration: boolean;
  afficherTraduction: boolean;
  uniteObjectif: UniteObjectif;
  objectifQuotidien: number;
};

const DEFAUTS: ReglagesCoranComplets = {
  traduction: null,
  translitteration: null,
  reciteur: "ar.alafasy",
  tailleArabe: 30,
  policeArabe: "amiri",
  afficherArabe: true,
  afficherTranslitteration: true,
  afficherTraduction: true,
  uniteObjectif: "versets",
  objectifQuotidien: 20,
};

export async function chargerReglagesCoran(): Promise<ReglagesCoranComplets> {
  const [ligne] = await db.select().from(reglagesCoran).limit(1);
  if (!ligne) return DEFAUTS;
  return {
    traduction: ligne.traduction,
    translitteration: ligne.translitteration,
    reciteur: ligne.reciteur,
    tailleArabe: ligne.tailleArabe,
    policeArabe: ligne.policeArabe,
    afficherArabe: ligne.afficherArabe,
    afficherTranslitteration: ligne.afficherTranslitteration,
    afficherTraduction: ligne.afficherTraduction,
    uniteObjectif: ligne.uniteObjectif,
    objectifQuotidien: ligne.objectifQuotidien,
  };
}

export async function enregistrerReglagesCoran(
  valeurs: Partial<ReglagesCoranComplets>,
): Promise<void> {
  const [existant] = await db.select({ id: reglagesCoran.id }).from(reglagesCoran).limit(1);
  if (existant) {
    await db.update(reglagesCoran).set(valeurs).where(eq(reglagesCoran.id, existant.id));
    return;
  }
  await db.insert(reglagesCoran).values({ id: 1, ...DEFAUTS, ...valeurs });
}

/* ──────────────────────────── Texte ──────────────────────────── */

export async function chargerSourates(): Promise<Sourate[]> {
  return db.select().from(sourates).orderBy(asc(sourates.numero));
}

export type VersetAffiche = {
  numero: number;
  sourate: number;
  numeroDansSourate: number;
  juz: number;
  page: number;
  sajda: boolean;
  arabe: string;
  translitteration: string | null;
  traduction: string | null;
};

/** Les versets d'une plage globale, avec les éditions choisies. */
export async function chargerVersets(
  debut: number,
  fin: number,
  editions: { traduction: string | null; translitteration: string | null },
): Promise<VersetAffiche[]> {
  const lignes = await db
    .select()
    .from(versets)
    .where(and(gte(versets.numero, debut), lte(versets.numero, fin)))
    .orderBy(asc(versets.numero));

  if (lignes.length === 0) return [];

  const cles = [editions.traduction, editions.translitteration].filter(
    (c): c is string => c !== null,
  );

  const textes =
    cles.length === 0
      ? []
      : await db
          .select()
          .from(textesVersets)
          .where(
            and(
              sql`${textesVersets.editionCle} in ${cles}`,
              gte(textesVersets.versetNumero, debut),
              lte(textesVersets.versetNumero, fin),
            ),
          );

  const parEdition = new Map<string, Map<number, string>>();
  for (const t of textes) {
    const carte = parEdition.get(t.editionCle) ?? new Map<number, string>();
    carte.set(t.versetNumero, t.texte);
    parEdition.set(t.editionCle, carte);
  }

  const traduction = editions.traduction
    ? (parEdition.get(editions.traduction) ?? new Map())
    : null;
  const translitteration = editions.translitteration
    ? (parEdition.get(editions.translitteration) ?? new Map())
    : null;

  return lignes.map((v) => ({
    numero: v.numero,
    sourate: v.sourate,
    numeroDansSourate: v.numeroDansSourate,
    juz: v.juz,
    page: v.page,
    sajda: v.sajda,
    arabe: v.texte,
    translitteration: translitteration?.get(v.numero) ?? null,
    traduction: traduction?.get(v.numero) ?? null,
  }));
}

/** Bornes globales d'un juz'. */
export async function bornesJuz(juz: number): Promise<{ debut: number; fin: number } | null> {
  const [ligne] = await db
    .select({
      debut: sql<number>`min(${versets.numero})`,
      fin: sql<number>`max(${versets.numero})`,
    })
    .from(versets)
    .where(eq(versets.juz, juz));
  if (!ligne?.debut) return null;
  return { debut: Number(ligne.debut), fin: Number(ligne.fin) };
}

export async function editionsInstallees() {
  return db.select().from(editionsCoran).orderBy(asc(editionsCoran.type));
}

/* ─────────────────────── Reprise et marque-pages ─────────────────────── */

export async function positionCourante(): Promise<number> {
  const [ligne] = await db.select().from(positionLecture).limit(1);
  return ligne?.versetNumero ?? 1;
}

export async function enregistrerPosition(versetNumero: number): Promise<void> {
  const valeurs = {
    versetNumero: Math.max(1, Math.min(TOTAL_VERSETS, Math.round(versetNumero))),
    modifieLe: new Date().toISOString(),
  };
  const [existant] = await db.select({ id: positionLecture.id }).from(positionLecture).limit(1);
  if (existant) {
    await db.update(positionLecture).set(valeurs).where(eq(positionLecture.id, existant.id));
    return;
  }
  await db.insert(positionLecture).values({ id: 1, ...valeurs });
}

export async function chargerMarquePages() {
  return db
    .select({
      id: marquePages.id,
      versetNumero: marquePages.versetNumero,
      nom: marquePages.nom,
      creeLe: marquePages.creeLe,
      sourate: versets.sourate,
      numeroDansSourate: versets.numeroDansSourate,
      nomSourate: sourates.nomTranslittere,
    })
    .from(marquePages)
    .innerJoin(versets, eq(marquePages.versetNumero, versets.numero))
    .innerJoin(sourates, eq(versets.sourate, sourates.numero))
    .orderBy(desc(marquePages.creeLe));
}

export async function poserMarquePage(versetNumero: number, nom: string): Promise<void> {
  await db.insert(marquePages).values({
    versetNumero,
    nom: nom.trim().slice(0, 120),
    creeLe: new Date().toISOString(),
  });
}

export async function retirerMarquePage(id: number): Promise<void> {
  await db.delete(marquePages).where(eq(marquePages.id, id));
}

/* ──────────────────────────── Suivi ──────────────────────────── */

export type Progression = {
  /** Ce qui a été lu aujourd'hui, dans l'unité de l'objectif. */
  aujourdhui: number;
  objectif: number;
  unite: UniteObjectif;
  atteint: boolean;
  /** Versets distincts déjà lus au moins une fois, sur 6236. */
  versetsParcourus: number;
  partMoushaf: number;
};

/** Ce qu'une séance vaut dans l'unité choisie. */
async function totalDuJour(unite: UniteObjectif, date: string): Promise<number> {
  if (unite === "minutes") {
    const [ligne] = await db
      .select({ total: sql<number>`coalesce(sum(${seancesLecture.secondes}), 0)` })
      .from(seancesLecture)
      .where(eq(seancesLecture.date, date));
    return Math.floor(Number(ligne?.total ?? 0) / 60);
  }

  if (unite === "pages") {
    const [ligne] = await db
      .select({
        total: sql<number>`(
          select count(distinct v.page) from ${versets} v
          join ${seancesLecture} s on v.numero between s.debut and s.fin
          where s.date = ${date})`,
      })
      .from(seancesLecture)
      .limit(1);
    return Number(ligne?.total ?? 0);
  }

  const [ligne] = await db
    .select({ total: sql<number>`coalesce(sum(${seancesLecture.versets}), 0)` })
    .from(seancesLecture)
    .where(eq(seancesLecture.date, date));
  return Number(ligne?.total ?? 0);
}

export async function progression(date = aujourdhui()): Promise<Progression> {
  const reglages = await chargerReglagesCoran();
  const [total, parcourus] = await Promise.all([
    totalDuJour(reglages.uniteObjectif, date),
    db
      .select({
        combien: sql<number>`(
          select count(distinct v.numero) from ${versets} v
          join ${seancesLecture} s on v.numero between s.debut and s.fin)`,
      })
      .from(seancesLecture)
      .limit(1),
  ]);

  const versetsParcourus = Number(parcourus[0]?.combien ?? 0);

  return {
    aujourdhui: total,
    objectif: reglages.objectifQuotidien,
    unite: reglages.uniteObjectif,
    atteint: total >= reglages.objectifQuotidien,
    versetsParcourus,
    partMoushaf: Math.round((1000 * versetsParcourus) / TOTAL_VERSETS) / 10,
  };
}

/** Jours de lecture, pour le calendrier — même forme que celui des cartes. */
export async function joursDeLecture(): Promise<{ date: string; combien: number }[]> {
  const lignes = await db
    .select({
      jour: seancesLecture.date,
      combien: sql<number>`coalesce(sum(${seancesLecture.versets}), 0)`,
    })
    .from(seancesLecture)
    .groupBy(seancesLecture.date)
    .orderBy(asc(seancesLecture.date));

  return lignes.map((l) => ({ date: l.jour, combien: Number(l.combien) }));
}

/**
 * Enregistre une séance de lecture.
 *
 * Quand l'objectif du jour est atteint, la quête de l'arc « Le Coran » est
 * validée et le pilier deen crédité — une fois par jour, jamais deux. Rien
 * n'est retiré, jamais, les jours où l'objectif n'est pas atteint : le suivi
 * compte ce qui a eu lieu, il ne sanctionne pas ce qui n'a pas eu lieu.
 */
export async function enregistrerSeance(entree: {
  debut: number;
  fin: number;
  secondes: number;
}): Promise<{ atteint: boolean }> {
  const date = aujourdhui();
  const debut = Math.max(1, Math.min(TOTAL_VERSETS, Math.round(entree.debut)));
  const fin = Math.max(debut, Math.min(TOTAL_VERSETS, Math.round(entree.fin)));

  await db.insert(seancesLecture).values({
    date,
    debut,
    fin,
    versets: fin - debut + 1,
    secondes: Math.max(0, Math.min(entree.secondes, 12 * 3600)),
  });

  await enregistrerPosition(fin);

  const etat = await progression(date);
  if (etat.atteint) await honorerObjectif();
  return { atteint: etat.atteint };
}

/** Valide la quête de l'arc « Le Coran » et nourrit le pilier deen. */
async function honorerObjectif(): Promise<void> {
  const [quete] = await db
    .select({ id: quetes.id })
    .from(quetes)
    .innerJoin(arcs, eq(quetes.arcId, arcs.id))
    .where(and(eq(arcs.nom, "Le Coran"), eq(quetes.actif, true)))
    .orderBy(asc(quetes.id))
    .limit(1);

  if (quete) {
    await validerQuete(quete.id);
    return;
  }

  // Sans arc « Le Coran », la lecture nourrit quand même le pilier.
  await crediterPilier("deen", 4, "coran");
}

/* ──────────────────────────── Hifz ──────────────────────────── */

export type ProgresSourate = {
  numero: number;
  nom: string;
  versets: number;
  memorisees: number;
  consolidees: number;
  part: number;
};

/**
 * Ce que la mémorisation a déjà couvert.
 *
 * Une carte du module cartes porte, dans ses étiquettes, le repère du verset
 * qu'elle interroge. C'est ce repère qui permet de compter sans dupliquer
 * quoi que ce soit : le module Coran ne tient aucun état de mémorisation.
 */
export async function progresHifz(): Promise<ProgresSourate[]> {
  const lignes = await db.execute(sql`
    select
      s.numero,
      s.nom_translittere as nom,
      s.versets,
      count(distinct t.verset) as memorisees,
      count(distinct t.verset) filter (where t.mure) as consolidees
    from ${sourates} s
    left join (
      select
        split_part(substring(tag from 7), ':', 1)::int as sourate,
        substring(tag from 7) as verset,
        c.etat = 'mure' as mure
      from cartes c, unnest(c.tags) as tag
      where tag like 'coran:%'
    ) t on t.sourate = s.numero
    group by s.numero, s.nom_translittere, s.versets
    having count(distinct t.verset) > 0
    order by s.numero
  `);

  const brutes = ((lignes as unknown as { rows?: unknown[] }).rows ??
    lignes) as unknown as {
    numero: number;
    nom: string;
    versets: number;
    memorisees: number;
    consolidees: number;
  }[];

  return brutes.map((l) => ({
    numero: Number(l.numero),
    nom: l.nom,
    versets: Number(l.versets),
    memorisees: Number(l.memorisees),
    consolidees: Number(l.consolidees),
    part: Math.round((100 * Number(l.memorisees)) / Math.max(1, Number(l.versets))),
  }));
}

export async function versetsDejaMemorises(sourate: number): Promise<number[]> {
  const lignes = await db.execute(sql`
    select distinct split_part(substring(tag from 7), ':', 2)::int as verset
    from cartes c, unnest(c.tags) as tag
    where tag like ${`coran:${sourate}:%`}
  `);
  const brutes = ((lignes as unknown as { rows?: unknown[] }).rows ??
    lignes) as unknown as { verset: number }[];
  return brutes.map((l) => Number(l.verset));
}

export async function compterVersets(): Promise<number> {
  const [ligne] = await db.select({ combien: count() }).from(versets);
  return ligne?.combien ?? 0;
}
