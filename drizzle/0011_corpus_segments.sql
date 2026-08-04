ALTER TABLE "mots_coran" ADD COLUMN "segments" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "mots_coran" ADD COLUMN "traits" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reglages_coran" ADD COLUMN "source_morphologie" text;