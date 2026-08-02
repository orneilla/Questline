/**
 * Reconnaître les pannes d'installation pour les dire plutôt que planter.
 *
 * Une application qui affiche « a server-side exception has occurred » ne
 * laisse aucune prise. Ces deux cas-là sont prévisibles et méritent un écran
 * qui explique quoi faire.
 */

export type ProblemeInstallation = "base-absente" | "tables-absentes";

/** Code Postgres `undefined_table`. */
const TABLE_INCONNUE = "42P01";

function codePostgres(erreur: unknown): string | null {
  if (typeof erreur !== "object" || erreur === null) return null;
  const code = (erreur as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function texte(erreur: unknown): string {
  if (erreur instanceof Error) return `${erreur.message} ${erreur.cause ?? ""}`;
  return String(erreur);
}

/**
 * Renvoie le problème d'installation reconnu, ou null s'il s'agit d'autre
 * chose — auquel cas l'erreur doit continuer sa route.
 */
export function diagnostiquer(erreur: unknown): ProblemeInstallation | null {
  const message = texte(erreur);

  if (message.includes("DATABASE_URL manquante")) return "base-absente";

  if (codePostgres(erreur) === TABLE_INCONNUE) return "tables-absentes";
  if (message.includes(TABLE_INCONNUE)) return "tables-absentes";
  if (/relation .* does not exist/i.test(message)) return "tables-absentes";

  // La cause portée par une erreur enveloppée compte aussi.
  const cause = erreur instanceof Error ? erreur.cause : null;
  if (cause && cause !== erreur) return diagnostiquer(cause);

  return null;
}
