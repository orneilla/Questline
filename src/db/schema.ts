import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
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

/**
 * Comment la récitation s'enchaîne.
 *
 * Trois usages distincts, et non trois variantes d'un même : on lit, on
 * mémorise un verset, on enchaîne un passage.
 */
export const modeEcouteEnum = pgEnum("mode_ecoute", [
  "enchainement",
  "verset_boucle",
  "passage_boucle",
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
  /**
   * Date à laquelle l'arc a été déclaré accompli. Un arc accompli quitte la
   * liste courante pour la page des arcs accomplis, sans rien perdre : ses
   * quêtes, ses validations et ses seuils restent en base.
   */
  accompliLe: date("accompli_le"),
  /** Ordre d'affichage, modifiable. À égalité, l'identifiant tranche. */
  ordre: integer("ordre").notNull().default(0),
});

/**
 * Une étape d'arc.
 *
 * C'est ce qui distingue un arc d'une liste de tâches : il a un chemin, et le
 * chemin est écrit à l'avance. Une étape n'est pas une quête — elle ne se
 * planifie pas, ne consomme pas de budget-temps et ne nourrit aucun momentum.
 * Elle se franchit, et sa date de franchissement reste.
 */
export const etapesArc = pgTable(
  "etapes_arc",
  {
    id: serial("id").primaryKey(),
    arcId: integer("arc_id")
      .notNull()
      .references(() => arcs.id, { onDelete: "cascade" }),
    titre: text("titre").notNull(),
    detail: text("detail").notNull().default(""),
    ordre: integer("ordre").notNull().default(0),
    atteinteLe: date("atteinte_le"),
  },
  (table) => [index("etapes_arc_arc_id_idx").on(table.arcId)],
);

/**
 * Une tâche libre.
 *
 * Ce qui tombe sans prévenir et n'a pas d'arc : un papier à envoyer, un appel à
 * passer. C'est une liste, pas un système — pas de priorité, pas d'étiquette,
 * pas d'échéance. Ce qui n'est pas fait reste simplement ouvert : il n'existe
 * nulle part de notion de retard, donc rien ne peut être signalé comme tel.
 *
 * Le rattachement à un pilier est facultatif. Rattachée, la tâche crédite son
 * pilier une fois cochée ; libre, elle ne compte nulle part et c'est très bien.
 */
export const taches = pgTable(
  "taches",
  {
    id: serial("id").primaryKey(),
    texte: text("texte").notNull(),
    pilier: pilierEnum("pilier"),
    creeeLe: date("creee_le").notNull(),
    /** Nulle tant que la tâche est ouverte. */
    faiteLe: date("faite_le"),
    ordre: integer("ordre").notNull().default(0),
  },
  (table) => [index("taches_faite_le_idx").on(table.faiteLe)],
);

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

/**
 * Un appareil abonné aux notifications de Questline.
 *
 * Le navigateur produit un point de terminaison propre à l'appareil et deux
 * clés de chiffrement ; le serveur ne peut rien envoyer sans elles. Il peut y
 * avoir plusieurs lignes — la tablette et le téléphone sont deux abonnements
 * distincts, et un même appareil réinstallé en produit un nouveau.
 *
 * Une ligne dont le point de terminaison a expiré est retirée automatiquement :
 * c'est le service de push lui-même qui le dit, par un 404 ou un 410.
 */
export const abonnementsPush = pgTable(
  "abonnements_push",
  {
    id: serial("id").primaryKey(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** De quel appareil il s'agit, pour pouvoir s'y reconnaître dans la liste. */
    agent: text("agent").notNull().default(""),
    creeLe: text("cree_le").notNull(),
    dernierEnvoi: text("dernier_envoi"),
    derniereErreur: text("derniere_erreur"),
  },
  (table) => [uniqueIndex("abonnements_push_endpoint_uniq").on(table.endpoint)],
);

/** Par quel canal les rappels arrivent. */
export const canalEnum = pgEnum("canal_notification", ["push", "telegram", "les_deux"]);

/**
 * Réglages des rappels, ligne unique.
 *
 * Les clés VAPID vivent ici plutôt que dans l'environnement : elles sont
 * engendrées au premier abonnement, depuis le navigateur, et n'ont donc jamais
 * à être recopiées à la main dans Vercel. C'est le même principe que le reste
 * de l'installation — rien qui demande un terminal.
 */
export const reglagesNotifications = pgTable("reglages_notifications", {
  id: integer("id").primaryKey().default(1),
  canal: canalEnum("canal").notNull().default("push"),
  matinActif: boolean("matin_actif").notNull().default(true),
  soirActif: boolean("soir_actif").notNull().default(true),
  /** Minutes depuis minuit, heure de référence. */
  heureMatin: integer("heure_matin").notNull().default(7 * 60 + 30),
  heureSoir: integer("heure_soir").notNull().default(21 * 60 + 30),
  vapidPublique: text("vapid_publique"),
  vapidPrivee: text("vapid_privee"),
  /** Aucun rappel jusqu'à cette date incluse. Posée par /pause. */
  pauseJusqua: date("pause_jusqua"),
  /** Première journée vécue : sert à ne proposer le push qu'après une semaine. */
  premiereOuverture: date("premiere_ouverture"),
});

/**
 * Une sauvegarde complète, en JSON.
 *
 * Elle est produite une fois par semaine par le déclencheur planifié, et les
 * huit dernières sont conservées. Le contenu est stocké tel quel : une
 * sauvegarde qu'il faudrait reconstruire pour la lire n'en serait pas une.
 */
export const sauvegardes = pgTable("sauvegardes", {
  id: serial("id").primaryKey(),
  creeeLe: text("creee_le").notNull(),
  octets: integer("octets").notNull(),
  /** Nombre de lignes par table, pour l'afficher sans relire tout le JSON. */
  resume: text("resume").notNull().default("{}"),
  contenu: text("contenu").notNull(),
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

/* ═══════════════════════ Module Coran ═══════════════════════ */

/** Lieu de révélation d'une sourate. */
export const revelationEnum = pgEnum("revelation", ["mecquoise", "medinoise"]);

/** Ce qu'une édition apporte au texte arabe. */
export const typeEditionEnum = pgEnum("type_edition_coran", [
  "traduction",
  "translitteration",
]);

/**
 * Les 114 sourates.
 *
 * Métadonnées seulement : rien de ce qui est ici n'est du texte coranique.
 */
export const sourates = pgTable("sourates", {
  numero: integer("numero").primaryKey(),
  nomArabe: text("nom_arabe").notNull(),
  nomTranslittere: text("nom_translittere").notNull(),
  /** Sens du nom tel que la source le donne. Recopié, jamais traduit ici. */
  sensDuNom: text("sens_du_nom").notNull(),
  revelation: revelationEnum("revelation").notNull(),
  versets: integer("versets").notNull(),
  /** Numéro global du premier verset de la sourate, de 1 à 6236. */
  premierVerset: integer("premier_verset").notNull(),
});

/**
 * Les 6236 versets, dans leur numérotation globale.
 *
 * `texte` porte le texte arabe tel qu'il est reçu de la source, octet pour
 * octet : aucune normalisation Unicode, aucun nettoyage, aucune correction.
 * Toute transformation ici altérerait les signes diacritiques et les marques
 * de tajwid — c'est la raison pour laquelle rien dans le code n'y touche.
 */
export const versets = pgTable(
  "versets",
  {
    numero: integer("numero").primaryKey(),
    sourate: integer("sourate")
      .notNull()
      .references(() => sourates.numero, { onDelete: "cascade" }),
    numeroDansSourate: integer("numero_dans_sourate").notNull(),
    juz: integer("juz").notNull(),
    page: integer("page").notNull(),
    hizbQuart: integer("hizb_quart").notNull(),
    sajda: boolean("sajda").notNull().default(false),
    texte: text("texte").notNull(),
  },
  (table) => [
    index("versets_sourate_idx").on(table.sourate),
    index("versets_juz_idx").on(table.juz),
    index("versets_page_idx").on(table.page),
  ],
);

/**
 * Une édition importée : traduction ou translittération.
 *
 * `licence` et `source` ne sont pas décoratifs : chaque écran qui affiche cette
 * édition les cite. Une édition dont on ne sait pas dire la licence n'entre pas.
 */
export const editionsCoran = pgTable("editions_coran", {
  cle: text("cle").primaryKey(),
  langue: text("langue").notNull(),
  nom: text("nom").notNull(),
  auteur: text("auteur").notNull(),
  type: typeEditionEnum("type").notNull(),
  source: text("source").notNull(),
  licence: text("licence").notNull(),
  /** Versets réellement importés : sert à reprendre un import interrompu. */
  versets: integer("versets").notNull().default(0),
  importeeLe: date("importee_le"),
});

/** Le texte d'un verset dans une édition donnée, verbatim lui aussi. */
export const textesVersets = pgTable(
  "textes_versets",
  {
    editionCle: text("edition_cle")
      .notNull()
      .references(() => editionsCoran.cle, { onDelete: "cascade" }),
    versetNumero: integer("verset_numero").notNull(),
    texte: text("texte").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.editionCle, table.versetNumero] }),
    index("textes_versets_verset_idx").on(table.versetNumero),
  ],
);

/** Où la lecture s'est arrêtée. Une seule ligne. */
export const positionLecture = pgTable("position_lecture", {
  id: integer("id").primaryKey().default(1),
  versetNumero: integer("verset_numero").notNull().default(1),
  modifieLe: text("modifie_le").notNull(),
});

/** Journal de lecture : une ligne par séance, de quoi nourrir le calendrier. */
export const seancesLecture = pgTable(
  "seances_lecture",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    versets: integer("versets").notNull().default(0),
    secondes: integer("secondes").notNull().default(0),
    /** Premier et dernier verset lus, pour pouvoir y revenir. */
    debut: integer("debut").notNull(),
    fin: integer("fin").notNull(),
    /**
     * Les versets réellement lus, un par un.
     *
     * L'intervalle début–fin ne suffit pas : traverser une sourate en la
     * faisant défiler n'en fait pas lire les trois cents versets. Seuls ceux
     * restés sous les yeux assez longtemps entrent ici, et c'est cette liste
     * qui compte — pour le total comme pour le décompte en pages.
     */
    numeros: integer("numeros").array().notNull().default([]),
  },
  (table) => [index("seances_lecture_date_idx").on(table.date)],
);

/** Marque-pages nommés, sans limite de nombre. */
export const marquePages = pgTable(
  "marque_pages",
  {
    id: serial("id").primaryKey(),
    versetNumero: integer("verset_numero").notNull(),
    nom: text("nom").notNull().default(""),
    creeLe: text("cree_le").notNull(),
  },
  (table) => [index("marque_pages_verset_idx").on(table.versetNumero)],
);

/** Ce que l'objectif quotidien compte. */
export const uniteObjectifEnum = pgEnum("unite_objectif", [
  "versets",
  "pages",
  "minutes",
]);

/** Réglages du module, une seule ligne. */
export const reglagesCoran = pgTable("reglages_coran", {
  id: integer("id").primaryKey().default(1),
  /** Clés d'édition ; nulles tant que rien n'est importé. */
  traduction: text("traduction"),
  translitteration: text("translitteration"),
  /** Édition audio d'alquran.cloud ; l'audio n'est jamais stocké. */
  reciteur: text("reciteur").notNull().default("ar.alafasy"),
  tailleArabe: integer("taille_arabe").notNull().default(30),
  /**
   * Trois tailles indépendantes. La translittération n'est pas une note de bas
   * de page : c'est le texte de travail de quelqu'un qui mémorise sans lire
   * l'arabe, et elle se règle donc pour elle-même.
   */
  tailleTranslitteration: integer("taille_translitteration").notNull().default(19),
  tailleTraduction: integer("taille_traduction").notNull().default(16),
  /** Arabe et translittération en grand, traduction réduite. */
  modeMemorisation: boolean("mode_memorisation").notNull().default(false),
  policeArabe: text("police_arabe").notNull().default("amiri"),
  /** Adresse d'où l'analyse mot à mot a été tirée, pour pouvoir la citer. */
  sourceMorphologie: text("source_morphologie"),
  afficherTranslitteration: boolean("afficher_translitteration").notNull().default(true),
  afficherTraduction: boolean("afficher_traduction").notNull().default(true),
  afficherArabe: boolean("afficher_arabe").notNull().default(true),
  uniteObjectif: uniteObjectifEnum("unite_objectif").notNull().default("versets"),
  objectifQuotidien: integer("objectif_quotidien").notNull().default(20),
  /** Mode d'écoute, retenu d'une session à l'autre. */
  modeEcoute: modeEcouteEnum("mode_ecoute").notNull().default("enchainement"),
  /** Répétitions par verset ou par passage. 0 = sans fin. */
  repetitions: integer("repetitions").notNull().default(3),
  /**
   * Silence entre deux répétitions, en dixièmes de seconde.
   *
   * C'est le cœur de la mémorisation : c'est pendant ce silence qu'on récite à
   * voix haute. Il se règle de zéro à cinq secondes, et zéro reste un choix
   * valable — enchaîner sans pause sert à imprégner l'oreille.
   */
  pauseRepetitionDs: integer("pause_repetition_ds").notNull().default(20),
  /** Vitesse de récitation, en centièmes : 75 ou 100. */
  vitesseCent: integer("vitesse_cent").notNull().default(100),
});

export type Sourate = typeof sourates.$inferSelect;
export type Verset = typeof versets.$inferSelect;
export type EditionCoran = typeof editionsCoran.$inferSelect;
export type MarquePage = typeof marquePages.$inferSelect;
export type SeanceLecture = typeof seancesLecture.$inferSelect;
export type ReglagesCoran = typeof reglagesCoran.$inferSelect;
export type Revelation = (typeof revelationEnum.enumValues)[number];
export type UniteObjectif = (typeof uniteObjectifEnum.enumValues)[number];
export type TypeEdition = (typeof typeEditionEnum.enumValues)[number];

/* ═══════════════════ Coran — session 8 ═══════════════════ */

/**
 * Où la lecture s'est arrêtée, sourate par sourate.
 *
 * La position globale ne suffit pas : quitter Al-Baqara pour lire Al-Fatiha
 * puis revenir doit ramener au verset quitté dans Al-Baqara, pas en haut.
 * Vivre en base et non dans le navigateur est ce qui fait que le téléphone et
 * la tablette retrouvent la même place.
 */
export const positionsSourate = pgTable("positions_sourate", {
  sourate: integer("sourate").primaryKey(),
  versetNumero: integer("verset_numero").notNull(),
  modifieLe: text("modifie_le").notNull(),
});

/**
 * Un mot du corpus morphologique.
 *
 * La forme arabe n'est pas stockée ici : elle est reprise du verset verbatim au
 * moment de l'affichage, en découpant sur les blancs. Le corpus n'apporte que
 * l'analyse — racine, lemme, catégorie grammaticale — et son numéro de mot sert
 * de pont vers le texte déjà en base.
 */
export const motsCoran = pgTable(
  "mots_coran",
  {
    id: serial("id").primaryKey(),
    versetNumero: integer("verset_numero").notNull(),
    sourate: integer("sourate").notNull(),
    /** Rang du mot dans le verset, à partir de 1. */
    position: integer("position").notNull(),
    /**
     * Le mot tel que le corpus le découpe : préfixes, radical, suffixes.
     * Montrer cette décomposition est le premier intérêt du mot à mot pour qui
     * apprend l'arabe — mais ce n'est jamais elle qui sert à l'affichage du
     * verset, qui vient du texte verbatim.
     */
    segments: text("segments").array().notNull().default([]),
    racine: text("racine"),
    lemme: text("lemme"),
    /** Catégorie grossière du radical : N, P ou V. */
    categorie: text("categorie").notNull().default(""),
    /** Traits du radical, recopiés du corpus sans reformulation. */
    traits: text("traits").notNull().default(""),
    /** Sens du mot ; nul tant qu'aucune glose n'est installée. */
    sens: text("sens"),
  },
  (table) => [
    uniqueIndex("mots_coran_verset_position_uniq").on(table.versetNumero, table.position),
    index("mots_coran_racine_idx").on(table.racine),
    index("mots_coran_sourate_idx").on(table.sourate),
  ],
);

export type PositionSourate = typeof positionsSourate.$inferSelect;
export type MotCoran = typeof motsCoran.$inferSelect;
export type EtapeArc = typeof etapesArc.$inferSelect;
export type Tache = typeof taches.$inferSelect;
export type AbonnementPush = typeof abonnementsPush.$inferSelect;
export type ReglagesNotifications = typeof reglagesNotifications.$inferSelect;
export type Canal = (typeof canalEnum.enumValues)[number];
export type Sauvegarde = typeof sauvegardes.$inferSelect;
export type ModeEcoute = (typeof modeEcouteEnum.enumValues)[number];
