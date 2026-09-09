-- L'origine des saisons, posée explicitement.
--
-- Jusqu'ici le numéro de saison se déduisait du premier jour présent dans le
-- journal. Conséquence : repartir à la saison 1 imposait d'effacer les jours,
-- donc les phrases du soir avec. Deux choses sans rapport se tenaient par la
-- même ficelle.
--
-- La date de départ devient un réglage. Le journal peut alors être conservé ou
-- effacé sans que cela déplace le compte des saisons, et inversement.

CREATE TABLE IF NOT EXISTS "reglages_parcours" (
	-- Une seule ligne, garantie par la contrainte : ce sont des réglages, pas
	-- une collection.
	"id" integer PRIMARY KEY NOT NULL DEFAULT 1 CHECK ("id" = 1),
	-- NULL = pas encore posée ; on retombe alors sur le premier jour du journal,
	-- ce qui préserve le comportement d'avant pour une base déjà en service.
	"origine_saisons" date
);--> statement-breakpoint

INSERT INTO "reglages_parcours" ("id") VALUES (1) ON CONFLICT DO NOTHING;
