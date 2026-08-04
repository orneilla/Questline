import "server-only";

import { eq, sql } from "drizzle-orm";
import webpush from "web-push";

import { db } from "@/db";
import { abonnementsPush, reglagesNotifications } from "@/db/schema";
import { aujourdhui } from "@/lib/dates";
import {
  DUREE_JETON_S,
  resoudreSujet,
  sujetValide,
  sujetVapid,
} from "./sujet";

/**
 * Envoi de notifications web.
 *
 * ── Où vivent les clés
 *
 * Le protocole VAPID demande une paire de clés qui identifie le serveur auprès
 * du service de push. Elles sont engendrées à la première demande et rangées en
 * base, pas dans l'environnement : Questline s'installe depuis un navigateur,
 * sans terminal, et faire recopier une clé privée dans Vercel serait
 * exactement le genre de manipulation qui échoue sans moyen de la déboguer.
 * Elles ne changent plus ensuite — les regénérer invaliderait tous les
 * abonnements existants.
 *
 * ── Ce qui ne doit jamais arriver
 *
 * Qu'un échec d'envoi fasse tomber quoi que ce soit. Un service de push
 * injoignable, un abonnement expiré, une permission révoquée depuis les
 * réglages du système : tout se solde par une trace sur la ligne concernée. Un
 * abonnement que le service déclare mort (404 ou 410) est retiré, parce que le
 * garder ferait échouer tous les envois suivants ; toute autre erreur est
 * consignée et l'abonnement conservé, une panne passagère n'étant pas une
 * désinscription.
 */

export type ChargePush = {
  titre: string;
  corps: string;
  /** Écran à ouvrir au toucher. Jamais l'accueil par défaut d'un navigateur. */
  url: string;
  /** Regroupe les rappels d'un même créneau : le second remplace le premier. */
  etiquette: string;
};

export type ResultatEnvoi = {
  envoyes: number;
  retires: number;
  echecs: { endpoint: string; raison: string }[];
};

/**
 * Rend la paire de clés, en l'engendrant à la première demande.
 *
 * L'écriture est conditionnelle : deux appels concurrents ne peuvent pas poser
 * deux paires différentes, le second verra celle du premier.
 */
export async function clesVapid(): Promise<{ publique: string; privee: string }> {
  const [existant] = await db
    .select()
    .from(reglagesNotifications)
    .where(eq(reglagesNotifications.id, 1))
    .limit(1);

  if (existant?.vapidPublique && existant.vapidPrivee) {
    return { publique: existant.vapidPublique, privee: existant.vapidPrivee };
  }

  const paire = webpush.generateVAPIDKeys();

  await db
    .insert(reglagesNotifications)
    .values({
      id: 1,
      vapidPublique: paire.publicKey,
      vapidPrivee: paire.privateKey,
      premiereOuverture: aujourdhui(),
    })
    .onConflictDoUpdate({
      target: reglagesNotifications.id,
      set: {
        vapidPublique: sql`coalesce(${reglagesNotifications.vapidPublique}, ${paire.publicKey})`,
        vapidPrivee: sql`coalesce(${reglagesNotifications.vapidPrivee}, ${paire.privateKey})`,
      },
    });

  const [relu] = await db
    .select()
    .from(reglagesNotifications)
    .where(eq(reglagesNotifications.id, 1))
    .limit(1);

  return {
    publique: relu?.vapidPublique ?? paire.publicKey,
    privee: relu?.vapidPrivee ?? paire.privateKey,
  };
}

/** La clé publique seule, celle que le navigateur doit connaître pour s'abonner. */
export async function clePubliqueVapid(): Promise<string> {
  return (await clesVapid()).publique;
}

/**
 * Ce que le diagnostic peut montrer d'une configuration VAPID.
 *
 * La clé privée n'en sort jamais. La clé publique, elle, est publique par
 * construction — c'est celle que le navigateur reçoit pour s'abonner — mais on
 * n'en donne que le début : assez pour la comparer à celle de l'abonnement,
 * pas assez pour encombrer l'écran.
 */
export type EtatVapid = {
  sujet: string;
  sujetValide: boolean;
  /** D'où vient le sujet retenu, pour savoir quoi corriger. */
  origineSujet: string;
  dureeHeures: number;
  clePubliqueDebut: string;
  clesInstallees: boolean;
};

export async function etatVapid(): Promise<EtatVapid> {
  const [ligne] = await db
    .select({
      publique: reglagesNotifications.vapidPublique,
      privee: reglagesNotifications.vapidPrivee,
    })
    .from(reglagesNotifications)
    .where(eq(reglagesNotifications.id, 1))
    .limit(1);

  const { sujet, origine } = resoudreSujet();

  return {
    sujet,
    sujetValide: sujetValide(sujet),
    origineSujet: origine,
    dureeHeures: DUREE_JETON_S / 3600,
    clePubliqueDebut: ligne?.publique ? ligne.publique.slice(0, 12) : "—",
    clesInstallees: Boolean(ligne?.publique && ligne.privee),
  };
}

export type AbonnementRecu = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export function abonnementValide(valeur: unknown): valeur is AbonnementRecu {
  const a = valeur as AbonnementRecu;
  return (
    typeof valeur === "object" &&
    valeur !== null &&
    typeof a.endpoint === "string" &&
    a.endpoint.startsWith("https://") &&
    typeof a.keys?.p256dh === "string" &&
    typeof a.keys?.auth === "string"
  );
}

export async function enregistrerAbonnement(
  abonnement: AbonnementRecu,
  agent: string,
  remplace?: string | null,
): Promise<void> {
  // Un renouvellement remplace l'ancien point de terminaison plutôt que d'en
  // laisser un mort derrière lui.
  if (remplace && remplace !== abonnement.endpoint) {
    await db.delete(abonnementsPush).where(eq(abonnementsPush.endpoint, remplace));
  }

  await db
    .insert(abonnementsPush)
    .values({
      endpoint: abonnement.endpoint,
      p256dh: abonnement.keys.p256dh,
      auth: abonnement.keys.auth,
      agent: agent.slice(0, 200),
      creeLe: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: abonnementsPush.endpoint,
      set: {
        p256dh: abonnement.keys.p256dh,
        auth: abonnement.keys.auth,
        agent: agent.slice(0, 200),
        derniereErreur: null,
      },
    });
}

export async function retirerAbonnement(endpoint: string): Promise<void> {
  await db.delete(abonnementsPush).where(eq(abonnementsPush.endpoint, endpoint));
}

export async function abonnements() {
  return db.select().from(abonnementsPush).orderBy(abonnementsPush.id);
}

/**
 * Envoie une charge à tous les appareils abonnés.
 *
 * Chaque appareil est traité pour lui-même : l'échec de l'un n'empêche pas les
 * autres, et le compte rendu dit précisément ce que le service a répondu — pas
 * « erreur », mais son code et son texte.
 */
export async function envoyerPush(charge: ChargePush): Promise<ResultatEnvoi> {
  const liste = await abonnements();
  if (liste.length === 0) {
    return { envoyes: 0, retires: 0, echecs: [] };
  }

  const cles = await clesVapid();
  webpush.setVapidDetails(sujetVapid(), cles.publique, cles.privee);

  const resultat: ResultatEnvoi = { envoyes: 0, retires: 0, echecs: [] };
  const quand = new Date().toISOString();

  for (const ligne of liste) {
    try {
      await webpush.sendNotification(
        {
          endpoint: ligne.endpoint,
          keys: { p256dh: ligne.p256dh, auth: ligne.auth },
        },
        JSON.stringify(charge),
        { TTL: 60 * 60 * 12 },
      );

      resultat.envoyes += 1;
      await db
        .update(abonnementsPush)
        .set({ dernierEnvoi: quand, derniereErreur: null })
        .where(eq(abonnementsPush.id, ligne.id));
    } catch (erreur) {
      const statut = (erreur as { statusCode?: number }).statusCode;
      const corps = (erreur as { body?: string }).body;
      const raison =
        `${statut ?? "?"} ${corps ?? (erreur instanceof Error ? erreur.message : String(erreur))}`
          .trim()
          .slice(0, 300);

      resultat.echecs.push({ endpoint: ligne.endpoint, raison });

      // 404 et 410 sont les deux façons dont un service de push dit « cet
      // appareil ne reviendra pas ». Le garder ferait échouer chaque envoi.
      if (statut === 404 || statut === 410) {
        await db.delete(abonnementsPush).where(eq(abonnementsPush.id, ligne.id));
        resultat.retires += 1;
      } else {
        await db
          .update(abonnementsPush)
          .set({ derniereErreur: `${quand} — ${raison}` })
          .where(eq(abonnementsPush.id, ligne.id));
      }
    }
  }

  return resultat;
}

export { DUREE_JETON_S, sujetValide, sujetVapid } from "./sujet";
