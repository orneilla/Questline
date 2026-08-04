import type { NextRequest } from "next/server";

import { egalConstant } from "@/lib/auth";
import { aujourdhui, jourDeLaSemaine, minutesLocales } from "@/lib/dates";
import { envoyerCreneau, type BilanCreneau } from "@/lib/notifications/envoi";
import { chargerReglagesRappels } from "@/lib/notifications/reglages";
import { sauvegardeHebdomadaire } from "@/lib/sauvegardes";
import { envoyerMessage } from "@/lib/telegram/envoi";
import { bilanDu, creneauxDus } from "@/lib/telegram/planning";

/**
 * Déclencheur des rappels et de la sauvegarde.
 *
 * Vercel planifie en UTC, et sur le palier gratuit sans garantie sur la minute
 * — une tâche annoncée à 6 h 30 peut partir n'importe quand dans l'heure, et il
 * n'y en a que deux. Cette route ne cherche donc pas un créneau exact : elle
 * lit l'heure réelle de Paris, prend tout ce qui était dû aujourd'hui et le
 * confie à l'envoi, qui n'en laisse partir qu'un par jour, par canal et par
 * créneau. Un déclenchement en retard rattrape, un doublon ne fait rien.
 *
 * Rien de ce qui suit ne doit faire échouer le reste : chaque étape est isolée
 * et son résultat rapporté dans la réponse. C'est cette réponse que l'écran de
 * diagnostic montre quand on demande un test.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function creneauDemande(valeur: string | null): "matin" | "soir" | null {
  return valeur === "matin" || valeur === "soir" ? valeur : null;
}

export async function GET(requete: NextRequest): Promise<Response> {
  const attendu = process.env.CRON_SECRET;
  if (!attendu) {
    return Response.json(
      {
        erreur:
          "CRON_SECRET absente de l'environnement. Aucun rappel ne peut partir " +
          "tant qu'elle n'est pas renseignée dans Vercel.",
      },
      { status: 500 },
    );
  }

  // Vercel signe ses appels par un en-tête ; l'appel manuel passe par ?key=.
  const entete = requete.headers.get("authorization") ?? "";
  const parEntete = await egalConstant(entete, `Bearer ${attendu}`);
  const parCle = await egalConstant(requete.nextUrl.searchParams.get("key") ?? "", attendu);

  if (!parEntete && !parCle) {
    return Response.json({ erreur: "clé invalide" }, { status: 403 });
  }

  const forcer = requete.nextUrl.searchParams.get("forcer") === "1";

  // Un créneau explicite court-circuite l'heure : c'est ce qui permet de
  // tester depuis le navigateur sans attendre.
  const force = creneauDemande(requete.nextUrl.searchParams.get("type"));
  if (force) {
    return Response.json(await envoyerCreneau(force, { forcer }));
  }

  const heureParis = minutesLocales();
  const jour = jourDeLaSemaine(aujourdhui());
  const reglages = await chargerReglagesRappels();

  const rappels: BilanCreneau[] = [];
  for (const creneau of creneauxDus(heureParis, {
    matin: reglages.heureMatin,
    soir: reglages.heureSoir,
  })) {
    rappels.push(await envoyerCreneau(creneau.type));
  }

  // Le bilan hebdomadaire n'existe que sur Telegram : c'est un texte long, qui
  // n'a rien à faire dans une notification.
  let bilan: unknown = null;
  const versTelegram = reglages.canal === "telegram" || reglages.canal === "les_deux";
  if (versTelegram && bilanDu(heureParis, jour, reglages.heureMatin)) {
    bilan = await envoyerMessage("bilan");
  }

  // La sauvegarde ne part qu'une fois par semaine ; la fonction s'en assure
  // elle-même en regardant la date de la dernière.
  let sauvegarde: unknown = null;
  try {
    sauvegarde = await sauvegardeHebdomadaire();
  } catch (erreur) {
    sauvegarde = {
      creee: false,
      raison: erreur instanceof Error ? erreur.message : String(erreur),
    };
  }

  return Response.json({ heureParis, rappels, bilan, sauvegarde });
}
