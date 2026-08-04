import { enregistrerSeance } from "@/lib/coran/donnees";

/**
 * Journalise une séance de lecture.
 *
 * Cette route existe parce qu'une action serveur ne survit pas au départ de la
 * page : la requête est annulée avec l'onglet, et la lecture qui vient d'avoir
 * lieu ne compterait pas. `navigator.sendBeacon` vise une URL, pas une action —
 * d'où ce point d'entrée, volontairement minuscule et sans réponse utile.
 *
 * Elle reste derrière la garde de session comme le reste de `/api/coran`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(requete: Request): Promise<Response> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const { numeros, secondes } = (corps ?? {}) as {
    numeros?: unknown;
    secondes?: unknown;
  };

  if (!Array.isArray(numeros) || numeros.length === 0) {
    return new Response(null, { status: 400 });
  }

  await enregistrerSeance({
    numeros: numeros.filter((n): n is number => Number.isInteger(n)),
    secondes: Number.isFinite(secondes) ? Math.max(0, Math.round(secondes as number)) : 0,
  });

  return new Response(null, { status: 204 });
}
