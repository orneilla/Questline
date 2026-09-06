-- Module Cuisine — le journal figé ingrédient par ingrédient.
--
-- La 0020 figeait huit totaux. Ça ne suffit pas : corriger la fiche d'un
-- aliment — mise à jour Ciqual, rectification d'une saisie manuelle — ferait
-- bouger les entrées passées, et rien ne permettait de recalculer une entrée
-- sans repasser par la recette d'aujourd'hui.
--
-- L'instantané descend donc au niveau de l'ingrédient : son grammage, ses
-- teneurs pour 100 g telles qu'elles étaient, sa fiche et sa source. Une
-- entrée devient recalculable à partir d'elle seule.

ALTER TABLE "cuisine_journal"
	-- L'instantané : un objet par ingrédient, avec ses teneurs d'alors.
	ADD COLUMN IF NOT EXISTS "ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	-- Ce qu'il faut pour retrouver une part sans consulter la recette.
	ADD COLUMN IF NOT EXISTS "nb_portions" integer DEFAULT 1 NOT NULL,
	ADD COLUMN IF NOT EXISTS "poids_total_cuit_g" real,
	-- Grammes crus équivalents de ce qui a été mangé : sert à pondérer la
	-- couverture d'une semaine par le poids réel, pas par le nombre d'entrées.
	ADD COLUMN IF NOT EXISTS "poids_retenu_g" real,
	-- Part du poids couverte par une donnée non NULL, nutriment par nutriment.
	-- Un seul drapeau confondait « ingrédient sans fiche » et « fiche sans
	-- valeur pour ce nutriment » : l'énergie peut être juste et les fibres
	-- fausses, et rien ne le disait.
	ADD COLUMN IF NOT EXISTS "couverture" jsonb DEFAULT '{}'::jsonb NOT NULL,
	-- Une entrée corrigée après coup le dit.
	ADD COLUMN IF NOT EXISTS "date_modification" date,
	-- D'où vient l'entrée, dit explicitement. Le déduire des colonnes échouait
	-- sur le cas réel : une part théorique dont la recette a été supprimée n'a
	-- plus ni recette_id ni poids de portion, et passait pour un aliment seul.
	ADD COLUMN IF NOT EXISTS "origine" text DEFAULT 'recette' NOT NULL;--> statement-breakpoint

-- Les entrées écrites avant cette colonne : un aliment seul n'a jamais eu de
-- recette. La déduction est exacte pour elles, c'est plus tard qu'elle cesse
-- de l'être.
UPDATE "cuisine_journal"
	SET "origine" = 'aliment'
	WHERE "aliment_id" IS NOT NULL AND "recette_id" IS NULL;
