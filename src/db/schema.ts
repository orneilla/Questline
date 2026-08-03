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

/**
 * Trace d'un message Telegram déjà envoyé. La clé (date, type) rend l'envoi
 * idempotent : un cron qui se déclenche deux fois n'écrit qu'une fois.
 */
export const messagesEnvoyes = pgTable(
  "messages_envoyes",
  {
    date: date("date").notNull(),
    type: text("type").notNull(),
    envoyeLe: text("envoye_le").notNull(),
    /** Identifiant Telegram, pour pouvoir retirer les boutons ensuite. */
    messageId: integer("message_id"),
  },
  (table) => [
    uniqueIndex("messages_envoyes_date_type_uniq").on(table.date, table.type),
  ],
);

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

/* ═══════════════════════ Module cartes ═══════════════════════ */

/** Version du schéma des cartes, pour les migrations futures. */
export const VERSION_SCHEMA_CARTES = 1;

/** Nouvelle, en apprentissage, jeune, mûre. */
export const etatCarteEnum = pgEnum("etat_carte", [
  "nouvelle",
  "apprentissage",
  "jeune",
  "mure",
]);

export const typeCarteEnum = pgEnum("type_carte", [
  "recto_verso",
  "inversee",
  "trous",
]);

/** Un domaine d'étude : chimie, arabe, sciences religieuses… */
export const espaces = pgTable("espaces", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  couleur: text("couleur").notNull().default("#7e92b8"),
  ordre: integer("ordre").notNull().default(0),
});

/** Un paquet, éventuellement imbriqué dans un autre. */
export const paquets = pgTable(
  "paquets",
  {
    id: serial("id").primaryKey(),
    espaceId: integer("espace_id")
      .notNull()
      .references(() => espaces.id, { onDelete: "cascade" }),
    parentId: integer("parent_id"),
    nom: text("nom").notNull(),
    ordre: integer("ordre").notNull().default(0),
    objectifCartes: integer("objectif_cartes").notNull().default(0),
    /** Couverture compressée, en data URI. */
    couverture: text("couverture"),
  },
  (table) => [
    index("paquets_espace_id_idx").on(table.espaceId),
    index("paquets_parent_id_idx").on(table.parentId),
  ],
);

/**
 * Une carte présentée à la révision.
 *
 * Une carte à trous ou inversée engendre plusieurs lignes — une par face
 * réellement interrogée — reliées par `sourceCle` : c'est ce qui permet de les
 * régénérer ensemble quand la note d'origine change.
 */
export const cartes = pgTable(
  "cartes",
  {
    id: serial("id").primaryKey(),
    paquetId: integer("paquet_id")
      .notNull()
      .references(() => paquets.id, { onDelete: "cascade" }),
    recto: text("recto").notNull(),
    verso: text("verso").notNull(),
    type: typeCarteEnum("type").notNull().default("recto_verso"),
    notes: text("notes").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    etat: etatCarteEnum("etat").notNull().default("nouvelle"),
    /** Prochaine échéance. Nulle pour une carte jamais vue. */
    prochaineDate: date("prochaine_date"),
    /** Mémoire FSRS, reportée depuis la dernière révision. */
    stabilite: real("stabilite").notNull().default(0),
    difficulte: real("difficulte").notNull().default(0),
    /** Nombre de fois où la carte est retombée à « Encore ». */
    rechutes: integer("rechutes").notNull().default(0),
    suspendue: boolean("suspendue").notNull().default(false),
    /** Regroupe les cartes engendrées par une même note. */
    sourceCle: text("source_cle"),
    /**
     * La note d'origine, telle qu'elle a été saisie. La garder permet de
     * rouvrir la note dans l'éditeur — et non sa forme rendue — puis de
     * réengendrer le groupe sans perdre la mémoire FSRS des cartes qui
     * subsistent. Nulle pour les cartes écrites avant l'éditeur.
     */
    sourceRecto: text("source_recto"),
    sourceVerso: text("source_verso"),
    /** Repère de la carte dans son groupe : numéro de trou, ou sens d'une inversée. */
    sourceIndex: integer("source_index").notNull().default(0),
    creeLe: date("cree_le").notNull(),
    modifieLe: date("modifie_le").notNull(),
  },
  (table) => [
    index("cartes_paquet_id_idx").on(table.paquetId),
    index("cartes_etat_idx").on(table.etat),
    // L'index qui porte la sélection des cartes dues, appelée à chaque session.
    index("cartes_prochaine_date_idx").on(table.prochaineDate),
    index("cartes_du_jour_idx").on(table.paquetId, table.suspendue, table.prochaineDate),
    index("cartes_source_cle_idx").on(table.sourceCle),
  ],
);

/**
 * Les images collées dans les cartes.
 *
 * Elles vivent à part plutôt qu'en data URI dans le texte : une même figure
 * sert souvent plusieurs cartes d'un même groupe, le texte des cartes reste
 * léger à charger pour une session, et la place occupée devient mesurable —
 * ce qui compte quand la base est un Neon gratuit.
 */
export const medias = pgTable("medias", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull().default(""),
  typeMime: text("type_mime").notNull(),
  /** Poids après compression, en octets. */
  octets: integer("octets").notNull().default(0),
  largeur: integer("largeur").notNull().default(0),
  hauteur: integer("hauteur").notNull().default(0),
  /** Contenu encodé en base64 : le pilote HTTP ne transporte pas d'octets bruts. */
  donnees: text("donnees").notNull(),
  creeLe: date("cree_le").notNull(),
});

/**
 * Historique des révisions. On ajoute, on n'écrase jamais : c'est la seule
 * trace qui permettra de réoptimiser les paramètres FSRS dans dix ans.
 */
export const revisions = pgTable(
  "revisions",
  {
    id: serial("id").primaryKey(),
    carteId: integer("carte_id")
      .notNull()
      .references(() => cartes.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    /** Horodatage précis : FSRS raisonne en durées, pas en jours. */
    vueLe: text("vue_le").notNull(),
    note: integer("note").notNull(),
    stabilite: real("stabilite").notNull(),
    difficulte: real("difficulte").notNull(),
    prochaineDate: date("prochaine_date").notNull(),
    /** Intervalle accordé, en jours. */
    intervalle: real("intervalle").notNull(),
    etat: etatCarteEnum("etat").notNull(),
    /** Millisecondes passées sur la carte. */
    duree: integer("duree").notNull().default(0),
  },
  (table) => [
    index("revisions_carte_id_idx").on(table.carteId),
    index("revisions_date_idx").on(table.date),
    index("revisions_prochaine_date_idx").on(table.prochaineDate),
  ],
);

/** Une session de révision achevée. */
export const sessionsRevision = pgTable(
  "sessions_revision",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    paquetId: integer("paquet_id").references(() => paquets.id, {
      onDelete: "set null",
    }),
    cartesVues: integer("cartes_vues").notNull().default(0),
    /** Durée en secondes. */
    duree: integer("duree").notNull().default(0),
  },
  (table) => [index("sessions_revision_date_idx").on(table.date)],
);

/** Réglages du module, une seule ligne. */
export const reglagesCartes = pgTable("reglages_cartes", {
  id: integer("id").primaryKey().default(1),
  versionSchema: integer("version_schema").notNull().default(VERSION_SCHEMA_CARTES),
  /** Minutes avant réapparition dans la session, par notation. */
  delaiEncoreMin: real("delai_encore_min").notNull().default(1),
  delaiDifficileMin: real("delai_difficile_min").notNull().default(6),
  /** Rétention visée par FSRS. */
  retentionCible: real("retention_cible").notNull().default(0.9),
  /** Poids FSRS ; vide = paramètres par défaut du paquet ts-fsrs. */
  poidsFsrs: real("poids_fsrs").array().notNull().default([]),
  nouvellesParJour: integer("nouvelles_par_jour").notNull().default(20),
  maximumParJour: integer("maximum_par_jour").notNull().default(200),
});

export type Espace = typeof espaces.$inferSelect;
export type Paquet = typeof paquets.$inferSelect;
export type Carte = typeof cartes.$inferSelect;
export type Media = typeof medias.$inferSelect;
export type Revision = typeof revisions.$inferSelect;
export type SessionRevision = typeof sessionsRevision.$inferSelect;
export type ReglagesCartes = typeof reglagesCartes.$inferSelect;
export type EtatCarte = (typeof etatCarteEnum.enumValues)[number];
export type TypeCarte = (typeof typeCarteEnum.enumValues)[number];

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
export type MessageEnvoye = typeof messagesEnvoyes.$inferSelect;
export type Pilier = (typeof pilierEnum.enumValues)[number];
export type TypeJour = (typeof typeJourEnum.enumValues)[number];
