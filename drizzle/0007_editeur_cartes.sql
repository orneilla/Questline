CREATE TABLE "medias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text DEFAULT '' NOT NULL,
	"type_mime" text NOT NULL,
	"octets" integer DEFAULT 0 NOT NULL,
	"largeur" integer DEFAULT 0 NOT NULL,
	"hauteur" integer DEFAULT 0 NOT NULL,
	"donnees" text NOT NULL,
	"cree_le" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cartes" ADD COLUMN "source_recto" text;--> statement-breakpoint
ALTER TABLE "cartes" ADD COLUMN "source_verso" text;--> statement-breakpoint
ALTER TABLE "cartes" ADD COLUMN "source_index" integer DEFAULT 0 NOT NULL;