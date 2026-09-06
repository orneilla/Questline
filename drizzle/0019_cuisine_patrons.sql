-- Module Cuisine — Phase 3 : patrons de plat et journal des suggestions.

CREATE TABLE IF NOT EXISTS "cuisine_patrons" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	-- Les catégories à pourvoir, dans l'ordre où elles se lisent.
	"categories" text[] DEFAULT '{}' NOT NULL,
	"profil" text NOT NULL,
	"mode_cuisson" text NOT NULL,
	-- La contrainte de compatibilité, dite concrètement : ce qu'un profil ne
	-- supporte pas. Un mot trouvé dans le nom d'un article l'écarte de ce patron.
	"exclut" text[] DEFAULT '{}' NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint

-- Journal de ce qui a été proposé : c'est lui qui évite de reproposer la même
-- chose trois jours de suite.
CREATE TABLE IF NOT EXISTS "cuisine_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	-- Identifie la suggestion : « recette:12 » ou la combinaison d'un patron.
	"cle" text NOT NULL,
	"date" date NOT NULL,
	"libelle" text NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cuisine_suggestions_date_idx" ON "cuisine_suggestions" ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cuisine_suggestions_cle_idx" ON "cuisine_suggestions" ("cle");--> statement-breakpoint

-- Un jeu de départ. Sans lui, le moteur combinatoire n'aurait rien à croiser
-- tant qu'aucune recette n'existe — or c'est précisément à ce moment-là qu'il
-- sert. Ils se modifient et se suppriment comme le reste.
INSERT INTO "cuisine_patrons" ("nom", "categories", "profil", "mode_cuisson", "exclut", "ordre")
VALUES
	('Sauté complet', ARRAY['feculent','proteine','legume'], 'simple', 'poele', ARRAY['fromage']::text[], 1),
	('Poêlée méditerranéenne', ARRAY['legume','proteine','matiere_grasse'], 'mediterraneen', 'poele', ARRAY['lait','crème','beurre']::text[], 2),
	('Plat mijoté', ARRAY['proteine','legume','feculent'], 'oriental', 'mijote', ARRAY['fromage','yaourt']::text[], 3),
	('Au four', ARRAY['legume','proteine'], 'simple', 'four', ARRAY[]::text[], 4),
	('Vapeur et grains', ARRAY['feculent','legume'], 'simple', 'vapeur', ARRAY['huile de friture']::text[], 5),
	('Assiette froide', ARRAY['legume','proteine','matiere_grasse'], 'mediterraneen', 'cru', ARRAY['riz','pâtes']::text[], 6),
	('Soupe de légumes', ARRAY['legume','matiere_grasse'], 'simple', 'bouilli', ARRAY[]::text[], 7),
	('Œufs et légumes', ARRAY['proteine','legume','matiere_grasse'], 'simple', 'poele', ARRAY['poisson']::text[], 8)
ON CONFLICT DO NOTHING;
