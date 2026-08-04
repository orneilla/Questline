import {
  abonnementValide,
  enregistrerAbonnement,
  type AbonnementRecu,
} from "@/lib/notifications/push";

/**
 * Réception d'un abonnement.
 *
 * Appelée par l'écran des réglages après que le navigateur a accordé la
 * permission, et par le service worker quand il renouvelle un abonnement de
 * lui-même — d'où le champ `remplace`, qui porte l'ancien point de terminaison
 * à retirer.
 *
 * Derrière la garde de session comme le reste de `/api`, sauf `api/push` n'est
 * pas exclue du middleware : un abonnement ne s'enregistre que connecté.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(requete: Request): Promise<Response> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return Response.json({ erreur: "Corps illisible." }, { status: 400 });
  }

  const { abonnement, agent, remplace } = (corps ?? {}) as {
    abonnement?: unknown;
    agent?: unknown;
    remplace?: unknown;
  };

  if (!abonnementValide(abonnement)) {
    return Response.json(
      {
        erreur:
          "Abonnement incomplet : il manque le point de terminaison ou les clés " +
          "de chiffrement. Rien n'a été enregistré.",
      },
      { status: 400 },
    );
  }

  await enregistrerAbonnement(
    abonnement as AbonnementRecu,
    typeof agent === "string" ? agent : "",
    typeof remplace === "string" ? remplace : null,
  );

  return Response.json({ ok: true });
}
