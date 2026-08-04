import { clePubliqueVapid } from "@/lib/notifications/push";

/**
 * La clé publique VAPID, que le navigateur doit connaître pour s'abonner.
 *
 * Elle est engendrée à la première demande et ne change plus : la regénérer
 * invaliderait tous les abonnements existants. La clé privée, elle, ne sort
 * jamais du serveur.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ cle: await clePubliqueVapid() });
  } catch (erreur) {
    return Response.json(
      { erreur: erreur instanceof Error ? erreur.message : String(erreur) },
      { status: 500 },
    );
  }
}
