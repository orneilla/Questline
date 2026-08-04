import type { NextRequest } from "next/server";

import { aujourdhui } from "@/lib/dates";
import {
  chargerJour,
  definirModeBas,
  enregistrerPhrase,
  validerQuete,
  validerQueteRare,
} from "@/lib/jour";
import { cartesDues } from "@/lib/cartes/donnees";
import { mettreEnPause, reprendre } from "@/lib/notifications/reglages";
import { chargerTaches } from "@/lib/taches";
import { echapper, envoyer, remplacerBoutons, repondreAuBouton } from "@/lib/telegram/api";
import { composerMatin, messageDuMatin } from "@/lib/telegram/envoi";

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

/**
 * Les commandes du bot.
 *
 * Elles existent pour répondre sans ouvrir l'application — c'est tout leur
 * intérêt. Chacune fait exactement ce que son nom dit, et rend un compte rendu
 * court : le bot n'est pas un second écran, il est un rappel qui accepte
 * quelques réponses.
 *
 * Le salon a déjà été vérifié par l'appelant : personne d'autre n'arrive ici.
 */
async function traiterCommande(texte: string): Promise<void> {
  const [nom, ...reste] = texte.slice(1).split(/\s+/);
  const argument = reste.join(" ").trim();

  if (nom === "aujourdhui" || nom === "aujourd'hui") {
    const { texte: corps } = await composerMatin();
    await envoyer(corps);
    return;
  }

  if (nom === "fait") {
    const numero = Number(argument);
    const etat = await chargerJour();

    if (!Number.isInteger(numero) || numero < 1 || numero > etat.quetesDuJour.length) {
      await envoyer(
        etat.quetesDuJour.length === 0
          ? "Rien à cocher aujourd'hui."
          : `Numéro attendu entre 1 et ${etat.quetesDuJour.length}. Envoie /aujourdhui pour la liste.`,
      );
      return;
    }

    const quete = etat.quetesDuJour[numero - 1];
    await validerQuete(quete.id);
    await envoyer(`Validé : ${echapper(quete.titre)}.`);
    await rafraichirBoutons();
    return;
  }

  if (nom === "cartes") {
    const dues = await cartesDues();
    const taches = await chargerTaches();
    await envoyer(
      [
        dues === 0
          ? "Aucune carte due."
          : `${dues} carte${dues > 1 ? "s" : ""} à réviser.`,
        taches.ouvertes.length > 0
          ? `${taches.ouvertes.length} tâche${taches.ouvertes.length > 1 ? "s" : ""} ouverte${taches.ouvertes.length > 1 ? "s" : ""}.`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return;
  }

  if (nom === "pause") {
    // Sans argument, ou avec zéro, la pause est levée : c'est le geste
    // symétrique, et il doit être aussi simple que la poser.
    if (argument.length === 0 || Number(argument) === 0) {
      await reprendre();
      await envoyer("Rappels repris.");
      return;
    }

    const jours = Number(argument);
    if (!Number.isFinite(jours) || jours < 1) {
      await envoyer("Usage : /pause 3 — trois jours sans rappel. /pause 0 reprend.");
      return;
    }

    const jusqua = await mettreEnPause(jours);
    await envoyer(
      `Rappels en pause jusqu'au ${jusqua} inclus. Rien n'est désactivé, rien ne sera rattrapé.`,
    );
    return;
  }

  await envoyer(
    "Commandes : /aujourdhui, /fait &lt;numéro&gt;, /cartes, /pause &lt;jours&gt;.",
  );
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
      if (texte.startsWith("/")) {
        await traiterCommande(texte);
        return Response.json({ ok: true });
      }

      await enregistrerPhrase(texte);
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
