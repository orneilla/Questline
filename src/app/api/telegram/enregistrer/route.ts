import type { NextRequest } from "next/server";

import { egalConstant } from "@/lib/auth";
import { configure, enregistrerWebhook } from "@/lib/telegram/api";

/**
 * Déclare le webhook auprès de Telegram, depuis un navigateur.
 *
 * L'adresse publique est déduite de la requête : pas de domaine à recopier à
 * la main. Le jeton partagé avec Telegram est CRON_SECRET, qu'il renverra
 * ensuite dans chaque appel.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(titre: string, corps: string, statut: number): Response {
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Questline — Webhook</title>
<style>
:root{color-scheme:dark}
body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;
background:#0a0b0d;color:#ece9e3;padding:2rem 1.75rem;
font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{width:100%;max-width:26rem}
h1{font-family:ui-serif,Georgia,serif;font-weight:400;font-size:1.9rem;margin:0 0 1rem}
p{color:#9299a2;line-height:1.65;font-size:.95rem;margin:0 0 .9rem}
code{color:#c2a567;overflow-wrap:anywhere}
</style></head><body><main><h1>${titre}</h1>${corps}</main></body></html>`,
    { status: statut, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(requete: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return page(
      "CRON_SECRET absent",
      "<p>Ajoute la variable <code>CRON_SECRET</code> dans Vercel, puis relance le déploiement.</p>",
      500,
    );
  }

  const fournie = requete.nextUrl.searchParams.get("key") ?? "";
  if (!(await egalConstant(fournie, secret))) {
    return page("Clé invalide", "<p>Cette adresse demande la clé. Rien n'a été touché.</p>", 403);
  }

  if (!configure()) {
    return page(
      "Bot non configuré",
      "<p>Il manque <code>TELEGRAM_BOT_TOKEN</code> ou <code>TELEGRAM_CHAT_ID</code> dans Vercel.</p>",
      500,
    );
  }

  // Telegram exige HTTPS. Derrière le proxy de Vercel, l'origine peut être
  // reconstruite en http : on impose le schéma, sauf en local.
  const origine = requete.nextUrl.origin;
  const local = origine.includes("localhost") || origine.includes("127.0.0.1");
  const url = `${local ? origine : origine.replace(/^http:/, "https:")}/api/telegram`;
  const ok = await enregistrerWebhook(url, secret);

  return ok
    ? page(
        "Webhook enregistré",
        `<p>Telegram enverra désormais tes réponses et tes clics à :</p>
         <p><code>${url}</code></p>
         <p>Tu peux fermer cette page. Pour tester tout de suite, ouvre
            l'adresse du cron avec <code>?type=matin</code>.</p>`,
        200,
      )
    : page(
        "Telegram a refusé",
        `<p>L'enregistrement n'a pas abouti. Vérifie <code>TELEGRAM_BOT_TOKEN</code>
            dans Vercel — c'est la cause la plus fréquente.</p>`,
        502,
      );
}
