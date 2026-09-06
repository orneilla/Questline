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
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Schéma du module Cuisine.
 *
 * Volontairement dans son propre fichier, et non dans `schema.ts` : le module
 * ne référence aucune table du reste de Questline et rien du reste ne le
 * référence. Il s'ajoute et se retire d'un bloc.
 *
 * Toutes les tables sont préfixées `cuisine_`, tous les types énumérés aussi :
 * un nom générique comme « niveau » ou « source » finirait par entrer en
 * collision avec le reste de l'application.
 */

export const cuisineEtatEnum = pgEnum("cuisine_etat_aliment", ["cru", "cuit"]);

/**
 * D'où vient la donnée nutritionnelle.
 *
 * `ciqual` : table officielle de l'Anses. `off` : Open Food Facts, contributif
 * donc à vérifier. `manuel` : saisi à la main — le moins fiable, et l'écran
 * doit le dire.
 */
export const cuisineSourceEnum = pgEnum("cuisine_source_aliment", [
  "ciqual",
  "off",
  "manuel",
]);

/** Ce qu'il reste. Grossier exprès : une quantité précise ne se tient pas. */
export const cuisineNiveauEnum = pgEnum("cuisine_niveau", [
  "beaucoup",
  "un_peu",
  "epuise",
]);

/**
 * Le catalogue de référence.
 *
 * `etat` sépare deux référentiels qui ne se mélangent jamais : 100 g de riz cru
 * et 100 g de riz cuit n'ont rien à voir. Confondre les deux fausse tout le
 * reste, en silence.
 */
export const cuisineAliments = pgTable(
  "cuisine_aliments",
  {
    id: serial("id").primaryKey(),
    nom: text("nom").notNull(),
    categorie: text("categorie").notNull().default("autre"),

    // Nuls quand la source ne donne pas la valeur. Un zéro serait un mensonge.
    kcal100g: real("kcal_100g"),
    proteines100g: real("proteines_100g"),
    glucides100g: real("glucides_100g"),
    sucres100g: real("sucres_100g"),
    lipides100g: real("lipides_100g"),
    ags100g: real("ags_100g"),
    fibres100g: real("fibres_100g"),
    sel100g: real("sel_100g"),

    etat: cuisineEtatEnum("etat").notNull().default("cru"),
    source: cuisineSourceEnum("source").notNull(),
    /** Code Ciqual, ou code-barres pour Open Food Facts. */
    codeSource: text("code_source"),
    dateVerification: date("date_verification").notNull(),
    /** Pour les liquides : convertir un volume en poids. */
    densiteGParMl: real("densite_g_par_ml"),
  },
  (table) => [
    uniqueIndex("cuisine_aliments_source_code_uniq").on(table.source, table.codeSource),
    index("cuisine_aliments_nom_idx").on(table.nom),
    index("cuisine_aliments_categorie_idx").on(table.categorie),
  ],
);

/**
 * Ce qu'il y a chez soi.
 *
 * Trois niveaux, pas de grammes : un inventaire qui demande de peser ne se
 * tient pas une semaine. Le lien vers le catalogue est facultatif — « des
 * courgettes » suffit à faire une suggestion.
 */
export const cuisineInventaire = pgTable(
  "cuisine_inventaire",
  {
    id: serial("id").primaryKey(),
    alimentId: integer("aliment_id").references(() => cuisineAliments.id, {
      onDelete: "set null",
    }),
    nomLibre: text("nom_libre").notNull(),
    categorie: text("categorie").notNull().default("autre"),
    niveau: cuisineNiveauEnum("niveau").notNull().default("beaucoup"),
    datePeremption: date("date_peremption"),
    dateAjout: date("date_ajout").notNull(),
  },
  (table) => [index("cuisine_inventaire_niveau_idx").on(table.niveau)],
);

/** La liste de courses. Cocher « acheté » verse l'article dans l'inventaire. */
export const cuisineCourses = pgTable(
  "cuisine_courses",
  {
    id: serial("id").primaryKey(),
    nom: text("nom").notNull(),
    categorie: text("categorie").notNull().default("autre"),
    achete: boolean("achete").notNull().default(false),
    dateAjout: date("date_ajout").notNull(),
  },
  (table) => [index("cuisine_courses_achete_idx").on(table.achete)],
);

export type AlimentCuisine = typeof cuisineAliments.$inferSelect;
export type ArticleInventaire = typeof cuisineInventaire.$inferSelect;
export type ArticleCourses = typeof cuisineCourses.$inferSelect;
export type NiveauCuisine = (typeof cuisineNiveauEnum.enumValues)[number];
export type EtatAliment = (typeof cuisineEtatEnum.enumValues)[number];
export type SourceAliment = (typeof cuisineSourceEnum.enumValues)[number];

/* ─────────────────────── Recettes (phase 2) ─────────────────────── */

/**
 * Le rôle d'un ingrédient dans une recette.
 *
 * C'est le cœur du système de suggestion : un `essentiel` manquant écarte la
 * recette, un `optionnel` manquant la pénalise à peine, un `substituable` peut
 * être remplacé par autre chose de sa catégorie. Trois rôles, pas deux — sans
 * `substituable`, une recette ne survivrait jamais à un placard réel.
 */
export const cuisineRoleEnum = pgEnum("cuisine_role_ingredient", [
  "essentiel",
  "optionnel",
  "substituable",
]);

export const cuisineRecettes = pgTable(
  "cuisine_recettes",
  {
    id: serial("id").primaryKey(),
    nom: text("nom").notNull(),
    instructions: text("instructions").notNull().default(""),
    tempsMinutes: integer("temps_minutes").notNull().default(0),
    modeCuisson: text("mode_cuisson").notNull().default("poele"),
    nbPortions: integer("nb_portions").notNull().default(1),
    /** Pesé une fois le plat terminé : convertit une assiette en portion. */
    poidsTotalCuitG: real("poids_total_cuit_g"),
    jeReferai: boolean("je_referai").notNull().default(true),
    dateCreation: date("date_creation").notNull(),
    nbFoisCuisinee: integer("nb_fois_cuisinee").notNull().default(0),
    derniereFois: date("derniere_fois"),
  },
  (table) => [index("cuisine_recettes_nom_idx").on(table.nom)],
);

export const cuisineRecetteIngredients = pgTable(
  "cuisine_recette_ingredients",
  {
    id: serial("id").primaryKey(),
    recetteId: integer("recette_id")
      .notNull()
      .references(() => cuisineRecettes.id, { onDelete: "cascade" }),
    alimentId: integer("aliment_id").references(() => cuisineAliments.id, {
      onDelete: "set null",
    }),
    nomLibre: text("nom_libre").notNull(),
    /** Toujours en poids cru. */
    quantiteG: real("quantite_g").notNull().default(0),
    role: cuisineRoleEnum("role").notNull().default("essentiel"),
    categorieSubstitution: text("categorie_substitution"),
    ordre: integer("ordre").notNull().default(0),
  },
  (table) => [
    index("cuisine_recette_ingredients_recette_idx").on(table.recetteId),
  ],
);

export type Recette = typeof cuisineRecettes.$inferSelect;
export type IngredientRecette = typeof cuisineRecetteIngredients.$inferSelect;
export type RoleIngredient = (typeof cuisineRoleEnum.enumValues)[number];

/* ─────────────────────── Suggestions (phase 3) ─────────────────────── */

/**
 * Un patron de plat : une structure, pas une recette.
 *
 * « féculent + protéine + légume, profil simple, à la poêle » ne dit pas quoi
 * cuisiner — il dit ce qui, croisé avec l'inventaire réel, ferait un plat
 * tenable. C'est ce mécanisme qui fait vivre le module tant qu'aucune recette
 * n'existe.
 *
 * `exclut` porte la contrainte de compatibilité, dite concrètement : les mots
 * qu'un profil ne supporte pas. Un article dont le nom en contient un ne peut
 * pas pourvoir une place de ce patron.
 */
export const cuisinePatrons = pgTable("cuisine_patrons", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  categories: text("categories").array().notNull().default([]),
  profil: text("profil").notNull(),
  modeCuisson: text("mode_cuisson").notNull(),
  exclut: text("exclut").array().notNull().default([]),
  actif: boolean("actif").notNull().default(true),
  ordre: integer("ordre").notNull().default(0),
});

/** Ce qui a été proposé, et quand. Sert uniquement à ne pas se répéter. */
export const cuisineSuggestions = pgTable(
  "cuisine_suggestions",
  {
    id: serial("id").primaryKey(),
    cle: text("cle").notNull(),
    date: date("date").notNull(),
    libelle: text("libelle").notNull(),
  },
  (table) => [
    index("cuisine_suggestions_date_idx").on(table.date),
    index("cuisine_suggestions_cle_idx").on(table.cle),
  ],
);

export type Patron = typeof cuisinePatrons.$inferSelect;
