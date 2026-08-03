import type { NextRequest } from "next/server";

import { egalConstant } from "@/lib/auth";
import {
  etatImport,
  importerEdition,
  importerTexteArabe,
  poidsCoran,
  TOTAL_SOURATES,
  TOTAL_VERSETS,
} from "@/lib/coran/import";
import { EDITION_ARABE, editionProposee } from "@/lib/coran/sources";

/**
 * Import du Coran depuis un navigateur.
 *
 * Le travail est trop long pour une seule fonction serverless : la route
 * importe ce qu'elle peut dans le temps qui lui est accordé, puis rend une page
 * qui se recharge d'elle-même pour reprendre. Rien n'est perdu si l'onglet est
 * fermé — l'avancement se lit dans la base, pas dans un état de session — et
 * relancer une fois terminé ne réécrit rien.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CLE_PAR_DEFAUT = "25afa9c6e7a8d65abf3f5e6f0b57ec8f";

/** Marge sous `maxDuration` : le temps de rendre la page et de la servir. */
const BUDGET_MS = 40_000;

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
<title>Questline — Import du Coran</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center;
    background: #0a0b0d; color: #ece9e3; padding: 2rem 1.75rem;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { width: 100%; max-width: 27rem; }
  h1 { font-family: ui-serif, Georgia, serif; font-weight: 400; font-size: 1.8rem; margin: 0 0 1rem; letter-spacing: -0.015em; }
  p { color: #9299a2; line-height: 1.65; font-size: 0.95rem; margin: 0 0 0.9rem; }
  ul { color: #9299a2; line-height: 1.7; font-size: 0.95rem; padding-left: 1.1rem; margin: 0 0 1.2rem; }
  .barre { height: 6px; border-radius: 999px; background: #23272f; overflow: hidden; margin: 0.2rem 0 1.2rem; }
  .barre span { display: block; height: 100%; background: #6fa396; }
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

function barre(fait: number, total: number): string {
  const part = Math.min(100, Math.round((100 * fait) / Math.max(1, total)));
  return `<div class="barre"><span style="width:${part}%"></span></div>`;
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
    return page(
      `<h1>Clé invalide</h1><p>Cette adresse demande la clé d'installation. Rien n'a été touché.</p>`,
      403,
    );
  }

  const edition = requete.nextUrl.searchParams.get("edition");
  const base = `/api/setup/coran?key=${encodeURIComponent(fournie)}`;

  try {
    if (edition) {
      const proposee = editionProposee(edition);
      if (!proposee) {
        return page(
          `<h1>Édition inconnue</h1>
           <p>« ${echapper(edition)} » ne figure pas parmi les éditions dont la licence
              est documentée. Aucune édition n'est importée sans cela.</p>
           <a href="${base}">Revenir à l'import</a>`,
          400,
        );
      }

      const avancement = await importerEdition(edition, BUDGET_MS);
      const etat = await etatImport();
      const installee = etat.editions.find((e) => e.cle === edition);
      const fait = installee?.versets ?? 0;

      if (!avancement.fini) {
        return page(
          `<h1>${echapper(proposee.nom)}</h1>
           <p>${fait} versets sur ${TOTAL_VERSETS}. La page reprend toute seule.</p>
           ${barre(fait, TOTAL_VERSETS)}
           <p class="sourdine">${echapper(avancement.detail)}</p>`,
          200,
          `${base}&edition=${encodeURIComponent(edition)}`,
        );
      }

      const place = await poidsCoran();
      return page(
        `<h1>Édition installée</h1>
         <p>${echapper(proposee.nom)} — ${echapper(proposee.auteur)}, ${fait} versets.</p>
         <p class="sourdine">Source : ${echapper(proposee.source)}.<br>
            Conditions : ${echapper(proposee.licence)}</p>
         <p>Le module occupe ${poids(place.octets)} en base.</p>
         <a href="/coran">Ouvrir le Coran</a>
         <a href="${base}">Retour à l'import</a>`,
        200,
      );
    }

    const avancement = await importerTexteArabe(BUDGET_MS);
    const etat = await etatImport();

    if (!avancement.fini) {
      return page(
        `<h1>Import du texte</h1>
         <p>${etat.versetsArabe} versets sur ${TOTAL_VERSETS}, ${etat.sourates} sourates
            sur ${TOTAL_SOURATES}. La page reprend toute seule ; tu peux la laisser.</p>
         ${barre(etat.versetsArabe, TOTAL_VERSETS)}
         <p class="sourdine">${echapper(avancement.detail)}<br>
            Texte : ${echapper(EDITION_ARABE.riwaya)}, graphie ${echapper(EDITION_ARABE.graphie)}.
            ${echapper(EDITION_ARABE.source)}.</p>`,
        200,
        base,
      );
    }

    const place = await poidsCoran();
    const lignesEditions = etat.editions
      .map(
        (e) =>
          `<li>${echapper(e.nom)} — ${e.versets} versets${e.complete ? "" : " (incomplète)"}</li>`,
      )
      .join("");

    return page(
      `<h1>Texte arabe complet</h1>
       <p>${TOTAL_VERSETS} versets, ${TOTAL_SOURATES} sourates.</p>
       <p class="sourdine">${echapper(EDITION_ARABE.riwaya)}, graphie ${echapper(EDITION_ARABE.graphie)}.
          ${echapper(EDITION_ARABE.source)}.<br>
          ${echapper(EDITION_ARABE.licence)}</p>
       <p>Le module occupe ${poids(place.octets)} en base, sur les 512 Mo du palier gratuit.</p>
       ${lignesEditions ? `<p>Éditions installées :</p><ul>${lignesEditions}</ul>` : ""}
       <p>Les traductions et la translittération se choisissent depuis les réglages
          du module, après lecture de leurs conditions — elles ne sont pas importées
          d'office.</p>
       <a href="/coran">Ouvrir le Coran</a>
       <a href="/coran/reglages">Choisir une traduction</a>`,
      200,
    );
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    return page(
      `<h1>Import interrompu</h1>
       <p>Rien d'incomplet n'a été écrit. Voici ce qui s'est passé :</p>
       <p><code>${echapper(message)}</code></p>
       <p>Si les tables du module manquent, ouvre d'abord <code>/api/setup</code>
          avec la même clé. Sinon, relancer reprend là où l'import s'est arrêté.</p>
       <a href="${base}">Réessayer</a>`,
      500,
    );
  }
}
