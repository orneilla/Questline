import { contenuSauvegarde } from "@/lib/sauvegardes";

/**
 * Téléchargement d'une sauvegarde.
 *
 * Elle sort telle qu'elle a été écrite, sans être reconstruite : une sauvegarde
 * qu'il faudrait régénérer pour la lire n'en serait pas une.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero)) {
    return Response.json({ erreur: "Identifiant invalide." }, { status: 400 });
  }

  const contenu = await contenuSauvegarde(numero);
  if (contenu === null) {
    return Response.json({ erreur: "Sauvegarde introuvable." }, { status: 404 });
  }

  const horodatage = new Date().toISOString().slice(0, 10);
  return new Response(contenu, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="questline-${horodatage}.json"`,
    },
  });
}
