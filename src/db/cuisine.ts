import {
  boolean,
  date,
  index,
  integer,
  jsonb,
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

    /** La marque, pour un produit emballé. Vide pour un produit brut. */
    marque: text("marque").notNull().default(""),
    /**
     * Le poids d'une portion, imprimé sur l'emballage.
     *
     * Personne ne pèse une barre encore emballée. Nul pour ce qui se pèse
     * vraiment — une pomme, de la farine.
     */
    poidsPortionG: real("poids_portion_g"),
    /** Comment cette portion s'appelle : « barre », « pot », « tranche ». */
    nomPortion: text("nom_portion").notNull().default(""),

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

/* ─────────────────────── Journal (phase 4) ─────────────────────── */

export const cuisineRepasEnum = pgEnum("cuisine_repas", [
  "matin",
  "midi",
  "soir",
  "collation",
]);

/**
 * Ce qui sépare un chiffre solide d'un chiffre plausible.
 *
 * Sans cette distinction, une semaine à moitié estimée se lirait comme une
 * semaine pesée, et la tendance qu'on en tirerait n'aurait aucune valeur.
 */
export const cuisinePrecisionEnum = pgEnum("cuisine_precision", ["pese", "estime"]);

/**
 * Un ingrédient tel qu'il était au moment de la saisie.
 *
 * Ses teneurs sont copiées, pas référencées : corriger une fiche Ciqual ou
 * rectifier une saisie manuelle ne doit pas déplacer ce qui a déjà été mangé.
 *
 * `source` est du texte libre et non l'énuméré : un instantané doit rester
 * lisible même si la liste des sources change plus tard. Un instantané qui
 * cesserait de se relire ne serait plus un instantané.
 */
export type IngredientFige = {
  alimentId: number | null;
  nom: string;
  source: string | null;
  /** En poids cru, comme partout ailleurs. */
  quantiteG: number;
  /** Teneurs pour 100 g d'alors. null = la fiche ne la donnait pas. */
  valeurs: Record<string, number | null>;
};

/** La part du poids couverte par une donnée non nulle, nutriment par nutriment. */
export type Couverture = Record<string, number>;

/**
 * Ce qui a été mangé.
 *
 * Les valeurs nutritionnelles sont un instantané, pas un calcul refait à
 * l'affichage : recalculer une entrée passée à partir de la recette
 * d'aujourd'hui réécrirait le passé à chaque correction de grammage. Ce qui a
 * été mangé ne change pas rétroactivement.
 *
 * Un nutriment inconnu vaut NULL, jamais zéro — et `complet` dit à part si un
 * ingrédient sans fiche a été purement ignoré du calcul, auquel cas les totaux
 * sont sous-estimés sans qu'aucune colonne ne le montre.
 */
export const cuisineJournal = pgTable(
  "cuisine_journal",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    repas: cuisineRepasEnum("repas").notNull(),

    recetteId: integer("recette_id").references(() => cuisineRecettes.id, {
      onDelete: "set null",
    }),
    alimentId: integer("aliment_id").references(() => cuisineAliments.id, {
      onDelete: "set null",
    }),
    /** Instantané du nom : l'entrée reste lisible après suppression de sa source. */
    libelle: text("libelle").notNull(),

    /** Un aliment seul, en grammes. */
    quantiteG: real("quantite_g"),
    /** Une part de recette, pesée dans l'assiette. */
    poidsPortionG: real("poids_portion_g"),
    precision: cuisinePrecisionEnum("precision").notNull().default("estime"),

    kcal: real("kcal"),
    proteines: real("proteines"),
    glucides: real("glucides"),
    sucres: real("sucres"),
    lipides: real("lipides"),
    ags: real("ags"),
    fibres: real("fibres"),
    sel: real("sel"),
    complet: boolean("complet").notNull().default(true),

    /** D'où vient l'entrée : une part de recette, ou un aliment seul. */
    origine: text("origine").notNull().default("recette"),
    /** L'instantané, ingrédient par ingrédient : c'est lui qui fait foi. */
    ingredients: jsonb("ingredients").$type<IngredientFige[]>().notNull().default([]),
    /** De quoi retrouver une part sans jamais reconsulter la recette. */
    nbPortions: integer("nb_portions").notNull().default(1),
    poidsTotalCuitG: real("poids_total_cuit_g"),
    /** Grammes crus équivalents de ce qui a été mangé. Pondère la couverture. */
    poidsRetenuG: real("poids_retenu_g"),
    couverture: jsonb("couverture").$type<Couverture>().notNull().default({}),

    dateSaisie: date("date_saisie").notNull(),
    /** Renseignée dès qu'une entrée a été corrigée après coup. */
    dateModification: date("date_modification"),
  },
  (table) => [index("cuisine_journal_date_idx").on(table.date)],
);

export type LigneJournal = typeof cuisineJournal.$inferSelect;
export type Repas = (typeof cuisineRepasEnum.enumValues)[number];
export type PrecisionSaisie = (typeof cuisinePrecisionEnum.enumValues)[number];
