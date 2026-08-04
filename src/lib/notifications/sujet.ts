/**
 * Le sujet du jeton VAPID — le champ `sub`. Logique pure, sans base ni réseau.
 *
 * ── Pourquoi ce fichier existe
 *
 * Il valait « mailto:questline@localhost », et Apple a répondu `403
 * BadJwtToken` sur tous les envois. Les services de Google et Mozilla acceptent
 * à peu près n'importe quoi dans ce champ ; Apple le valide vraiment, et
 * `localhost` n'est pas un domaine joignable. La spécification demande une
 * adresse `mailto:` ou une URL `https:` par laquelle l'exploitant du serveur
 * peut être contacté — ce n'était ni l'un ni l'autre.
 *
 * Tout le reste du jeton était correct, et l'est resté : ES256, signature de
 * 64 octets, base64url sans remplissage, expiration à douze heures — dans le
 * futur et sous les vingt-quatre heures qu'Apple tolère. Un test compare les
 * deux sujets sur un jeton réellement émis : seul le `sub` change.
 *
 * ── L'ordre de résolution
 *
 * Du plus explicite au plus déduit :
 *
 * 1. `VAPID_SUBJECT`, si elle est renseignée et valide ;
 * 2. le domaine de production que Vercel expose à l'exécution ;
 * 3. le domaine du déploiement courant ;
 * 4. le domaine de production connu, en dernier recours — sans quoi un
 *    environnement local n'aurait aucun sujet valide à présenter.
 *
 * Une valeur invalide n'est jamais retenue silencieusement : elle est écartée
 * au profit de la suivante, et l'écran de diagnostic montre celle qui sert.
 */

const DOMAINE_CONNU = "https://questline-six.vercel.app";

/** Un hôte que personne ne peut joindre depuis l'extérieur. */
function hoteInjoignable(hote: string): boolean {
  return (
    !hote.includes(".") ||
    hote.endsWith(".") ||
    /localhost$/i.test(hote) ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hote) ||
    /\.local$/i.test(hote) ||
    /\.internal$/i.test(hote)
  );
}

/**
 * Un sujet est acceptable s'il est joignable : un `mailto:` sur un vrai
 * domaine, ou une URL `https:` sur un vrai hôte. Ce sont exactement les
 * formes qu'Apple accepte.
 */
export function sujetValide(valeur: string): boolean {
  const propre = valeur.trim();

  if (propre.startsWith("mailto:")) {
    const [locale, domaine] = propre.slice(7).split("@");
    return (
      locale.length > 0 && domaine !== undefined && !hoteInjoignable(domaine)
    );
  }

  if (propre.startsWith("https://")) {
    try {
      return !hoteInjoignable(new URL(propre).hostname);
    } catch {
      return false;
    }
  }

  return false;
}

function domaineVers(brut: string | undefined): string | undefined {
  if (!brut) return undefined;
  const sansSchema = brut.trim().replace(/^https?:\/\//, "");
  return sansSchema.length > 0 ? `https://${sansSchema}` : undefined;
}

export type OrigineSujet =
  | "variable VAPID_SUBJECT"
  | "domaine du déploiement Vercel"
  | "domaine de production, par défaut";

export function resoudreSujet(environnement: NodeJS.ProcessEnv = process.env): {
  sujet: string;
  origine: OrigineSujet;
} {
  const explicite = environnement.VAPID_SUBJECT;
  if (explicite && sujetValide(explicite)) {
    return { sujet: explicite.trim(), origine: "variable VAPID_SUBJECT" };
  }

  for (const brut of [
    environnement.VERCEL_PROJECT_PRODUCTION_URL,
    environnement.VERCEL_URL,
  ]) {
    const candidat = domaineVers(brut);
    if (candidat && sujetValide(candidat)) {
      return { sujet: candidat, origine: "domaine du déploiement Vercel" };
    }
  }

  return { sujet: DOMAINE_CONNU, origine: "domaine de production, par défaut" };
}

export function sujetVapid(): string {
  return resoudreSujet().sujet;
}

/**
 * Durée de validité du jeton, en secondes.
 *
 * `web-push` la fixe lui-même à douze heures et n'expose pas de réglage : cette
 * constante recopie sa valeur pour que le diagnostic puisse l'afficher. Un test
 * la compare au jeton réellement émis — sans quoi elle pourrait mentir le jour
 * où la bibliothèque changerait d'avis.
 */
export const DUREE_JETON_S = 12 * 60 * 60;
