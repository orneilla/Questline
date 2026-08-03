/**
 * Accès à l'API Telegram.
 *
 * Règle unique et non négociable : rien de ce qui se passe ici ne doit faire
 * tomber l'application. Telegram indisponible, jeton absent, réseau coupé —
 * tout se solde par un `false` et une trace en journal. L'app fonctionne sans
 * le bot ; le bot n'est qu'un rappel.
 */

const BASE = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org/bot";

/** Au-delà, Telegram refuse le message. On tronque plutôt que d'échouer. */
const LIMITE_TEXTE = 4000;

export type Bouton = { texte: string; donnee: string };

export function configure(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

async function appeler(methode: string, corps: unknown): Promise<unknown | null> {
  const jeton = process.env.TELEGRAM_BOT_TOKEN;
  if (!jeton) {
    console.warn(`[telegram] ${methode} ignoré : TELEGRAM_BOT_TOKEN absent.`);
    return null;
  }

  try {
    const reponse = await fetch(`${BASE}${jeton}/${methode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corps),
      // Sans limite, un Telegram lent bloquerait la fonction jusqu'au timeout.
      signal: AbortSignal.timeout(10_000),
    });

    const donnees = (await reponse.json()) as { ok?: boolean; result?: unknown; description?: string };

    if (!reponse.ok || !donnees.ok) {
      console.warn(`[telegram] ${methode} refusé : ${donnees.description ?? reponse.status}`);
      return null;
    }

    return donnees.result ?? true;
  } catch (erreur) {
    console.warn(`[telegram] ${methode} injoignable :`, erreur);
    return null;
  }
}

/** Dispose les boutons deux par ligne, sauf le dernier s'il est seul. */
function clavier(boutons: Bouton[]) {
  const lignes: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < boutons.length; i += 2) {
    lignes.push(
      boutons.slice(i, i + 2).map((b) => ({ text: b.texte, callback_data: b.donnee })),
    );
  }
  return { inline_keyboard: lignes };
}

/** Renvoie l'identifiant du message envoyé, ou null si l'envoi a échoué. */
export async function envoyer(
  texte: string,
  boutons: Bouton[] = [],
): Promise<number | null> {
  const salon = process.env.TELEGRAM_CHAT_ID;
  if (!salon) {
    console.warn("[telegram] envoi ignoré : TELEGRAM_CHAT_ID absent.");
    return null;
  }

  const resultat = (await appeler("sendMessage", {
    chat_id: salon,
    text: texte.slice(0, LIMITE_TEXTE),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(boutons.length > 0 ? { reply_markup: clavier(boutons) } : {}),
  })) as { message_id?: number } | null;

  return resultat?.message_id ?? null;
}

/** Retire la petite horloge du bouton, avec un mot de confirmation. */
export async function repondreAuBouton(id: string, texte: string): Promise<void> {
  await appeler("answerCallbackQuery", { callback_query_id: id, text: texte });
}

/** Remplace les boutons d'un message déjà envoyé. */
export async function remplacerBoutons(
  messageId: number,
  boutons: Bouton[],
): Promise<void> {
  const salon = process.env.TELEGRAM_CHAT_ID;
  if (!salon) return;

  await appeler("editMessageReplyMarkup", {
    chat_id: salon,
    message_id: messageId,
    reply_markup: boutons.length > 0 ? clavier(boutons) : { inline_keyboard: [] },
  });
}

/**
 * Déclare l'adresse du webhook auprès de Telegram, en la protégeant par un
 * jeton que Telegram renverra dans chaque requête.
 */
export async function enregistrerWebhook(
  url: string,
  secret: string,
): Promise<boolean> {
  const resultat = await appeler("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  return resultat !== null;
}

export function echapper(texte: string): string {
  return texte
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
