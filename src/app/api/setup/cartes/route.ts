import type { NextRequest } from "next/server";

import { cartesExistent, semerCartes } from "@/db/catalogue-cartes";
import { egalConstant } from "@/lib/auth";

/**
 * Charge le jeu de cartes de test depuis un navigateur.
 *
 * Volontairement séparée de `/api/setup` : ce sont des données de démonstration,
 * elles n'ont rien à faire dans une installation neuve qu'on voudrait vierge.
 * Refuse de tourner si des cartes existent déjà — `&remplacer=1` passe outre,
 * et efface alors tout l'historique de révision.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Même clé que l'installation : une seule à retenir. */
const CLE_PAR_DEFAUT = "25afa9c6e7a8d65abf3f5e6f0b57ec8f";

function page(corps: string, statut: number): Response {
  return new Response(
    `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Questline — Cartes de test</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center;
    background: #0a0b0d; color: #ece9e3; padding: 2rem 1.75rem;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { width: 100%; max-width: 26rem; }
  h1 { font-family: ui-serif, Georgia, serif; font-weight: 400; font-size: 1.9rem; margin: 0 0 1rem; letter-spacing: -0.015em; }
  p { color: #9299a2; line-height: 1.65; font-size: 0.95rem; margin: 0 0 0.9rem; }
  ul { color: #9299a2; line-height: 1.7; font-size: 0.95rem; padding-left: 1.1rem; margin: 0 0 1.4rem; }
  a { display: flex; align-items: center; justify-content: center; min-height: 3.5rem;
      border: 1px solid #333942; background: #1a1e24; color: #ece9e3; border-radius: 1rem;
      text-decoration: none; font-size: 1.05rem; margin-top: 1rem; }
  code { color: #c2a567; overflow-wrap: anywhere; }
</style>
</head>
<body><main>${corps}</main></body>
</html>`,
    { status: statut, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function echapper(texte: string): string {
  return texte
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function GET(requete: NextRequest): Promise<Response> {
  const attendue = process.env.SETUP_KEY ?? CLE_PAR_DEFAUT;
  const fournie = requete.nextUrl.searchParams.get("key") ?? "";

  if (!(await egalConstant(fournie, attendue))) {
    return page(
      `<h1>Clé invalide</h1>
       <p>Cette adresse demande la clé d'installation. Rien n'a été touché.</p>`,
      403,
    );
  }

  const remplacer = requete.nextUrl.searchParams.get("remplacer") === "1";

  try {
    if ((await cartesExistent()) && !remplacer) {
      return page(
        `<h1>Des cartes existent déjà</h1>
         <p>Rien n'a été réécrit. Pour repartir du jeu de test et effacer tout
            l'historique de révision, ajoute <code>&amp;remplacer=1</code> à cette
            adresse.</p>
         <a href="/cartes">Ouvrir les paquets</a>`,
        200,
      );
    }

    const comptes = await semerCartes();

    return page(
      `<h1>Cartes chargées</h1>
       <ul>
         <li>${comptes.espaces} espaces</li>
         <li>${comptes.paquets} paquets</li>
         <li>${comptes.cartes} cartes</li>
         <li>${comptes.revisions} révisions d'historique</li>
       </ul>
       <p>Les paquets sont à des stades de maturité différents : le jardin
          devrait être peuplé de plantes à tous les âges.</p>
       <a href="/cartes">Ouvrir les paquets</a>
       <a href="/jardin">Voir le jardin</a>`,
      200,
    );
  } catch (erreur) {
    return page(
      `<h1>Chargement en échec</h1>
       <p>La base répond ceci :</p>
       <p><code>${echapper(erreur instanceof Error ? erreur.message : String(erreur))}</code></p>
       <p>Si les tables du module cartes manquent, ouvre d'abord
          <code>/api/setup</code> avec la même clé.</p>`,
      500,
    );
  }
}
