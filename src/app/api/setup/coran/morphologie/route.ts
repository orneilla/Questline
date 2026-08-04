import type { NextRequest } from "next/server";

import { egalConstant } from "@/lib/auth";
import { importerMorphologie, poidsMorphologie } from "@/lib/coran/import";
import { CORPUS_MORPHOLOGIE } from "@/lib/coran/sources";

/**
 * Import de l'analyse mot à mot, depuis un navigateur.
 *
 * Même principe que le texte : par lots, avec une page qui se recharge d'elle-
 * même, et un avancement qui se lit dans la base plutôt que d'être stocké.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CLE_PAR_DEFAUT = "25afa9c6e7a8d65abf3f5e6f0b57ec8f";
const BUDGET_MS = 35_000;

function echapper(texte: string): string {
  return texte
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(corps: string, statut: number, rechargerVers?: string): Response {
  return new Response(
    `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${rechargerVers ? `<meta http-equiv="refresh" content="1; url=${echapper(rechargerVers)}">` : ""}
<title>Questline — Analyse mot à mot</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center;
    background: #0a0b0d; color: #ece9e3; padding: 2rem 1.75rem;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { width: 100%; max-width: 27rem; }
  h1 { font-family: ui-serif, Georgia, serif; font-weight: 400; font-size: 1.8rem; margin: 0 0 1rem; }
  p { color: #9299a2; line-height: 1.65; font-size: 0.95rem; margin: 0 0 0.9rem; }
  .barre { height: 6px; border-radius: 999px; background: #23272f; overflow: hidden; margin: 0.2rem 0 1.2rem; }
  .barre span { display: block; height: 100%; background: #c0996a; }
  a { display: flex; align-items: center; justify-content: center; min-height: 3.4rem;
      border: 1px solid #333942; background: #1a1e24; color: #ece9e3; border-radius: 1rem;
      text-decoration: none; font-size: 1.02rem; margin-top: 0.7rem; }
  code { color: #c2a567; overflow-wrap: anywhere; font-size: 0.9em; }
  .sourdine { color: #5d636b; font-size: 0.82rem; line-height: 1.6; }
</style>
</head>
<body><main>${corps}</main></body>
</html>`,
    { status: statut, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function poids(octets: number | null): string {
  if (octets === null) return "taille inconnue";
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export async function GET(requete: NextRequest): Promise<Response> {
  const attendue = process.env.SETUP_KEY ?? CLE_PAR_DEFAUT;
  const fournie = requete.nextUrl.searchParams.get("key") ?? "";

  if (!(await egalConstant(fournie, attendue))) {
    return page(`<h1>Clé invalide</h1><p>Rien n'a été touché.</p>`, 403);
  }

  const base = `/api/setup/coran/morphologie?key=${encodeURIComponent(fournie)}`;

  try {
    const avancement = await importerMorphologie(BUDGET_MS);
    const place = await poidsMorphologie();

    if (!avancement.fini) {
      const faites = 114 - avancement.restantes;
      return page(
        `<h1>Analyse mot à mot</h1>
         <p>${faites} sourates sur 114. La page reprend toute seule ; tu peux la laisser.</p>
         <div class="barre"><span style="width:${Math.round((100 * faites) / 114)}%"></span></div>
         <p class="sourdine">${echapper(avancement.detail)}<br>
            ${echapper(CORPUS_MORPHOLOGIE.nom)} — ${echapper(CORPUS_MORPHOLOGIE.auteur)}.</p>`,
        200,
        base,
      );
    }

    return page(
      `<h1>Analyse installée</h1>
       <p>${place.mots.toLocaleString("fr-FR")} mots analysés, ${poids(place.octets)} en base.</p>
       ${
         avancement.desalignes > 0
           ? `<p class="sourdine">${avancement.desalignes} verset(s) n'ont pas pu être alignés
              entre le corpus et le texte : ils ont été laissés sans analyse plutôt que
              d'attacher une racine au mauvais mot.</p>`
           : ""
       }
       <p class="sourdine">${echapper(CORPUS_MORPHOLOGIE.nom)} — ${echapper(CORPUS_MORPHOLOGIE.auteur)}.<br>
          ${echapper(CORPUS_MORPHOLOGIE.licence)}</p>
       <a href="/coran">Ouvrir le Coran</a>
       <a href="/coran/vocabulaire">Voir le vocabulaire</a>`,
      200,
    );
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    return page(
      `<h1>Import interrompu</h1>
       <p>Rien d'incomplet n'a été écrit. La source répond ceci :</p>
       <p><code>${echapper(message)}</code></p>
       <p>Le texte arabe doit être importé avant l'analyse : elle s'y aligne.</p>
       <a href="${base}">Réessayer</a>`,
      500,
    );
  }
}
