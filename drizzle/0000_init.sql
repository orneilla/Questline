CREATE TYPE "public"."pilier" AS ENUM('corps', 'deen', 'academique', 'ornacre', 'nutrition');--> statement-breakpoint
CREATE TYPE "public"."recurrence" AS ENUM('quotidienne', 'hebdomadaire', 'ponctuelle');--> statement-breakpoint
CREATE TYPE "public"."type_creneau" AS ENUM('shift', 'cours', 'priere');--> statement-breakpoint
CREATE TYPE "public"."type_jour" AS ENUM('libre', 'cours', 'shift');--> statement-breakpoint
CREATE TABLE "arcs" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"pilier" "pilier" NOT NULL,
	"vision" text DEFAULT '' NOT NULL,
	"progression" integer DEFAULT 0 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creneaux" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "type_creneau" NOT NULL,
	"jour_semaine" integer NOT NULL,
	"debut" time NOT NULL,
	"fin" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journees" (
	"date" date PRIMARY KEY NOT NULL,
	"type_jour" "type_jour" DEFAULT 'libre' NOT NULL,
	"mode_bas" boolean DEFAULT false NOT NULL,
	"phrase" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "momentum" (
	"pilier" "pilier" PRIMARY KEY NOT NULL,
	"valeur" real DEFAULT 0 NOT NULL,
	"maj_le" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quetes" (
	"id" serial PRIMARY KEY NOT NULL,
	"arc_id" integer NOT NULL,
	"titre" text NOT NULL,
	"poids" integer DEFAULT 3 NOT NULL,
	"duree_min" integer DEFAULT 20 NOT NULL,
	"recurrence" "recurrence" DEFAULT 'quotidienne' NOT NULL,
	"jours_exclus" integer[] DEFAULT '{}' NOT NULL,
	"minimale" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validations" (
	"id" serial PRIMARY KEY NOT NULL,
	"quete_id" integer NOT NULL,
	"date" date NOT NULL,
	"bonus_reprise" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quetes" ADD CONSTRAINT "quetes_arc_id_arcs_id_fk" FOREIGN KEY ("arc_id") REFERENCES "public"."arcs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validations" ADD CONSTRAINT "validations_quete_id_quetes_id_fk" FOREIGN KEY ("quete_id") REFERENCES "public"."quetes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creneaux_jour_semaine_idx" ON "creneaux" USING btree ("jour_semaine");--> statement-breakpoint
CREATE INDEX "quetes_arc_id_idx" ON "quetes" USING btree ("arc_id");--> statement-breakpoint
CREATE INDEX "validations_date_idx" ON "validations" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "validations_quete_date_uniq" ON "validations" USING btree ("quete_id","date");