-- Le suivi des cinq prières.
--
-- Volontairement à part. Rien ici ne référence les piliers, l'élan, les quêtes,
-- le journal ni les saisons, et rien là-bas ne lira ces tables : une prière
-- cochée ne se comptabilise nulle part ailleurs. C'est la condition posée pour
-- que ce suivi existe, et elle tient par la structure plutôt que par la
-- discipline de qui écrit le code ensuite.
--
-- Aucune colonne ne compte quoi que ce soit : pas de total, pas de série, pas
-- de report. Une ligne dans « prieres_faites » veut dire « celle-là, ce
-- jour-là ». Son absence ne veut rien dire de plus que l'absence.

CREATE TABLE IF NOT EXISTS "reglages_prieres" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	-- Nulles tant que le lieu n'est pas posé : sans lui, aucune heure ne peut
	-- être calculée, et l'écran doit le dire plutôt que d'afficher un horaire
	-- de nulle part.
	"latitude" double precision,
	"longitude" double precision,
	"lieu" text DEFAULT '' NOT NULL,
	"convention" text DEFAULT 'uoif' NOT NULL,
	"ecole_asr" text DEFAULT 'majorite' NOT NULL,
	"nuit_courte" text DEFAULT 'angle' NOT NULL,
	-- Corrections manuelles, en minutes, pour coller au calendrier de la
	-- mosquée. Un calcul astronomique et un calendrier imprimé diffèrent
	-- souvent d'une ou deux minutes ; c'est normal, et ça se rattrape ici.
	"decalage_fajr" integer DEFAULT 0 NOT NULL,
	"decalage_dhuhr" integer DEFAULT 0 NOT NULL,
	"decalage_asr" integer DEFAULT 0 NOT NULL,
	"decalage_maghrib" integer DEFAULT 0 NOT NULL,
	"decalage_isha" integer DEFAULT 0 NOT NULL,
	"rappel_fajr" boolean DEFAULT true NOT NULL,
	"rappel_dhuhr" boolean DEFAULT true NOT NULL,
	"rappel_asr" boolean DEFAULT true NOT NULL,
	"rappel_maghrib" boolean DEFAULT true NOT NULL,
	"rappel_isha" boolean DEFAULT true NOT NULL,
	-- Les rappels sont éteints au départ. Rien ne se met à sonner cinq fois par
	-- jour parce qu'une migration est passée : c'est un geste qui se demande.
	"rappels_actifs" boolean DEFAULT false NOT NULL
);--> statement-breakpoint

INSERT INTO "reglages_prieres" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "prieres_faites" (
	"date" date NOT NULL,
	"priere" text NOT NULL,
	"coche_le" text NOT NULL,
	CONSTRAINT "prieres_faites_pk" PRIMARY KEY ("date", "priere")
);--> statement-breakpoint

-- La lecture courante est « le mois en cours » : un index sur la date suffit.
CREATE INDEX IF NOT EXISTS "prieres_faites_date_idx" ON "prieres_faites" ("date");
