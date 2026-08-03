import type { NextRequest } from "next/server";

import { aujourdhui } from "@/lib/dates";
import {
  chargerJour,
  definirModeBas,
  enregistrerPhrase,
  validerQuete,
  validerQueteRare,
} from "@/lib/jour";
import { echapper, remplacerBoutons, repondreAuBouton } from "@/lib/telegram/api";
import { messageDuMatin } from "@/lib/telegram/envoi";

/**
 * Webhook Telegram.
 *
 * Reçoit deux choses : les clics sur les boutons du message du matin, et les
 * messages texte — traités comme la phrase du soir de la journée en cours.
 *
 * Toujours répondre 200. Un code d'erreur ferait retenter Telegram en boucle,
 * et un incident côté base deviendrait une avalanche de notifications.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Mise = {
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number | string } };
    from?: { id: number | string };
  };
  message?: {
    text?: string;
    chat: { id: number | string };
  };
};

function duBonSalon(id: number | string | undefined): boolean {
  const attendu = process.env.TELEGRAM_CHAT_ID;
  return Boolean(attendu && id !== undefined && String(id) === attendu);
}

/** Reconstruit les boutons du matin en retirant ce qui est déjà fait. */
async function rafraichirBoutons(): Promise<void> {
  const date = aujourdhui();
  const messageId = await messageDuMatin(date);
  if (messageId === null) return;

  const etat = await chargerJour();

  const boutons = etat.quetesDuJour.map((quete, index) => ({
    texte: `${index + 1} ✓`,
    donnee: `v:${quete.id}`,
  }));

  if (etat.queteRare && !etat.queteRareFaite) {
    boutons.push({ texte: "◇ ✓", donnee: "r" });
  }
  if (!etat.journee.modeBas) {
    boutons.push({ texte: "Jour bas", donnee: "b" });
  }

  await remplacerBoutons(messageId, boutons);
}

async function traiterClic(clic: NonNullable<Mise["callback_query"]>): Promise<void> {
  const donnee = clic.data ?? "";

  if (donnee === "b") {
    await definirModeBas(true);
    await repondreAuBouton(clic.id, "Jour bas. Une seule quête minimale.");
  } else if (donnee === "r") {
    await validerQueteRare();
    await repondreAuBouton(clic.id, "Noté. Elle comptait double.");
  } else if (donnee.startsWith("v:")) {
    const id = Number(donnee.slice(2));
    if (!Number.isInteger(id)) {
      await repondreAuBouton(clic.id, "Quête inconnue.");
      return;
    }
    await validerQuete(id);
    await repondreAuBouton(clic.id, "Validé.");
  } else {
    await repondreAuBouton(clic.id, "");
    return;
  }

  await rafraichirBoutons();
}

export async function POST(requete: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const fourni = requete.headers.get("x-telegram-bot-api-secret-token");

  // Telegram renvoie le jeton déclaré au moment du setWebhook.
  if (!secret || fourni !== secret) {
    return Response.json({ ok: true });
  }

  let mise: Mise;
  try {
    mise = (await requete.json()) as Mise;
  } catch {
    return Response.json({ ok: true });
  }

  try {
    if (mise.callback_query) {
      const salon = mise.callback_query.message?.chat.id ?? mise.callback_query.from?.id;
      if (duBonSalon(salon)) await traiterClic(mise.callback_query);
      return Response.json({ ok: true });
    }

    const texte = mise.message?.text?.trim();
    if (texte && duBonSalon(mise.message?.chat.id)) {
      // Les commandes ne sont pas des confidences.
      if (texte.startsWith("/")) return Response.json({ ok: true });

      await enregistrerPhrase(texte);
      const { envoyer } = await import("@/lib/telegram/api");
      await envoyer(
        `Noté comme phrase du soir :\n<i>${echapper(texte.slice(0, 200))}</i>`,
      );
    }
  } catch (erreur) {
    // On avale : Telegram ne doit jamais faire tomber quoi que ce soit.
    console.warn("[telegram] traitement du webhook interrompu :", erreur);
  }

  return Response.json({ ok: true });
}
