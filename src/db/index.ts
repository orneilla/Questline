import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type Base = ReturnType<typeof creer>;

function creer() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL manquante. Copier .env.example vers .env et renseigner l'URL Neon.",
    );
  }

  return drizzle(neon(url), { schema });
}

let instance: Base | null = null;

function base(): Base {
  instance ??= creer();
  return instance;
}

/**
 * Connexion paresseuse : elle n'est ouverte qu'à la première requête.
 *
 * Créer le client au chargement du module ferait échouer `next build` dès que
 * DATABASE_URL est absente de l'environnement de build — Next.js importe les
 * pages pour en collecter la configuration, même celles rendues à la demande.
 * L'absence d'URL doit se voir à l'exécution, pas casser la compilation.
 */
export const db = new Proxy({} as Base, {
  get(_cible, propriete) {
    const reelle = base();
    const valeur = Reflect.get(reelle, propriete, reelle);
    return typeof valeur === "function" ? valeur.bind(reelle) : valeur;
  },
});

export { schema };
