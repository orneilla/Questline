CREATE TYPE "public"."etat_carte" AS ENUM('nouvelle', 'apprentissage', 'jeune', 'mure');--> statement-breakpoint
CREATE TYPE "public"."type_carte" AS ENUM('recto_verso', 'inversee', 'trous');--> statement-breakpoint
CREATE TABLE "cartes" (
	"id" serial PRIMARY KEY NOT NULL,
	"paquet_id" integer NOT NULL,
	"recto" text NOT NULL,
	"verso" text NOT NULL,
	"type" "type_carte" DEFAULT 'recto_verso' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"etat" "etat_carte" DEFAULT 'nouvelle' NOT NULL,
	"prochaine_date" date,
	"stabilite" real DEFAULT 0 NOT NULL,
	"difficulte" real DEFAULT 0 NOT NULL,
	"rechutes" integer DEFAULT 0 NOT NULL,
	"suspendue" boolean DEFAULT false NOT NULL,
	"source_cle" text,
	"cree_le" date NOT NULL,
	"modifie_le" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "espaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"couleur" text DEFAULT '#7e92b8' NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paquets" (
	"id" serial PRIMARY KEY NOT NULL,
	"espace_id" integer NOT NULL,
	"parent_id" integer,
	"nom" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"objectif_cartes" integer DEFAULT 0 NOT NULL,
	"couverture" text
);
--> statement-breakpoint
CREATE TABLE "reglages_cartes" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"version_schema" integer DEFAULT 1 NOT NULL,
	"delai_encore_min" real DEFAULT 1 NOT NULL,
	"delai_difficile_min" real DEFAULT 6 NOT NULL,
	"retention_cible" real DEFAULT 0.9 NOT NULL,
	"poids_fsrs" real[] DEFAULT '{}' NOT NULL,
	"nouvelles_par_jour" integer DEFAULT 20 NOT NULL,
	"maximum_par_jour" integer DEFAULT 200 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"carte_id" integer NOT NULL,
	"date" date NOT NULL,
	"vue_le" text NOT NULL,
	"note" integer NOT NULL,
	"stabilite" real NOT NULL,
	"difficulte" real NOT NULL,
	"prochaine_date" date NOT NULL,
	"intervalle" real NOT NULL,
	"etat" "etat_carte" NOT NULL,
	"duree" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions_revision" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"paquet_id" integer,
	"cartes_vues" integer DEFAULT 0 NOT NULL,
	"duree" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cartes" ADD CONSTRAINT "cartes_paquet_id_paquets_id_fk" FOREIGN KEY ("paquet_id") REFERENCES "public"."paquets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paquets" ADD CONSTRAINT "paquets_espace_id_espaces_id_fk" FOREIGN KEY ("espace_id") REFERENCES "public"."espaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_carte_id_cartes_id_fk" FOREIGN KEY ("carte_id") REFERENCES "public"."cartes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions_revision" ADD CONSTRAINT "sessions_revision_paquet_id_paquets_id_fk" FOREIGN KEY ("paquet_id") REFERENCES "public"."paquets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cartes_paquet_id_idx" ON "cartes" USING btree ("paquet_id");--> statement-breakpoint
CREATE INDEX "cartes_etat_idx" ON "cartes" USING btree ("etat");--> statement-breakpoint
CREATE INDEX "cartes_prochaine_date_idx" ON "cartes" USING btree ("prochaine_date");--> statement-breakpoint
CREATE INDEX "cartes_du_jour_idx" ON "cartes" USING btree ("paquet_id","suspendue","prochaine_date");--> statement-breakpoint
CREATE INDEX "cartes_source_cle_idx" ON "cartes" USING btree ("source_cle");--> statement-breakpoint
CREATE INDEX "paquets_espace_id_idx" ON "paquets" USING btree ("espace_id");--> statement-breakpoint
CREATE INDEX "paquets_parent_id_idx" ON "paquets" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "revisions_carte_id_idx" ON "revisions" USING btree ("carte_id");--> statement-breakpoint
CREATE INDEX "revisions_date_idx" ON "revisions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "revisions_prochaine_date_idx" ON "revisions" USING btree ("prochaine_date");--> statement-breakpoint
CREATE INDEX "sessions_revision_date_idx" ON "sessions_revision" USING btree ("date");