CREATE TABLE "quetes_rares_faites" (
	"date" date PRIMARY KEY NOT NULL,
	"cle" text NOT NULL,
	"texte" text NOT NULL,
	"pilier" "pilier" NOT NULL,
	"poids" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saisons" (
	"numero" integer PRIMARY KEY NOT NULL,
	"debut" date NOT NULL,
	"fin" date NOT NULL,
	"question" text DEFAULT '' NOT NULL,
	"reponse" text DEFAULT '' NOT NULL,
	"cloturee_le" date
);
--> statement-breakpoint
CREATE TABLE "seuils_arcs" (
	"id" serial PRIMARY KEY NOT NULL,
	"arc_id" integer NOT NULL,
	"seuil" integer NOT NULL,
	"atteint_le" date NOT NULL,
	"vu" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journees" ADD COLUMN "titre" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "seuils_arcs" ADD CONSTRAINT "seuils_arcs_arc_id_arcs_id_fk" FOREIGN KEY ("arc_id") REFERENCES "public"."arcs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seuils_arcs_arc_seuil_uniq" ON "seuils_arcs" USING btree ("arc_id","seuil");