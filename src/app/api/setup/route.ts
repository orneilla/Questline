import { migrate } from "drizzle-orm/neon-http/migrator";
import type { NextRequest } from "next/server";
import path from "node:path";

import { db } from "@/db";
import { catalogueExiste, installerCatalogue } from "@/db/catalogue";
import { egalConstant } from "@/lib/auth";

/**
 * Installation de la base depuis un navigateur.
 *
 * Applique les migrations en attente, puis écrit le catalogue si la base est
 * vierge. Rejouer l'adresse ne casse rien : les migrations déjà appliquées
 * sont ignorées, et le catalogue n'est écrit qu'une fois — un second appel se
 * contente de le dire.
 *
 * La route est volontairement hors de la garde de session (voir le matcher du
 * middleware) : elle doit être atteignable avant qu'aucune table n'existe.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Clé par défaut, remplaçable par la variable d'environnement SETUP_KEY.
 * Elle vit dans le dépôt pour rendre l'installation possible sans terminal ;
 * la route étant inerte une fois la base installée, sa fenêtre d'utilité est
 * courte. La définir dans Vercel la remplace aussitôt.
 */
const CLE_PAR_DEFAUT = "25afa9c6e7a8d65abf3f5e6f0b57ec8f";

function page(titre: string, corps: string, statut: number): Response {
  return new Response(
    `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Questline — Installation</title>
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
  a { display: block; min-height: 3.5rem; display: flex; align-items: center; justify-content: center;
      border: 1px solid #333942; background: #1a1e24; color: #ece9e3; border-radius: 1rem;
      text-decoration: none; font-size: 1.05rem; margin-top: 1.6rem; }
  code { color: #c2a567; font-size: 0.9em; overflow-wrap: anywhere; }
</style>
</head>
<body><main>${corps}</main></body>
</html>`,
    { status: statut, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(requete: NextRequest): Promise<Response> {
  const attendue = process.env.SETUP_KEY ?? CLE_PAR_DEFAUT;
  const fournie = requete.nextUrl.searchParams.get("key") ?? "";

  if (!(await egalConstant(fournie, attendue))) {
    return page(
      "Clé invalide",
      `<h1>Clé invalide</h1>
       <p>Cette adresse demande la clé d'installation. Sans elle, rien n'est touché.</p>`,
      403,
    );
  }

  try {
    // Les fichiers SQL voyagent avec la fonction grâce à outputFileTracingIncludes.
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  } catch (erreur) {
    return page(
      "Migrations en échec",
      `<h1>Migrations en échec</h1>
       <p>Les tables n'ont pas pu être créées. La base répond ceci :</p>
       <p><code>${echapper(message(erreur))}</code></p>
       <p>Vérifie que <code>DATABASE_URL</code> est bien renseignée dans Vercel,
          pour l'environnement Production comme pour Preview.</p>`,
      500,
    );
  }

  try {
    if (await catalogueExiste()) {
      return page(
        "Déjà installé",
        `<h1>Déjà installé</h1>
         <p>Les tables sont à jour et le catalogue est déjà en place. Rien n'a été
            réécrit — tes validations et ton momentum sont intacts.</p>
         <a href="/jour">Ouvrir Questline</a>`,
        200,
      );
    }

    const comptes = await installerCatalogue();

    return page(
      "Installation terminée",
      `<h1>Installation terminée</h1>
       <p>Les tables sont créées et le catalogue est chargé :</p>
       <ul>
         <li>${comptes.arcs} arcs</li>
         <li>${comptes.quetes} quêtes</li>
         <li>${comptes.creneaux} créneaux récurrents</li>
       </ul>
       <p>Les six piliers démarrent à zéro. Aucun historique n'a été inventé.</p>
       <a href="/jour">Ouvrir Questline</a>`,
      200,
    );
  } catch (erreur) {
    return page(
      "Chargement en échec",
      `<h1>Chargement en échec</h1>
       <p>Les tables existent, mais le catalogue n'a pas pu être écrit :</p>
       <p><code>${echapper(message(erreur))}</code></p>`,
      500,
    );
  }
}

function message(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}

function echapper(texte: string): string {
  return texte
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
