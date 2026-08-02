CREATE TYPE "public"."categorie_creneau" AS ENUM('cours', 'travail', 'priere', 'autre');--> statement-breakpoint
CREATE TABLE "creneaux_recurrents" (
	"id" serial PRIMARY KEY NOT NULL,
	"titre" text NOT NULL,
	"type" "categorie_creneau" DEFAULT 'autre' NOT NULL,
	"jour_semaine" integer NOT NULL,
	"debut" time NOT NULL,
	"fin" time NOT NULL,
	"actif_depuis" date,
	"actif_jusqua" date
);
--> statement-breakpoint
CREATE TABLE "evenements" (
	"id" serial PRIMARY KEY NOT NULL,
	"titre" text NOT NULL,
	"type" "categorie_creneau" DEFAULT 'autre' NOT NULL,
	"date" date NOT NULL,
	"debut" time NOT NULL,
	"fin" time NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "creneaux_recurrents_jour_semaine_idx" ON "creneaux_recurrents" USING btree ("jour_semaine");--> statement-breakpoint
CREATE INDEX "evenements_date_idx" ON "evenements" USING btree ("date");--> statement-breakpoint
ALTER TABLE "public"."journees" ALTER COLUMN "type_jour" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."journees" ALTER COLUMN "type_jour" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."type_jour";--> statement-breakpoint
CREATE TYPE "public"."type_jour" AS ENUM('libre', 'chargee', 'pleine');--> statement-breakpoint
ALTER TABLE "public"."journees" ALTER COLUMN "type_jour" SET DATA TYPE "public"."type_jour" USING (CASE "type_jour" WHEN 'shift' THEN 'pleine' WHEN 'reduit' THEN 'chargee' ELSE 'libre' END)::"public"."type_jour";--> statement-breakpoint
ALTER TABLE "public"."journees" ALTER COLUMN "type_jour" SET DEFAULT 'libre';