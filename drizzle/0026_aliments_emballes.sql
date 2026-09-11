-- Les produits emballés entrent au catalogue.
--
-- Le schéma prévoyait déjà une source « manuel », mais aucun écran ne savait
-- créer une ligne : seul l'import Ciqual écrivait dans cette table. Le
-- catalogue ne contenait donc que des produits bruts, et une barre achetée
-- n'avait aucune façon d'être notée.
--
-- Trois colonnes manquaient pour qu'un emballage se recopie tel quel.

-- La marque distingue deux produits de même nom. Vide pour un produit brut.
ALTER TABLE "cuisine_aliments"
	ADD COLUMN IF NOT EXISTS "marque" text DEFAULT '' NOT NULL;--> statement-breakpoint

-- Le poids d'une portion, imprimé sur l'emballage.
--
-- Personne ne pèse une barre encore emballée : son poids est écrit dessus.
-- Le noter une fois évite d'avoir à le retrouver à chaque fois qu'on la note,
-- et laisse la pesée possible quand elle a un sens. Nul pour un produit qui
-- se pèse vraiment — une pomme, de la farine.
ALTER TABLE "cuisine_aliments"
	ADD COLUMN IF NOT EXISTS "poids_portion_g" real;--> statement-breakpoint

-- Comment cette portion s'appelle : « barre », « pot », « tranche ».
-- Servira à écrire « 1 barre » plutôt que « 40 g » là où c'est plus clair.
ALTER TABLE "cuisine_aliments"
	ADD COLUMN IF NOT EXISTS "nom_portion" text DEFAULT '' NOT NULL;
