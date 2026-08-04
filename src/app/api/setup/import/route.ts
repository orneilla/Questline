import type { NextRequest } from "next/server";

import { egalConstant } from "@/lib/auth";

/**
 * Porte d'entrée du dépôt de ressources.
 *
 * Les autres routes d'installation servent leur propre page HTML : elles doivent
 * fonctionner avant que la base existe, donc sans session ni composant. Le dépôt
 * de fichier est d'une autre nature — il lit plusieurs mégaoctets dans le
 * navigateur, découpe, montre, puis écrit — et cela demande du vrai code
 * partagé avec le reste de l'app plutôt qu'un script recopié dans une chaîne.
 *
 * Cette route reste donc l'adresse à retenir, protégée par la même clé, et elle
 * conduit à l'écran de dépôt. Si la session a expiré, la redirection passe par
 * la page de connexion comme n'importe quel autre écran.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLE_PAR_DEFAUT = "25afa9c6e7a8d65abf3f5e6f0b57ec8f";
const DESTINATION = "/coran/televerser";

export async function GET(requete: NextRequest): Promise<Response> {
  const attendue = process.env.SETUP_KEY ?? CLE_PAR_DEFAUT;
  const fournie = requete.nextUrl.searchParams.get("key") ?? "";

  if (!(await egalConstant(fournie, attendue))) {
    return new Response(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Questline — Clé invalide</title>
<style>:root{color-scheme:dark}body{margin:0;min-height:100dvh;display:flex;align-items:center;
justify-content:center;background:#0a0b0d;color:#ece9e3;padding:2rem;
font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
h1{font-family:ui-serif,Georgia,serif;font-weight:400;font-size:1.8rem;margin:0 0 .8rem}
p{color:#9299a2;line-height:1.65;font-size:.95rem;margin:0}</style>
</head><body><main><h1>Clé invalide</h1><p>Rien n'a été touché.</p></main></body></html>`,
      { status: 403, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  const url = requete.nextUrl.clone();
  url.pathname = DESTINATION;
  url.search = "";
  return Response.redirect(url, 302);
}
