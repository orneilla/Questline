CREATE TYPE "public"."canal_notification" AS ENUM('push', 'telegram', 'les_deux');--> statement-breakpoint
CREATE TABLE "abonnements_push" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"agent" text DEFAULT '' NOT NULL,
	"cree_le" text NOT NULL,
	"dernier_envoi" text,
	"derniere_erreur" text
);
--> statement-breakpoint
CREATE TABLE "reglages_notifications" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"canal" "canal_notification" DEFAULT 'push' NOT NULL,
	"matin_actif" boolean DEFAULT true NOT NULL,
	"soir_actif" boolean DEFAULT true NOT NULL,
	"heure_matin" integer DEFAULT 450 NOT NULL,
	"heure_soir" integer DEFAULT 1290 NOT NULL,
	"vapid_publique" text,
	"vapid_privee" text,
	"pause_jusqua" date,
	"premiere_ouverture" date
);
--> statement-breakpoint
CREATE TABLE "sauvegardes" (
	"id" serial PRIMARY KEY NOT NULL,
	"creee_le" text NOT NULL,
	"octets" integer NOT NULL,
	"resume" text DEFAULT '{}' NOT NULL,
	"contenu" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "abonnements_push_endpoint_uniq" ON "abonnements_push" USING btree ("endpoint");