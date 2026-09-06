import type { NextRequest } from "next/server";

import { ecrireAliments } from "@/db/cuisine-import";
import type { AlimentLu } from "@/lib/cuisine/ciqual";

/**
 * Écriture d'un lot d'aliments, pour le dépôt depuis le navigateur.
 *
 * Le fichier Ciqual pèse des dizaines de mégaoctets : il est lu et découpé
 * dans la page, et n'arrive ici que par tranches. Une action serveur ne
 * conviendrait pas — sa limite de corps est bien plus basse que ce que même
 * une tranche peut peser.
 *
 * La route est sous la garde de session comme le reste de l'application ; elle
 * n'est pas dans les exceptions du middleware.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Au-delà, la requête devient plus lourde que ce que l'hébergement accepte. */
const LOT_MAX = 500;

function estAliment(valeur: unknown): valeur is AlimentLu {
  if (typeof valeur !== "object" || valeur === null) return false;
  const objet = valeur as Record<string, unknown>;
  return (
    typeof objet.code === "string" &&
    typeof objet.nom === "string" &&
    typeof objet.categorie === "string" &&
    (objet.etat === "cru" || objet.etat === "cuit") &&
    typeof objet.valeurs === "object" &&
    objet.valeurs !== null
  );
}

export async function POST(requete: NextRequest): Promise<Response> {
  let charge: unknown;
  try {
    charge = await requete.json();
  } catch {
    return Response.json({ erreur: "Corps illisible." }, { status: 400 });
  }

  const brut = (charge as { aliments?: unknown })?.aliments;
  if (!Array.isArray(brut)) {
    return Response.json({ erreur: "« aliments » attendu." }, { status: 400 });
  }
  if (brut.length > LOT_MAX) {
    return Response.json(
      { erreur: `Lot trop gros : ${LOT_MAX} aliments au maximum.` },
      { status: 413 },
    );
  }

  const aliments = brut.filter(estAliment);
  if (aliments.length !== brut.length) {
    return Response.json({ erreur: "Un aliment du lot est mal formé." }, { status: 400 });
  }

  try {
    const ecrits = await ecrireAliments(aliments);
    return Response.json({ ecrits });
  } catch (erreur) {
    return Response.json(
      { erreur: erreur instanceof Error ? erreur.message : String(erreur) },
      { status: 500 },
    );
  }
}
