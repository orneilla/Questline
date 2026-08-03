/**
 * Charge le jeu de cartes de test depuis un poste de développement.
 *
 *   npm run db:seed-cartes
 *
 * Refuse de tourner si des cartes existent déjà ; FORCE=1 pour les remplacer.
 * Sans ordinateur, la même opération se fait depuis un navigateur avec la
 * route /api/setup/cartes.
 */
import { cartesExistent, semerCartes } from "../src/db/catalogue-cartes";

async function semer() {
  if ((await cartesExistent()) && process.env.FORCE !== "1") {
    console.error("Des cartes existent déjà. FORCE=1 pour les remplacer.");
    process.exit(1);
  }

  const comptes = await semerCartes();
  console.log(
    `${comptes.espaces} espaces, ${comptes.paquets} paquets, ` +
      `${comptes.cartes} cartes, ${comptes.revisions} révisions.`,
  );
}

semer()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  });
