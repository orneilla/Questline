/**
 * Authentification mono-utilisateur : un seul mot de passe (APP_PASSWORD),
 * puis un cookie signé valable 90 jours pour ne plus jamais y penser entre
 * le téléphone et la tablette.
 *
 * Tout passe par la Web Crypto API pour rester utilisable côté middleware
 * (runtime edge) comme côté serveur.
 */

export const NOM_COOKIE = "questline_session";
export const DUREE_SESSION_JOURS = 90;
const DUREE_SESSION_MS = DUREE_SESSION_JOURS * 24 * 60 * 60 * 1000;

const encodeur = new TextEncoder();

/**
 * Absent, il n'y a rien à signer. On renvoie null plutôt que de lever : le
 * middleware s'exécute sur chaque requête, et une exception y transformerait
 * une configuration incomplète en 500 opaque sur toute l'application. Sans
 * secret, aucune session ne peut être validée — la page de connexion prend le
 * relais et dit ce qui manque.
 */
function secret(): string | null {
  return process.env.SESSION_SECRET ?? process.env.APP_PASSWORD ?? null;
}

function base64url(octets: ArrayBuffer): string {
  let binaire = "";
  for (const octet of new Uint8Array(octets)) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signer(charge: string, cleSecrete: string): Promise<string> {
  const cle = await crypto.subtle.importKey(
    "raw",
    encodeur.encode(cleSecrete),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", cle, encodeur.encode(charge)));
}

async function empreinte(valeur: string): Promise<string> {
  return base64url(await crypto.subtle.digest("SHA-256", encodeur.encode(valeur)));
}

/** Comparaison à temps constant, sur des empreintes de longueur fixe. */
export async function egalConstant(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([empreinte(a), empreinte(b)]);
  if (ha.length !== hb.length) return false;
  let diff = 0;
  for (let i = 0; i < ha.length; i += 1) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

export async function motDePasseCorrect(saisi: string): Promise<boolean> {
  const attendu = process.env.APP_PASSWORD;
  if (!attendu) return false;
  return egalConstant(saisi, attendu);
}

/** Jeton = date d'expiration + signature HMAC de cette date. */
export async function creerJeton(maintenant: number = Date.now()): Promise<string> {
  const cleSecrete = secret();
  if (!cleSecrete) {
    throw new Error(
      "APP_PASSWORD (ou SESSION_SECRET) manquant : la session ne peut pas être signée.",
    );
  }
  const expiration = String(maintenant + DUREE_SESSION_MS);
  return `${expiration}.${await signer(expiration, cleSecrete)}`;
}

export async function jetonValide(
  jeton: string | undefined,
  maintenant: number = Date.now(),
): Promise<boolean> {
  const cleSecrete = secret();
  if (!cleSecrete) return false;
  if (!jeton) return false;
  const separateur = jeton.lastIndexOf(".");
  if (separateur <= 0) return false;

  const expiration = jeton.slice(0, separateur);
  const signature = jeton.slice(separateur + 1);
  if (!/^\d+$/.test(expiration)) return false;
  if (Number(expiration) < maintenant) return false;

  return egalConstant(signature, await signer(expiration, cleSecrete));
}

export const optionsCookie = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DUREE_SESSION_JOURS * 24 * 60 * 60,
} as const;
