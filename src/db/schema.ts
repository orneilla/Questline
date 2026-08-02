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

/** Nature d'un créneau bloqué dans la semaine. */
export const typeCreneauEnum = pgEnum("type_creneau", [
  "shift",
  "cours",
  "priere",
]);

/** Charge de la journée, déduite des créneaux et du jour de la semaine. */
export const typeJourEnum = pgEnum("type_jour", ["libre", "reduit", "shift"]);

/** Un arc = un chantier de vie long, rattaché à un pilier. */
export const arcs = pgTable("arcs", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  pilier: pilierEnum("pilier").notNull(),
  vision: text("vision").notNull().default(""),
  progression: integer("progression").notNull().default(0),
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
  },
  (table) => [index("quetes_arc_id_idx").on(table.arcId)],
);

/** Les blocs récurrents de la semaine (travail, cours, prières). */
export const creneaux = pgTable(
  "creneaux",
  {
    id: serial("id").primaryKey(),
    type: typeCreneauEnum("type").notNull(),
    /** 0 = dimanche … 6 = samedi. */
    jourSemaine: integer("jour_semaine").notNull(),
    debut: time("debut").notNull(),
    /** Une fin antérieure au début signifie que le créneau passe minuit. */
    fin: time("fin").notNull(),
  },
  (table) => [index("creneaux_jour_semaine_idx").on(table.jourSemaine)],
);

/** Une ligne par journée vécue. */
export const journees = pgTable("journees", {
  date: date("date").primaryKey(),
  typeJour: typeJourEnum("type_jour").notNull().default("libre"),
  modeBas: boolean("mode_bas").notNull().default(false),
  phrase: text("phrase").notNull().default(""),
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
export type Creneau = typeof creneaux.$inferSelect;
export type Journee = typeof journees.$inferSelect;
export type Validation = typeof validations.$inferSelect;
export type Momentum = typeof momentum.$inferSelect;
export type Pilier = (typeof pilierEnum.enumValues)[number];
export type TypeJour = (typeof typeJourEnum.enumValues)[number];
