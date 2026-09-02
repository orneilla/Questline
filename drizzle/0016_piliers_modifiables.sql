-- Les piliers deviennent des lignes, pas un type figé.
--
-- Ils étaient un énuméré Postgres : six valeurs écrites dans le schéma, donc
-- impossibles à renommer, à recolorier, à réordonner, et surtout impossibles à
-- supprimer — Postgres ne sait pas retirer une valeur d'un énuméré sans
-- reconstruire le type. Ils vivent maintenant dans une table ordinaire.
--
-- Les six piliers d'origine y sont recopiés tels quels, avec leurs libellés et
-- leurs teintes actuelles : rien ne change à l'écran tant que rien n'est
-- modifié à la main.

CREATE TABLE IF NOT EXISTS "piliers" (
	"cle" text PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"couleur" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint

INSERT INTO "piliers" ("cle", "nom", "couleur", "ordre") VALUES
	('deen',   'Deen',   '#6fa396', 1),
	('corps',  'Corps',  '#8fa37e', 2),
	('table',  'Table',  '#c0826c', 3),
	('savoir', 'Savoir', '#7e92b8', 4),
	('oeuvre', 'Œuvre',  '#c2a567', 5),
	('seve',   'Sève',   '#9c8fb4', 6)
ON CONFLICT ("cle") DO NOTHING;
--> statement-breakpoint

-- Les colonnes quittent l'énuméré pour du texte. La conversion est directe :
-- la valeur écrite est déjà la clé.
ALTER TABLE "arcs" ALTER COLUMN "pilier" TYPE text USING "pilier"::text;--> statement-breakpoint
ALTER TABLE "momentum" ALTER COLUMN "pilier" TYPE text USING "pilier"::text;--> statement-breakpoint
ALTER TABLE "quetes_rares_faites" ALTER COLUMN "pilier" TYPE text USING "pilier"::text;--> statement-breakpoint
ALTER TABLE "taches" ALTER COLUMN "pilier" TYPE text USING "pilier"::text;--> statement-breakpoint

-- Une tâche perd seulement son étiquette quand le pilier disparaît : elle
-- existe par elle-même. Tout le reste n'existe que par lui et part avec.
ALTER TABLE "arcs" ADD CONSTRAINT "arcs_pilier_piliers_cle_fk"
	FOREIGN KEY ("pilier") REFERENCES "public"."piliers"("cle")
	ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "momentum" ADD CONSTRAINT "momentum_pilier_piliers_cle_fk"
	FOREIGN KEY ("pilier") REFERENCES "public"."piliers"("cle")
	ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quetes_rares_faites" ADD CONSTRAINT "quetes_rares_faites_pilier_piliers_cle_fk"
	FOREIGN KEY ("pilier") REFERENCES "public"."piliers"("cle")
	ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "taches" ADD CONSTRAINT "taches_pilier_piliers_cle_fk"
	FOREIGN KEY ("pilier") REFERENCES "public"."piliers"("cle")
	ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

DROP TYPE IF EXISTS "public"."pilier";
