CREATE TABLE "etapes_arc" (
	"id" serial PRIMARY KEY NOT NULL,
	"arc_id" integer NOT NULL,
	"titre" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"atteinte_le" date
);
--> statement-breakpoint
CREATE TABLE "taches" (
	"id" serial PRIMARY KEY NOT NULL,
	"texte" text NOT NULL,
	"pilier" "pilier",
	"creee_le" date NOT NULL,
	"faite_le" date,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arcs" ADD COLUMN "accompli_le" date;--> statement-breakpoint
ALTER TABLE "arcs" ADD COLUMN "ordre" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "etapes_arc" ADD CONSTRAINT "etapes_arc_arc_id_arcs_id_fk" FOREIGN KEY ("arc_id") REFERENCES "public"."arcs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "etapes_arc_arc_id_idx" ON "etapes_arc" USING btree ("arc_id");--> statement-breakpoint
CREATE INDEX "taches_faite_le_idx" ON "taches" USING btree ("faite_le");