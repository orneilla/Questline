/**
 * Charge le catalogue réel depuis un poste de développement.
 *
 *   npm run db:seed
 *
 * Le script refuse de tourner si le catalogue existe déjà, pour ne pas
 * effacer un historique de validations (les quêtes sont supprimées en
 * cascade). Pour le remplacer volontairement :
 *
 *   FORCE=1 npm run db:seed
 *
 * Sans ordinateur sous la main, la même installation se fait depuis un
 * navigateur avec la route /api/setup.
 */
import {
  catalogueExiste,
  effacerCatalogue,
  historiqueExiste,
  installerCatalogue,
} from "../src/db/catalogue";

async function seed() {
  const dejaPresent = await catalogueExiste();

  if (dejaPresent && process.env.FORCE !== "1") {
    console.error(
      "Le catalogue existe déjà. Relancer avec FORCE=1 pour le remplacer\n" +
        "(les validations rattachées aux quêtes actuelles seront supprimées).",
    );
    process.exit(1);
  }

  if (dejaPresent) {
    if (await historiqueExiste()) {
      console.warn("FORCE=1 : l'historique de validations est supprimé.");
    }
    await effacerCatalogue();
  }

  const comptes = await installerCatalogue();
  console.log(
    `${comptes.arcs} arcs, ${comptes.quetes} quêtes, ${comptes.creneaux} créneaux.`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  });
