import { lireMedia } from "@/lib/cartes/edition";

/**
 * Sert une image de carte.
 *
 * La route reste derrière la garde de session : ces images sont des notes de
 * cours, elles n'ont pas à être publiques. Le contenu d'une image ne changeant
 * jamais — une modification crée une nouvelle entrée — elle est mise en cache
 * pour un an côté navigateur, ce qui rend les révisions instantanées hors ligne.
 */

export const runtime = "nodejs";

export async function GET(
  _requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexte.params;
  // L'adresse porte une extension — « 12.png » — qui n'a d'utilité que côté
  // navigateur : c'est elle qui décide de l'inversion des schémas au trait.
  const numero = Number.parseInt(id, 10);

  if (!Number.isInteger(numero) || numero < 1) {
    return new Response("Identifiant invalide", { status: 400 });
  }

  const media = await lireMedia(numero);
  if (!media) return new Response("Image introuvable", { status: 404 });

  return new Response(Buffer.from(media.donnees, "base64"), {
    headers: {
      "content-type": media.typeMime,
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
