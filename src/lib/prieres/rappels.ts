import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { messagesEnvoyes } from "@/db/schema";
import { aujourdhui, minutesLocales } from "@/lib/dates";
import { chargerReglagesRappels, enPause } from "@/lib/notifications/reglages";
import { envoyerPush } from "@/lib/notifications/push";
import { envoyer as envoyerTelegram, echapper } from "@/lib/telegram/api";
import { chargerReglagesPrieres, prieresDe, rappelsVoulus, reperesPour } from "./donnees";
import { fichePriere, formaterHeure, prieresDues, type ClePriere } from "./partage";

/**
 * Les rappels de prière.
 *
 * ── Le ton, qui n'est pas négociable
 *
 * Le message dit l'heure, et s'arrête là. « Maghrib — 20 h 14 ». Pas de
 * « n'oublie pas », pas de « tu n'as pas encore », pas de compte de ce qui
 * manque, pas de point d'exclamation. Un rappel qui reproche est un rappel
 * qu'on finit par couper, et une application n'a rien à dire sur ce sujet.
 *
 * Une prière déjà cochée ne déclenche aucun message : son heure est passée
 * pour de bon.
 *
 * ── Le rattrapage, et sa limite
 *
 * Le déclencheur planifié n'est pas ponctuel à la minute. La question posée
 * n'est donc pas « est-on à l'heure pile ? » mais « cette prière était-elle
 * entrée, et son message est-il déjà parti ? ». Un déclenchement en retard
 * envoie quand même, un doublon ne fait rien.
 *
 * Conséquence à dire franchement : la ponctualité du message dépend
 * entièrement de la fréquence à laquelle quelque chose appelle `/api/cron`.
 * Deux appels par jour donnent deux groupes de rattrapage, pas cinq rappels à
 * l'heure. Le code est prêt pour la minute ; c'est le déclencheur qui décide.
 *
 * ── Un garde-fou
 *
 * Rien n'est envoyé pour une prière entrée depuis trop longtemps — la borne
 * est `RETARD_MAX`, posée avec la logique de sélection. Recevoir
 * « Fajr — 06 h 12 » à midi n'aide personne, et rattraper cinq messages d'un
 * coup en pleine nuit serait pire que de n'en envoyer aucun.
 */

export type BilanRappelPriere = {
  priere: ClePriere;
  canal: "push" | "telegram";
  envoye: boolean;
  raison: string;
};

async function dejaEnvoye(date: string, cle: string): Promise<boolean> {
  const [ligne] = await db
    .select({ type: messagesEnvoyes.type })
    .from(messagesEnvoyes)
    .where(and(eq(messagesEnvoyes.date, date), eq(messagesEnvoyes.type, cle)))
    .limit(1);
  return Boolean(ligne);
}

async function consigner(date: string, cle: string): Promise<void> {
  await db
    .insert(messagesEnvoyes)
    .values({ date, type: cle, envoyeLe: new Date().toISOString(), messageId: null })
    .onConflictDoNothing();
}

/**
 * Envoie les rappels dus.
 *
 * Ne lève jamais : appelé depuis le déclencheur planifié, à côté d'autres
 * tâches qui ne doivent pas échouer parce qu'un envoi a échoué.
 */
export async function envoyerRappelsPrieres(options: { forcer?: boolean } = {}): Promise<{
  envoyes: BilanRappelPriere[];
  raison: string;
}> {
  try {
    const date = aujourdhui();
    const reglagesPrieres = await chargerReglagesPrieres();

    if (!reglagesPrieres.rappelsActifs && !options.forcer) {
      return { envoyes: [], raison: "rappels de prière éteints" };
    }

    const calcul = reperesPour(date, reglagesPrieres);
    if (!calcul) {
      return { envoyes: [], raison: "aucun lieu enregistré : les heures ne sont pas calculables" };
    }

    const rappels = await chargerReglagesRappels();
    if (!options.forcer && enPause(rappels, date)) {
      return { envoyes: [], raison: `en pause jusqu'au ${rappels.pauseJusqua}` };
    }

    const faites = await prieresDe(date);
    const voulues = options.forcer
      ? [...rappelsVoulus({ ...reglagesPrieres, rappelsActifs: true })]
      : rappelsVoulus(reglagesPrieres);

    const dues = options.forcer
      ? voulues.filter((c): c is ClePriere => Boolean(fichePriere(c))).slice(0, 1)
      : prieresDues(calcul.reperes, voulues, faites, minutesLocales());

    if (dues.length === 0) {
      return { envoyes: [], raison: "aucune prière due à cette minute" };
    }

    const versPush = rappels.canal === "push" || rappels.canal === "les_deux";
    const versTelegram = rappels.canal === "telegram" || rappels.canal === "les_deux";
    const bilans: BilanRappelPriere[] = [];

    for (const cle of dues) {
      const fiche = fichePriere(cle);
      if (!fiche) continue;
      const heure = formaterHeure(calcul.reperes[cle]);

      if (versPush) {
        const clef = `push:priere:${cle}`;
        if (!options.forcer && (await dejaEnvoye(date, clef))) {
          bilans.push({ priere: cle, canal: "push", envoye: false, raison: "déjà envoyé" });
        } else {
          const resultat = await envoyerPush({
            titre: fiche.nom,
            corps: heure,
            url: "/prieres",
            // Une étiquette par prière : le rappel du Dhuhr ne doit pas
            // remplacer celui de l'Asr sur l'écran verrouillé.
            etiquette: `questline-priere-${cle}`,
          });
          if (resultat.envoyes > 0 && !options.forcer) await consigner(date, clef);
          bilans.push({
            priere: cle,
            canal: "push",
            envoye: resultat.envoyes > 0,
            raison:
              resultat.envoyes > 0
                ? `${resultat.envoyes} appareil(s)`
                : (resultat.echecs[0]?.raison ?? "aucun appareil abonné"),
          });
        }
      }

      if (versTelegram) {
        const clef = `priere:${cle}`;
        if (!options.forcer && (await dejaEnvoye(date, clef))) {
          bilans.push({ priere: cle, canal: "telegram", envoye: false, raison: "déjà envoyé" });
        } else {
          const messageId = await envoyerTelegram(
            `<b>${echapper(fiche.nom)}</b> — ${echapper(heure)}`,
          );
          if (messageId !== null && !options.forcer) await consigner(date, clef);
          bilans.push({
            priere: cle,
            canal: "telegram",
            envoye: messageId !== null,
            raison: messageId !== null ? "envoyé" : "Telegram injoignable",
          });
        }
      }
    }

    return { envoyes: bilans, raison: `${dues.length} prière(s) entrée(s)` };
  } catch (erreur) {
    return {
      envoyes: [],
      raison: `interrompu : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    };
  }
}
