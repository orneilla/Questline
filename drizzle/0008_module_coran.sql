CREATE TYPE "public"."revelation" AS ENUM('mecquoise', 'medinoise');--> statement-breakpoint
CREATE TYPE "public"."type_edition_coran" AS ENUM('traduction', 'translitteration');--> statement-breakpoint
CREATE TYPE "public"."unite_objectif" AS ENUM('versets', 'pages', 'minutes');--> statement-breakpoint
CREATE TABLE "editions_coran" (
	"cle" text PRIMARY KEY NOT NULL,
	"langue" text NOT NULL,
	"nom" text NOT NULL,
	"auteur" text NOT NULL,
	"type" "type_edition_coran" NOT NULL,
	"source" text NOT NULL,
	"licence" text NOT NULL,
	"versets" integer DEFAULT 0 NOT NULL,
	"importee_le" date
);
--> statement-breakpoint
CREATE TABLE "marque_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"verset_numero" integer NOT NULL,
	"nom" text DEFAULT '' NOT NULL,
	"cree_le" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "position_lecture" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"verset_numero" integer DEFAULT 1 NOT NULL,
	"modifie_le" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reglages_coran" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"traduction" text,
	"translitteration" text,
	"reciteur" text DEFAULT 'ar.alafasy' NOT NULL,
	"taille_arabe" integer DEFAULT 30 NOT NULL,
	"police_arabe" text DEFAULT 'amiri' NOT NULL,
	"afficher_translitteration" boolean DEFAULT true NOT NULL,
	"afficher_traduction" boolean DEFAULT true NOT NULL,
	"afficher_arabe" boolean DEFAULT true NOT NULL,
	"unite_objectif" "unite_objectif" DEFAULT 'versets' NOT NULL,
	"objectif_quotidien" integer DEFAULT 20 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seances_lecture" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"versets" integer DEFAULT 0 NOT NULL,
	"secondes" integer DEFAULT 0 NOT NULL,
	"debut" integer NOT NULL,
	"fin" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sourates" (
	"numero" integer PRIMARY KEY NOT NULL,
	"nom_arabe" text NOT NULL,
	"nom_translittere" text NOT NULL,
	"sens_du_nom" text NOT NULL,
	"revelation" "revelation" NOT NULL,
	"versets" integer NOT NULL,
	"premier_verset" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "textes_versets" (
	"edition_cle" text NOT NULL,
	"verset_numero" integer NOT NULL,
	"texte" text NOT NULL,
	CONSTRAINT "textes_versets_edition_cle_verset_numero_pk" PRIMARY KEY("edition_cle","verset_numero")
);
--> statement-breakpoint
CREATE TABLE "versets" (
	"numero" integer PRIMARY KEY NOT NULL,
	"sourate" integer NOT NULL,
	"numero_dans_sourate" integer NOT NULL,
	"juz" integer NOT NULL,
	"page" integer NOT NULL,
	"hizb_quart" integer NOT NULL,
	"sajda" boolean DEFAULT false NOT NULL,
	"texte" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "textes_versets" ADD CONSTRAINT "textes_versets_edition_cle_editions_coran_cle_fk" FOREIGN KEY ("edition_cle") REFERENCES "public"."editions_coran"("cle") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versets" ADD CONSTRAINT "versets_sourate_sourates_numero_fk" FOREIGN KEY ("sourate") REFERENCES "public"."sourates"("numero") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marque_pages_verset_idx" ON "marque_pages" USING btree ("verset_numero");--> statement-breakpoint
CREATE INDEX "seances_lecture_date_idx" ON "seances_lecture" USING btree ("date");--> statement-breakpoint
CREATE INDEX "textes_versets_verset_idx" ON "textes_versets" USING btree ("verset_numero");--> statement-breakpoint
CREATE INDEX "versets_sourate_idx" ON "versets" USING btree ("sourate");--> statement-breakpoint
CREATE INDEX "versets_juz_idx" ON "versets" USING btree ("juz");--> statement-breakpoint
CREATE INDEX "versets_page_idx" ON "versets" USING btree ("page");