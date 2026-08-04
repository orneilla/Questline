"use server";

import { revalidatePath } from "next/cache";

import type { Canal } from "@/db/schema";
import { envoyerCreneau } from "@/lib/notifications/envoi";
import { enregistrerReglagesRappels } from "@/lib/notifications/reglages";
import { configure } from "@/lib/telegram/api";

/**
 * Réglages et tests des rappels.
 *
 * Le test dit la réponse exacte du service, pas « erreur » : c'est tout
 * l'intérêt d'un diagnostic qu'on doit pouvoir mener depuis une tablette, sans
 * accès aux journaux du serveur.
 */

export type BilanTest = {
  reussi: boolean;
  detail: string;
  /** Détail par appareil ou par canal, tel que le service l'a rendu. */
  lignes: string[];
};

export async function actionReglagesRappels(modifs: {
  canal: Canal;
  matinActif: boolean;
  soirActif: boolean;
  heureMatin: number;
  heureSoir: number;
}): Promise<void> {
  await enregistrerReglagesRappels(modifs);
  revalidatePath("/reglages/notifications");
}

export async function actionTestCanal(quoi: "push" | "telegram"): Promise<BilanTest> {
  try {
    // On force : un test doit partir même si le rappel du jour est déjà passé.
    const bilan = await envoyerCreneau("matin", { forcer: true });

    if (quoi === "push") {
      const push = bilan.push;
      if (!push) {
        return {
          reussi: false,
          detail:
            "Le canal choisi n'inclut pas les notifications. Passe le canal sur " +
            "« Notifications » ou « Les deux », enregistre, puis retente.",
          lignes: [],
        };
      }
      return {
        reussi: push.envoye,
        detail: push.raison,
        lignes: [
          ...(push.detail?.echecs ?? []).map((e) => `${e.endpoint.slice(0, 60)}… → ${e.raison}`),
          ...(push.detail && push.detail.retires > 0
            ? [`${push.detail.retires} abonnement(s) expiré(s) retiré(s).`]
            : []),
        ],
      };
    }

    const telegram = bilan.telegram;
    if (!telegram) {
      return {
        reussi: false,
        detail:
          "Le canal choisi n'inclut pas Telegram. Passe le canal sur « Telegram » " +
          "ou « Les deux », enregistre, puis retente.",
        lignes: configure()
          ? []
          : ["TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquante dans Vercel."],
      };
    }

    return {
      reussi: telegram.envoye,
      detail: telegram.raison,
      lignes: configure()
        ? []
        : ["TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquante dans Vercel."],
    };
  } catch (erreur) {
    return {
      reussi: false,
      detail: erreur instanceof Error ? erreur.message : String(erreur),
      lignes: [],
    };
  }
}
