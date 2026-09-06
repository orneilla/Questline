-- Module Cuisine — Phase 2 : recettes, ingrédients, calcul nutritionnel.
--
-- Toujours étanche : rien ici ne référence une table hors `cuisine_`.

CREATE TYPE "public"."cuisine_role_ingredient" AS ENUM(
	'essentiel', 'optionnel', 'substituable'
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cuisine_recettes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"temps_minutes" integer DEFAULT 0 NOT NULL,
	"mode_cuisson" text DEFAULT 'poele' NOT NULL,
	"nb_portions" integer DEFAULT 1 NOT NULL,
	-- Pesé une fois le plat terminé. Nul tant qu'on ne l'a pas fait : c'est lui
	-- qui permet de convertir le poids d'une assiette en portion réelle.
	"poids_total_cuit_g" real,
	"je_referai" boolean DEFAULT true NOT NULL,
	"date_creation" date NOT NULL,
	"nb_fois_cuisinee" integer DEFAULT 0 NOT NULL,
	"derniere_fois" date
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cuisine_recettes_nom_idx" ON "cuisine_recettes" ("nom");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cuisine_recette_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"recette_id" integer NOT NULL
		REFERENCES "public"."cuisine_recettes"("id") ON DELETE cascade,
	-- Nul quand l'ingrédient n'est relié à aucune fiche du catalogue : la
	-- recette existe quand même, seul son calcul reste incomplet, et l'écran
	-- le dit.
	"aliment_id" integer REFERENCES "public"."cuisine_aliments"("id") ON DELETE set null,
	"nom_libre" text NOT NULL,
	-- Toujours en poids cru. Mélanger cru et cuit fausserait tout, en silence.
	"quantite_g" real DEFAULT 0 NOT NULL,
	"role" "cuisine_role_ingredient" DEFAULT 'essentiel' NOT NULL,
	-- Ce par quoi l'ingrédient peut être remplacé, quand il est substituable.
	"categorie_substitution" text,
	"ordre" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cuisine_recette_ingredients_recette_idx"
	ON "cuisine_recette_ingredients" ("recette_id");
