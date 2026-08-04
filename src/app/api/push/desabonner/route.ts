import { retirerAbonnement } from "@/lib/notifications/push";

/** Retire un abonnement. Appelée quand on coupe les notifications. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(requete: Request): Promise<Response> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return Response.json({ erreur: "Corps illisible." }, { status: 400 });
  }

  const { endpoint } = (corps ?? {}) as { endpoint?: unknown };
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return Response.json({ erreur: "Point de terminaison manquant." }, { status: 400 });
  }

  await retirerAbonnement(endpoint);
  return Response.json({ ok: true });
}
