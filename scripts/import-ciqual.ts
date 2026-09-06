/**
 * Charge la table Ciqual de l'Anses dans `cuisine_aliments`.
 *
 *   npm run cuisine:ciqual -- chemin/vers/ciqual.xml
 *   npm run cuisine:ciqual -- chemin/vers/ciqual.csv
 *
 * Le fichier n'est pas téléchargé : il se récupère à la main sur le site de
 * l'Anses (ciqual.anses.fr), en XML ou en CSV. Un classeur XLS doit d'abord
 * être réenregistré en CSV — le lecteur le dira s'il en reçoit un.
 *
 * Le script est rejouable : un aliment déjà importé est mis à jour, jamais
 * dupliqué. Relancer après une nouvelle édition Ciqual rafraîchit les teneurs.
 *
 * Sans ordinateur, la même opération se fait depuis un navigateur avec la
 * page /cuisine/ciqual — c'est elle qui sert au quotidien ici.
 */
import { readFileSync } from "node:fs";

import { importerCiqual } from "../src/db/cuisine-import";
import { LIBELLES_NUTRIMENTS } from "../src/lib/cuisine/ciqual";

async function importer(): Promise<void> {
  const chemin = process.argv[2];
  if (!chemin) {
    console.error("Chemin du fichier Ciqual attendu en argument.");
    process.exit(1);
  }

  const contenu = readFileSync(chemin, "utf8");
  const bilan = await importerCiqual(contenu);

  console.log(`Format reconnu : ${bilan.diagnostic.format}.`);
  console.log("");
  console.log("Colonnes associées :");
  for (const a of bilan.diagnostic.associations) {
    console.log(`  ${LIBELLES_NUTRIMENTS[a.nutriment]} → « ${a.libelle} »`);
  }

  if (bilan.diagnostic.absents.length > 0) {
    console.log("");
    console.log("Sans colonne — ces valeurs resteront vides :");
    for (const cle of bilan.diagnostic.absents) {
      console.log(`  ${LIBELLES_NUTRIMENTS[cle]}`);
    }
  }

  console.log("");
  console.log(
    `${bilan.ecrits} aliments écrits — ${bilan.nouveaux} nouveaux, ` +
      `${bilan.misAJour} mis à jour.`,
  );
  console.log(
    `${bilan.diagnostic.crus} rangés en cru, ${bilan.diagnostic.cuits} en cuit.`,
  );
}

importer()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exit(1);
  });
