ALTER TABLE "quetes" ADD COLUMN "actif" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "arcs" DROP COLUMN "progression";