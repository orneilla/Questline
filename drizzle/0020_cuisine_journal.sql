-- Module Cuisine — Phase 4 : le journal des repas.

DO $$ BEGIN
	CREATE TYPE "cuisine_repas" AS ENUM('matin', 'midi', 'soir', 'collation');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Ce qui sépare un chiffre solide d'un chiffre plausible. Sans cette
-- distinction, une semaine à moitié estimée se lirait comme une semaine pesée.
DO $$ BEGIN
	CREATE TYPE "cuisine_precision" AS ENUM('pese', 'estime');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cuisine_journal" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"repas" "cuisine_repas" NOT NULL,

	-- L'origine, quand elle existe encore. Une recette supprimée met le lien à
	-- NULL sans effacer l'entrée : ce qui a été mangé a été mangé.
	"recette_id" integer REFERENCES "cuisine_recettes"("id") ON DELETE SET NULL,
	"aliment_id" integer REFERENCES "cuisine_aliments"("id") ON DELETE SET NULL,
	-- Instantané du nom, pour que l'entrée reste lisible après coup.
	"libelle" text NOT NULL,

	-- Un aliment seul se pèse en grammes ; une part de recette se pèse dans
	-- l'assiette. Les deux ne se rangent pas dans la même colonne parce qu'ils
	-- ne veulent pas dire la même chose.
	"quantite_g" real,
	"poids_portion_g" real,
	"precision" "cuisine_precision" DEFAULT 'estime' NOT NULL,

	-- Instantané nutritionnel. Recalculer une entrée passée à partir de la
	-- recette d'aujourd'hui réécrirait le passé à chaque correction de
	-- grammage : ce qui a été mangé ne change pas rétroactivement.
	-- NULL = valeur inconnue, jamais zéro.
	"kcal" real,
	"proteines" real,
	"glucides" real,
	"sucres" real,
	"lipides" real,
	"ags" real,
	"fibres" real,
	"sel" real,
	-- Faux quand un ingrédient sans fiche a été ignoré du calcul : les totaux
	-- sont alors sous-estimés, et l'écran doit pouvoir le dire.
	"complet" boolean DEFAULT true NOT NULL,

	"date_saisie" date NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cuisine_journal_date_idx" ON "cuisine_journal" ("date");
