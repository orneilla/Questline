import "server-only";

import { desc, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  arcs,
  cartes,
  etapesArc,
  evenements,
  journees,
  momentum,
  positionLecture,
  positionsSourate,
  quetes,
  quetesRaresFaites,
  revisions,
  saisons,
  sauvegardes,
  seancesLecture,
  seuilsArcs,
  taches,
  validations,
  creneauxRecurrents,
  espaces,
  marquePages,
  paquets,
  reglagesCartes,
  reglagesCoran,
  sessionsRevision,
} from "@/db/schema";
import {
  NOMS_TABLES,
  VERSION,
  type ContenuSauvegarde,
  type FicheSauvegarde,
  type NomTable,
  type ResumeSauvegarde,
} from "./sauvegardes-partage";

/**
 * Sauvegarde complète, en JSON.
 *
 * ── Ce qui est dedans, et ce qui n'y est pas
 *
 * Tout ce qui est *à toi* : cartes et leur historique de révision, quêtes,
 * arcs et leurs étapes, momentum, tâches, emploi du temps, progression de
 * lecture du Coran, vocabulaire, réglages.
 *
 * Pas le texte coranique, pas les analyses morphologiques, pas les gloses, pas
 * les images. Ce sont des dizaines de mégaoctets qui se réinstallent d'une
 * adresse, et les embarquer rendrait la sauvegarde trop lourde pour être
 * produite dans une fonction serverless — donc trop lourde pour exister. Une
 * sauvegarde de vingt mégaoctets qu'on ne peut pas écrire ne protège rien.
 *
 * ── Pourquoi elle est stockée en base
 *
 * Parce qu'il n'y a nulle part ailleurs où la mettre : pas de disque persistant
 * sur Vercel, et pas d'ordinateur pour la récupérer à la main. Les huit
 * dernières sont conservées, les plus anciennes purgées — sans quoi le poids
 * grimperait sans fin sur un palier de 512 Mo.
 */

/** Nombre de sauvegardes conservées. Au-delà, les plus anciennes partent. */
export const CONSERVEES = 8;

/** Jours entre deux sauvegardes automatiques. */
const PERIODE_JOURS = 7;

/**
 * Les tables sauvegardées, dans l'ordre où il faudra les réécrire : une table
 * qui en référence une autre vient après elle.
 */
const TABLES = {
  espaces,
  paquets,
  cartes,
  revisions,
  sessionsRevision,
  arcs,
  etapesArc,
  quetes,
  validations,
  seuilsArcs,
  taches,
  journees,
  quetesRaresFaites,
  momentum,
  saisons,
  creneauxRecurrents,
  evenements,
  positionLecture,
  positionsSourate,
  seancesLecture,
  marquePages,
  reglagesCartes,
  reglagesCoran,
} as const;

/* ───────────────────────────── Production ───────────────────────────── */

export async function produireSauvegarde(): Promise<{
  contenu: ContenuSauvegarde;
  resume: ResumeSauvegarde;
}> {
  const tables: Partial<Record<NomTable, unknown[]>> = {};
  const resume: ResumeSauvegarde = {};

  for (const [nom, table] of Object.entries(TABLES) as [NomTable, never][]) {
    const lignes = await db.select().from(table);
    tables[nom] = lignes;
    resume[nom] = lignes.length;
  }

  return {
    contenu: { version: VERSION, creeeLe: new Date().toISOString(), tables },
    resume,
  };
}

/** Écrit une sauvegarde et purge celles qui dépassent le nombre conservé. */
export async function enregistrerSauvegarde(): Promise<FicheSauvegarde> {
  const { contenu, resume } = await produireSauvegarde();
  const json = JSON.stringify(contenu);

  const [creee] = await db
    .insert(sauvegardes)
    .values({
      creeeLe: contenu.creeeLe,
      octets: Buffer.byteLength(json, "utf8"),
      resume: JSON.stringify(resume),
      contenu: json,
    })
    .returning({
      id: sauvegardes.id,
      creeeLe: sauvegardes.creeeLe,
      octets: sauvegardes.octets,
    });

  await purger();

  return { id: creee.id, creeeLe: creee.creeeLe, octets: creee.octets, resume };
}

/**
 * Retire les sauvegardes au-delà des huit dernières.
 *
 * La sélection des survivantes se fait d'abord, la suppression ensuite : une
 * requête qui supprimerait « tout sauf les huit premières » d'un coup dépend de
 * l'ordre d'évaluation, ce qu'il vaut mieux ne pas supposer.
 */
async function purger(): Promise<number> {
  const gardees = await db
    .select({ id: sauvegardes.id })
    .from(sauvegardes)
    .orderBy(desc(sauvegardes.creeeLe), desc(sauvegardes.id))
    .limit(CONSERVEES);

  if (gardees.length < CONSERVEES) return 0;

  const retirees = await db
    .delete(sauvegardes)
    .where(
      sql`${sauvegardes.id} not in (${sql.join(
        gardees.map((g) => sql`${g.id}`),
        sql`, `,
      )})`,
    )
    .returning({ id: sauvegardes.id });

  return retirees.length;
}

/** Produit une sauvegarde si la dernière remonte à plus d'une semaine. */
export async function sauvegardeHebdomadaire(): Promise<{
  creee: boolean;
  raison: string;
}> {
  const [derniere] = await db
    .select({ creeeLe: sauvegardes.creeeLe })
    .from(sauvegardes)
    .orderBy(desc(sauvegardes.creeeLe))
    .limit(1);

  if (derniere) {
    const age = Date.now() - Date.parse(derniere.creeeLe);
    if (age < PERIODE_JOURS * 86_400_000) {
      return { creee: false, raison: "la dernière a moins d'une semaine" };
    }
  }

  const fiche = await enregistrerSauvegarde();
  return { creee: true, raison: `${fiche.octets} octets` };
}

/* ───────────────────────────── Lecture ───────────────────────────── */

export async function listerSauvegardes(): Promise<FicheSauvegarde[]> {
  const lignes = await db
    .select({
      id: sauvegardes.id,
      creeeLe: sauvegardes.creeeLe,
      octets: sauvegardes.octets,
      resume: sauvegardes.resume,
    })
    .from(sauvegardes)
    .orderBy(desc(sauvegardes.creeeLe), desc(sauvegardes.id));

  return lignes.map((l) => ({
    id: l.id,
    creeeLe: l.creeeLe,
    octets: l.octets,
    resume: lireResume(l.resume),
  }));
}

function lireResume(brut: string): ResumeSauvegarde {
  try {
    const lu: unknown = JSON.parse(brut);
    return typeof lu === "object" && lu !== null ? (lu as ResumeSauvegarde) : {};
  } catch {
    return {};
  }
}

export async function contenuSauvegarde(id: number): Promise<string | null> {
  const [ligne] = await db
    .select({ contenu: sauvegardes.contenu })
    .from(sauvegardes)
    .where(sql`${sauvegardes.id} = ${id}`)
    .limit(1);
  return ligne?.contenu ?? null;
}

/* ───────────────────────────── Restauration ───────────────────────────── */

/** Ce que la base contient aujourd'hui, table par table. */
export async function etatActuel(): Promise<ResumeSauvegarde> {
  const etat: ResumeSauvegarde = {};
  for (const nom of Object.keys(TABLES) as NomTable[]) {
    const resultat = await db.execute(
      sql.raw(`select count(*)::int as combien from ${nomSql(nom)}`),
    );
    const lignes =
      (resultat as unknown as { rows?: { combien: unknown }[] }).rows ??
      (resultat as unknown as { combien: unknown }[]);
    const premiere = Array.isArray(lignes) ? lignes[0] : undefined;
    etat[nom] = Number(premiere?.combien ?? 0);
  }
  return etat;
}

export type BilanRestauration = {
  ecrites: Partial<Record<NomTable, number>>;
  ignorees: string[];
};

/**
 * Vide les tables qui vont être réécrites.
 *
 * **Ce que cela fait exactement** : chaque table listée est vidée. Une table
 * absente de la liste n'est pas touchée. Rien n'est fusionné — une restauration
 * qui fusionnerait laisserait des lignes d'avant mêlées à celles d'après, et on
 * ne saurait plus dans quel état on est.
 *
 * La suppression suit l'ordre inverse de `NOMS_TABLES` : les enfants avant les
 * parents, pour ne jamais violer une clé étrangère.
 */
export async function viderPourRestauration(noms: NomTable[]): Promise<void> {
  const ordonnees = NOMS_TABLES.filter((nom) => noms.includes(nom));
  for (const nom of [...ordonnees].reverse()) {
    await db.delete(TABLES[nom] as never);
  }
}

/**
 * Écrit un lot de lignes dans une table.
 *
 * Les lots arrivent par requêtes séparées : le fichier pèse plusieurs
 * mégaoctets, ce qui dépasse aussi bien la limite d'une action serveur que
 * celle d'une requête serverless. Le découpage se fait dans le navigateur, qui
 * est le seul endroit où le fichier tient en entier.
 */
export async function ecrireLotRestauration(
  nom: NomTable,
  lignes: Record<string, unknown>[],
): Promise<number> {
  if (lignes.length === 0) return 0;

  for (let debut = 0; debut < lignes.length; debut += 200) {
    await db
      .insert(TABLES[nom] as never)
      .values(lignes.slice(debut, debut + 200) as never)
      .onConflictDoNothing();
  }
  return lignes.length;
}

/**
 * Remet les séquences au-delà du plus grand identifiant réécrit.
 *
 * Sans cela, la première insertion suivante entrerait en collision avec une
 * ligne restaurée : la séquence, elle, n'a pas été restaurée.
 */
export async function resynchroniserSequences(noms: NomTable[]): Promise<void> {
  for (const nom of noms) await resynchroniserSequence(nom);
}

/** Remet la séquence d'une table au-delà de son plus grand identifiant. */
async function resynchroniserSequence(nom: NomTable): Promise<void> {
  const table = TABLES[nom] as unknown as { id?: unknown };
  if (!("id" in table)) return;

  const sqlNom = nomSql(nom);
  try {
    await db.execute(
      sql.raw(
        `select setval(pg_get_serial_sequence('${sqlNom}', 'id'),
           coalesce((select max(id) from ${sqlNom}), 0) + 1, false)`,
      ),
    );
  } catch {
    // Une table sans séquence (clé non serial) n'a rien à resynchroniser.
  }
}

/** Le nom Postgres d'une table, déduit de son nom TypeScript. */
function nomSql(nom: NomTable): string {
  return nom.replace(/[A-Z]/g, (lettre) => `_${lettre.toLowerCase()}`);
}

export {
  analyserSauvegarde,
  estNomTable,
  NOMS_TABLES,
  SauvegardeIllisible,
  VERSION,
  type ContenuSauvegarde,
  type FicheSauvegarde,
  type NomTable,
  type ResumeSauvegarde,
} from "./sauvegardes-partage";
