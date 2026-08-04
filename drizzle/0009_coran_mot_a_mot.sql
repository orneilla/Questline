CREATE TABLE "mots_coran" (
	"id" serial PRIMARY KEY NOT NULL,
	"verset_numero" integer NOT NULL,
	"sourate" integer NOT NULL,
	"position" integer NOT NULL,
	"buckwalter" text DEFAULT '' NOT NULL,
	"racine" text,
	"lemme" text,
	"categorie" text DEFAULT '' NOT NULL,
	"sens" text
);
--> statement-breakpoint
CREATE TABLE "positions_sourate" (
	"sourate" integer PRIMARY KEY NOT NULL,
	"verset_numero" integer NOT NULL,
	"modifie_le" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reglages_coran" ADD COLUMN "taille_translitteration" integer DEFAULT 19 NOT NULL;--> statement-breakpoint
ALTER TABLE "reglages_coran" ADD COLUMN "taille_traduction" integer DEFAULT 16 NOT NULL;--> statement-breakpoint
ALTER TABLE "reglages_coran" ADD COLUMN "mode_memorisation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "mots_coran_verset_position_uniq" ON "mots_coran" USING btree ("verset_numero","position");--> statement-breakpoint
CREATE INDEX "mots_coran_racine_idx" ON "mots_coran" USING btree ("racine");--> statement-breakpoint
CREATE INDEX "mots_coran_sourate_idx" ON "mots_coran" USING btree ("sourate");