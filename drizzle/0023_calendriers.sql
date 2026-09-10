-- Abonnement à un calendrier extérieur, en lecture seule.
--
-- Le flux est relu périodiquement et déroulé en occurrences datées, stockées
-- ici. L'écran du jour lit alors une simple ligne par créneau, sans avoir à
-- rejouer les règles de répétition à chaque affichage.

CREATE TABLE IF NOT EXISTS "calendriers_abonnes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL DEFAULT '',
	-- L'adresse du flux. Secrète par nature : elle donne accès au calendrier.
	"url" text NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"ajoute_le" date NOT NULL,
	-- État de la dernière relecture, pour que l'écran puisse le dire.
	"derniere_maj" text,
	"dernier_resultat" text NOT NULL DEFAULT '',
	"nb_occurrences" integer DEFAULT 0 NOT NULL,
	-- Règles de répétition non gérées rencontrées au dernier passage.
	"regles_ignorees" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "calendriers_abonnes_url_uniq"
	ON "calendriers_abonnes" ("url");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "evenements_importes" (
	"id" serial PRIMARY KEY NOT NULL,
	"calendrier_id" integer NOT NULL
		REFERENCES "calendriers_abonnes"("id") ON DELETE CASCADE,
	-- L'identifiant d'origine, gardé pour reconnaître une occurrence.
	"uid" text NOT NULL DEFAULT '',
	"titre" text NOT NULL,
	"date" date NOT NULL,
	"debut" time NOT NULL,
	"fin" time NOT NULL,
	"journee_entiere" boolean DEFAULT false NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "evenements_importes_date_idx"
	ON "evenements_importes" ("date");
