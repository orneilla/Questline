-- Les catégories de créneau deviennent des lignes.
--
-- C'était un type énuméré : quatre valeurs — cours, travail, prière, autre —
-- gravées dans le schéma, dont Postgres ne sait retirer aucune. Impossible d'en
-- ajouter une sans migration, impossible de changer une teinte sans toucher au
-- code. Or une semaine réelle distingue les cours des révisions, le job du
-- sport, et chacun mérite sa couleur.
--
-- Même conversion que pour les piliers : une table, des colonnes texte, des
-- clés étrangères. Le type énuméré reste en base, orphelin — le supprimer
-- n'apporterait rien et ferait échouer la migration si quoi que ce soit y
-- référait encore.

CREATE TABLE IF NOT EXISTS "categories_creneau" (
	"cle" text PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"couleur" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint

-- Le jeu de départ, sur la palette demandée.
--
-- Sept teintes pour deux familles seulement — des verts et des roses. Séparer
-- parfaitement quatre catégories est donc impossible, et la répartition écarte
-- ce qui doit l'être : cours et révisions se lisent l'un contre l'autre dans le
-- vert, ce qui est juste puisqu'ils vont ensemble ; le travail est le seul rose
-- profond ; le sport est le seul crème, donc reconnaissable sans hésitation.
-- Tout se change ensuite d'un geste dans les réglages.
INSERT INTO "categories_creneau" ("cle", "nom", "couleur", "ordre") VALUES
	('cours',     'Cours',      '#4A6644', 1),
	('revisions', 'Révisions',  '#9FAA74', 2),
	('travail',   'Travail',    '#C66F80', 3),
	('sport',     'Sport',      '#ECE3D2', 4),
	('priere',    'Prière',     '#D7DAB3', 5),
	('perso',     'Personnel',  '#F4C7D0', 6),
	('autre',     'Autre',      '#FCEBF1', 7)
ON CONFLICT ("cle") DO NOTHING;--> statement-breakpoint

-- Les colonnes passent de l'énuméré au texte, valeurs conservées.
ALTER TABLE "creneaux_recurrents"
	ALTER COLUMN "type" TYPE text USING "type"::text;--> statement-breakpoint
ALTER TABLE "creneaux_recurrents"
	ALTER COLUMN "type" SET DEFAULT 'autre';--> statement-breakpoint

ALTER TABLE "evenements"
	ALTER COLUMN "type" TYPE text USING "type"::text;--> statement-breakpoint
ALTER TABLE "evenements"
	ALTER COLUMN "type" SET DEFAULT 'autre';--> statement-breakpoint

-- Toute valeur qui ne désignerait aucune catégorie existante est ramenée à
-- « autre » avant de poser la contrainte : sans ça, une donnée ancienne ferait
-- échouer la migration entière.
UPDATE "creneaux_recurrents" SET "type" = 'autre'
	WHERE "type" NOT IN (SELECT "cle" FROM "categories_creneau");--> statement-breakpoint
UPDATE "evenements" SET "type" = 'autre'
	WHERE "type" NOT IN (SELECT "cle" FROM "categories_creneau");--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "creneaux_recurrents"
		ADD CONSTRAINT "creneaux_recurrents_type_fk"
		FOREIGN KEY ("type") REFERENCES "categories_creneau"("cle")
		ON DELETE SET DEFAULT ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "evenements"
		ADD CONSTRAINT "evenements_type_fk"
		FOREIGN KEY ("type") REFERENCES "categories_creneau"("cle")
		ON DELETE SET DEFAULT ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Les créneaux venus d'un calendrier extérieur reçoivent aussi une catégorie.
ALTER TABLE "evenements_importes"
	ADD COLUMN IF NOT EXISTS "categorie" text DEFAULT 'autre' NOT NULL;--> statement-breakpoint

-- Comment un créneau importé trouve sa catégorie : par un mot cherché dans son
-- titre. Déterministe et relisible — la première règle qui correspond gagne.
-- Rien n'est deviné par un modèle : l'ordre des règles est la seule autorité.
CREATE TABLE IF NOT EXISTS "regles_categorie" (
	"id" serial PRIMARY KEY NOT NULL,
	"motif" text NOT NULL,
	"categorie" text NOT NULL DEFAULT 'autre'
		REFERENCES "categories_creneau"("cle") ON DELETE CASCADE ON UPDATE CASCADE,
	"ordre" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint

-- Un amorçage plausible, à corriger d'après les vrais libellés du calendrier.
INSERT INTO "regles_categorie" ("motif", "categorie", "ordre") VALUES
	('cours',    'cours',     1),
	('cm',       'cours',     2),
	('td',       'cours',     3),
	('tp',       'cours',     4),
	('amphi',    'cours',     5),
	('examen',   'revisions', 6),
	('partiel',  'revisions', 7),
	('révision', 'revisions', 8),
	('travail',  'travail',   9),
	('boulot',   'travail',  10),
	('sport',    'sport',    11),
	('salle',    'sport',    12)
ON CONFLICT DO NOTHING;
