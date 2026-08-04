import {
  ecrireLotRestauration,
  etatActuel,
  resynchroniserSequences,
  viderPourRestauration,
} from "@/lib/sauvegardes";
import { estNomTable, type NomTable } from "@/lib/sauvegardes-partage";

/**
 * Restauration d'une sauvegarde, par lots.
 *
 * Le fichier fait plusieurs mégaoctets : il ne passe ni dans une action serveur
 * — plafonnée à un mégaoctet — ni confortablement dans une requête serverless.
 * Il est donc lu et découpé dans le navigateur, et cette route ne voit jamais
 * que quelques centaines de lignes à la fois.
 *
 * Trois temps, dans cet ordre, commandés par le navigateur :
 * `etat` pour l'aperçu, `vider` une fois la restauration confirmée, puis
 * autant d'appels `ecrire` que nécessaire, et `clore` pour remettre les
 * séquences en place.
 *
 * Rien ici n'écrit avant que `vider` ait été demandé explicitement : ouvrir
 * l'aperçu ne touche jamais la base.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function nomsValides(valeur: unknown): NomTable[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter((n): n is NomTable => typeof n === "string" && estNomTable(n));
}

export async function POST(requete: Request): Promise<Response> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return Response.json({ erreur: "Corps illisible." }, { status: 400 });
  }

  const { action, tables, table, lignes } = (corps ?? {}) as {
    action?: unknown;
    tables?: unknown;
    table?: unknown;
    lignes?: unknown;
  };

  try {
    if (action === "etat") {
      return Response.json({ etat: await etatActuel() });
    }

    if (action === "vider") {
      const noms = nomsValides(tables);
      if (noms.length === 0) {
        return Response.json({ erreur: "Aucune table reconnue." }, { status: 400 });
      }
      await viderPourRestauration(noms);
      return Response.json({ videes: noms.length });
    }

    if (action === "ecrire") {
      if (typeof table !== "string" || !estNomTable(table)) {
        return Response.json(
          { erreur: `Table inconnue : ${String(table)}.` },
          { status: 400 },
        );
      }
      if (!Array.isArray(lignes)) {
        return Response.json({ erreur: "Lignes attendues." }, { status: 400 });
      }
      const ecrites = await ecrireLotRestauration(
        table,
        lignes as Record<string, unknown>[],
      );
      return Response.json({ ecrites });
    }

    if (action === "clore") {
      await resynchroniserSequences(nomsValides(tables));
      return Response.json({ ok: true });
    }

    return Response.json(
      { erreur: `Action inconnue : ${String(action)}.` },
      { status: 400 },
    );
  } catch (erreur) {
    return Response.json(
      { erreur: erreur instanceof Error ? erreur.message : String(erreur) },
      { status: 500 },
    );
  }
}
