import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  time,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Les 6 piliers de la progression. */
export const pilierEnum = pgEnum("pilier", [
  "deen",
  "corps",
  "table",
  "savoir",
  "oeuvre",
  "seve",
]);

/** Nature d'un bloc d'emploi du temps, récurrent comme ponctuel. */
export const categorieCreneauEnum = pgEnum("categorie_creneau", [
  "cours",
  "travail",
  "priere",
  "autre",
]);

/** Charge de la journée, déduite du temps disponible. */
export const typeJourEnum = pgEnum("type_jour", ["libre", "chargee", "pleine"]);

/** Un arc = un chantier de vie long, rattaché à un pilier. */
export const arcs = pgTable("arcs", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  pilier: pilierEnum("pilier").notNull(),
  vision: text("vision").notNull().default(""),
  /** La progression n'est pas stockée : elle se calcule sur les validations. */
  actif: boolean("actif").notNull().default(true),
});

/** Une quête = un geste concret qui fait avancer un arc. */
export const quetes = pgTable(
  "quetes",
  {
    id: serial("id").primaryKey(),
    arcId: integer("arc_id")
      .notNull()
      .references(() => arcs.id, { onDelete: "cascade" }),
    titre: text("titre").notNull(),
    poids: integer("poids").notNull().default(3),
    /** Durée en minutes. 0 = quête d'ambiance, sans créneau dédié. */
    dureeMin: integer("duree_min").notNull().default(20),
    /** Nombre de fois par semaine où la quête doit revenir (1 à 7). */
    frequenceSem: integer("frequence_sem").notNull().default(7),
    /** Jours de la semaine où la quête ne doit jamais sortir (0 = dimanche). */
    joursExclus: integer("jours_exclus").array().notNull().default([]),
    /** Éligible en mode « jour bas » : la version minimale du geste. */
    minimale: boolean("minimale").notNull().default(false),
    /** Une quête désactivée reste en base, avec son histoire, mais ne sort plus. */
    actif: boolean("actif").notNull().default(true),
  },
  (table) => [index("quetes_arc_id_idx").on(table.arcId)],
);

/** Les blocs récurrents de la semaine (travail, cours, prières). */
export const creneauxRecurrents = pgTable(
  "creneaux_recurrents",
  {
    id: serial("id").primaryKey(),
    titre: text("titre").notNull(),
    type: categorieCreneauEnum("type").notNull().default("autre"),
    /** 0 = dimanche … 6 = samedi. */
    jourSemaine: integer("jour_semaine").notNull(),
    debut: time("debut").notNull(),
    /** Une fin antérieure au début signifie que le créneau passe minuit. */
    fin: time("fin").notNull(),
    /** Bornes de validité. Nulles = toujours actif. */
    actifDepuis: date("actif_depuis"),
    actifJusqua: date("actif_jusqua"),
  },
  (table) => [index("creneaux_recurrents_jour_semaine_idx").on(table.jourSemaine)],
);

/**
 * Un bloc ponctuel posé sur une date. Il écrase le récurrent qu'il recouvre :
 * un remplacement le remplace, une annulation (début = fin) le retire sans
 * rien occuper.
 */
export const evenements = pgTable(
  "evenements",
  {
    id: serial("id").primaryKey(),
    titre: text("titre").notNull(),
    type: categorieCreneauEnum("type").notNull().default("autre"),
    date: date("date").notNull(),
    debut: time("debut").notNull(),
    fin: time("fin").notNull(),
    note: text("note").notNull().default(""),
  },
  (table) => [index("evenements_date_idx").on(table.date)],
);

/** Une ligne par journée vécue. */
export const journees = pgTable("journees", {
  date: date("date").primaryKey(),
  typeJour: typeJourEnum("type_jour").notNull().default("libre"),
  modeBas: boolean("mode_bas").notNull().default(false),
  phrase: text("phrase").notNull().default(""),
  /** Titre du jour, figé une fois choisi — il ne doit pas changer en cours de journée. */
  titre: text("titre").notNull().default(""),
});

/**
 * Une quête rare accomplie. Elle ne vient d'aucun arc : elle nourrit le
 * momentum de son pilier et rien d'autre. Une par jour au plus.
 */
export const quetesRaresFaites = pgTable("quetes_rares_faites", {
  date: date("date").primaryKey(),
  cle: text("cle").notNull(),
  texte: text("texte").notNull(),
  pilier: pilierEnum("pilier").notNull(),
  poids: integer("poids").notNull(),
});

/** Seuil de progression franchi par un arc. Ne se franchit qu'une fois. */
export const seuilsArcs = pgTable(
  "seuils_arcs",
  {
    id: serial("id").primaryKey(),
    arcId: integer("arc_id")
      .notNull()
      .references(() => arcs.id, { onDelete: "cascade" }),
    seuil: integer("seuil").notNull(),
    atteintLe: date("atteint_le").notNull(),
    /** L'écran plein ne s'affiche qu'une fois. */
    vu: boolean("vu").notNull().default(false),
  },
  (table) => [uniqueIndex("seuils_arcs_arc_seuil_uniq").on(table.arcId, table.seuil)],
);

/** Un cycle de quatre semaines, clos par une question ouverte. */
export const saisons = pgTable("saisons", {
  numero: integer("numero").primaryKey(),
  debut: date("debut").notNull(),
  fin: date("fin").notNull(),
  question: text("question").notNull().default(""),
  reponse: text("reponse").notNull().default(""),
  clotureeLe: date("cloturee_le"),
});

/** Trace d'une quête accomplie. */
export const validations = pgTable(
  "validations",
  {
    id: serial("id").primaryKey(),
    queteId: integer("quete_id")
      .notNull()
      .references(() => quetes.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    /** Vraie quand la validation relance un pilier resté silencieux. */
    bonusReprise: boolean("bonus_reprise").notNull().default(false),
  },
  (table) => [
    index("validations_date_idx").on(table.date),
    // Une quête ne peut être validée qu'une fois par jour, même en cas de
    // double appui sur le bouton.
    uniqueIndex("validations_quete_date_uniq").on(table.queteId, table.date),
  ],
);

/** L'élan courant de chaque pilier. Une ligne par pilier, jamais remise à zéro. */
export const momentum = pgTable("momentum", {
  pilier: pilierEnum("pilier").primaryKey(),
  valeur: real("valeur").notNull().default(0),
  /** Dernier jour où la décroissance a été appliquée. */
  majLe: date("maj_le").notNull(),
});

export type Arc = typeof arcs.$inferSelect;
export type Quete = typeof quetes.$inferSelect;
export type CreneauRecurrent = typeof creneauxRecurrents.$inferSelect;
export type Evenement = typeof evenements.$inferSelect;
export type CategorieCreneau = (typeof categorieCreneauEnum.enumValues)[number];
export type Journee = typeof journees.$inferSelect;
export type Validation = typeof validations.$inferSelect;
export type Momentum = typeof momentum.$inferSelect;
export type QueteRareFaite = typeof quetesRaresFaites.$inferSelect;
export type SeuilArc = typeof seuilsArcs.$inferSelect;
export type Saison = typeof saisons.$inferSelect;
export type Pilier = (typeof pilierEnum.enumValues)[number];
export type TypeJour = (typeof typeJourEnum.enumValues)[number];
