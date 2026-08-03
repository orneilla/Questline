import type { NextRequest } from "next/server";

import { aujourdhui, jourDeLaSemaine, minutesLocales } from "@/lib/dates";
import { envoyerMessage, type TypeMessage } from "@/lib/telegram/envoi";
import { creneauPour } from "@/lib/telegram/planning";
import { egalConstant } from "@/lib/auth";

/**
 * Déclencheur des messages Telegram.
 *
 * Vercel planifie ses tâches en UTC ; l'heure de Paris avance d'une ou deux
 * heures selon la saison. Plutôt que de deviner, on déclare dans vercel.json
 * les deux horaires UTC possibles pour chaque message, et c'est cette route
 * qui tranche : elle lit l'heure réelle de Paris et n'envoie que si le créneau
 * y correspond. Le doublon est absorbé par l'idempotence de l'envoi.
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

  const creneau = creneauPour(minutesLocales(), jourDeLaSemaine(aujourdhui()));
  if (!creneau) {
    return Response.json({
      envoye: false,
      raison: "hors créneau",
      heureParis: minutesLocales(),
    });
  }

  const resultat = await envoyerMessage(creneau.type);
  return Response.json({ type: creneau.type, ...resultat });
}
