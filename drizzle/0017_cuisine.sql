-- Module Cuisine — Phase 1 : catalogue nutritionnel, inventaire, courses.
--
-- Tout est préfixé `cuisine_` et ne référence aucune table du reste de
-- Questline : ni arcs, ni piliers, ni élan, ni cartes, ni calendrier. Le module
-- se supprime en trois DROP sans rien laisser derrière lui.

CREATE TYPE "public"."cuisine_etat_aliment" AS ENUM('cru', 'cuit');--> statement-breakpoint
CREATE TYPE "public"."cuisine_source_aliment" AS ENUM('ciqual', 'off', 'manuel');--> statement-breakpoint
CREATE TYPE "public"."cuisine_niveau" AS ENUM('beaucoup', 'un_peu', 'epuise');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cuisine_aliments" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"categorie" text NOT NULL DEFAULT 'autre',
	"kcal_100g" real,
	"proteines_100g" real,
	"glucides_100g" real,
	"sucres_100g" real,
	"lipides_100g" real,
	"ags_100g" real,
	"fibres_100g" real,
	"sel_100g" real,
	"etat" "cuisine_etat_aliment" NOT NULL DEFAULT 'cru',
	"source" "cuisine_source_aliment" NOT NULL,
	"code_source" text,
	"date_verification" date NOT NULL,
	"densite_g_par_ml" real
);--> statement-breakpoint

-- Rend l'import rejouable : un même aliment d'une même source ne rentre
-- qu'une fois, et un second passage met à jour au lieu de dupliquer.
CREATE UNIQUE INDEX IF NOT EXISTS "cuisine_aliments_source_code_uniq"
	ON "cuisine_aliments" ("source", "code_source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cuisine_aliments_nom_idx" ON "cuisine_aliments" ("nom");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cuisine_aliments_categorie_idx" ON "cuisine_aliments" ("categorie");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cuisine_inventaire" (
	"id" serial PRIMARY KEY NOT NULL,
	-- Nul volontairement : on peut avoir « des courgettes » sans les relier au
	-- catalogue. Le lien se fait plus tard, ou jamais.
	"aliment_id" integer REFERENCES "public"."cuisine_aliments"("id") ON DELETE set null,
	"nom_libre" text NOT NULL,
	"categorie" text NOT NULL DEFAULT 'autre',
	"niveau" "cuisine_niveau" NOT NULL DEFAULT 'beaucoup',
	"date_peremption" date,
	"date_ajout" date NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cuisine_inventaire_niveau_idx" ON "cuisine_inventaire" ("niveau");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cuisine_courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"categorie" text NOT NULL DEFAULT 'autre',
	"achete" boolean NOT NULL DEFAULT false,
	"date_ajout" date NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cuisine_courses_achete_idx" ON "cuisine_courses" ("achete");
