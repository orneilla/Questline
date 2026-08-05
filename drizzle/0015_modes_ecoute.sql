CREATE TYPE "public"."mode_ecoute" AS ENUM('enchainement', 'verset_boucle', 'passage_boucle');--> statement-breakpoint
ALTER TABLE "reglages_coran" ADD COLUMN "mode_ecoute" "mode_ecoute" DEFAULT 'enchainement' NOT NULL;--> statement-breakpoint
ALTER TABLE "reglages_coran" ADD COLUMN "repetitions" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "reglages_coran" ADD COLUMN "pause_repetition_ds" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "reglages_coran" ADD COLUMN "vitesse_cent" integer DEFAULT 100 NOT NULL;