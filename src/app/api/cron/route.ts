import type { NextRequest } from "next/server";

import { aujourdhui, jourDeLaSemaine, minutesLocales } from "@/lib/dates";
import { envoyerMessage, type TypeMessage } from "@/lib/telegram/envoi";
import { creneauxDus } from "@/lib/telegram/planning";
import { egalConstant } from "@/lib/auth";

/**
 * Déclencheur des messages Telegram.
 *
 * Vercel planifie ses tâches en UTC, et sur le palier gratuit sans garantie sur
 * la minute — une tâche annoncée à 6 h 30 peut partir n'importe quand dans
 * l'heure. Cette route ne cherche donc pas à retrouver un créneau exact : elle
 * lit l'heure réelle de Paris, prend tous les messages dont l'heure est passée
 * aujourd'hui, et les confie à l'envoi, qui n'en laisse partir qu'un par jour
 * et par type. Un déclenchement en retard rattrape, un déclenchement en double
 * ne fait rien, et le passage à l'heure d'été ne demande aucun réglage.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function typeDemande(valeur: string | null): TypeMessage | null {
  return valeur === "matin" || valeur === "soir" || valeur === "bilan" ? valeur : null;
}

export async function GET(requete: NextRequest): Promise<Response> {
  const attendu = process.env.CRON_SECRET;
  if (!attendu) {
    return Response.json({ erreur: "CRON_SECRET absent" }, { status: 500 });
  }

  // Vercel signe ses appels par un en-tête ; l'appel manuel passe par ?key=.
  const entete = requete.headers.get("authorization") ?? "";
  const parEntete = await egalConstant(entete, `Bearer ${attendu}`);
  const parCle = await egalConstant(requete.nextUrl.searchParams.get("key") ?? "", attendu);

  if (!parEntete && !parCle) {
    return Response.json({ erreur: "clé invalide" }, { status: 403 });
  }

  // Un type explicite court-circuite le créneau : utile pour tester depuis le
  // navigateur sans attendre l'heure dite.
  const force = typeDemande(requete.nextUrl.searchParams.get("type"));
  if (force) {
    const resultat = await envoyerMessage(force, {
      forcer: requete.nextUrl.searchParams.get("forcer") === "1",
    });
    return Response.json({ type: force, ...resultat });
  }

  const heureParis = minutesLocales();
  const dus = creneauxDus(heureParis, jourDeLaSemaine(aujourdhui()));

  if (dus.length === 0) {
    return Response.json({ envoye: false, raison: "aucun message dû", heureParis });
  }

  // Un envoi qui échoue ne doit pas empêcher les suivants : chacun est tenté,
  // et le compte rendu dit ce qu'il est advenu de chacun.
  const resultats: Record<string, unknown>[] = [];
  for (const creneau of dus) {
    resultats.push({ type: creneau.type, ...(await envoyerMessage(creneau.type)) });
  }

  return Response.json({ heureParis, resultats });
}
