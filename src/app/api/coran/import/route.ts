import {
  cloreEdition,
  couvertureSens,
  ecrireMorphologie,
  ecrireSens,
  ecrireTraduction,
  preparerEdition,
  type BilanLot,
} from "@/lib/coran/televersement";
import type {
  EntreeMorphologie,
  EntreeMot,
  EntreeVerset,
} from "@/lib/coran/ressources";

/**
 * Réception d'un lot de ressource téléversée.
 *
 * Le fichier est lu et découpé dans le navigateur ; cette route ne voit jamais
 * que des lots de quelques centaines d'entrées déjà normalisées. C'est
 * délibéré : plusieurs mégaoctets ne passent pas dans une requête serverless, et
 * un lot court ne peut pas dépasser la limite de temps.
 *
 * Ce qui arrive ici n'est pas cru pour autant. Chaque entrée est revalidée —
 * bornes de sourate, de verset, de position, texte non vide — et l'alignement
 * sur le texte de Tanzil est vérifié en base avant la moindre écriture.
 *
 * Elle reste derrière la garde de session, comme le reste de `/api/coran`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOTAL_SOURATES = 114;
const VERSETS_MAX = 286;
const MOTS_MAX = 200;

function positionValide(sourate: unknown, verset: unknown): boolean {
  return (
    Number.isInteger(sourate) &&
    (sourate as number) >= 1 &&
    (sourate as number) <= TOTAL_SOURATES &&
    Number.isInteger(verset) &&
    (verset as number) >= 1 &&
    (verset as number) <= VERSETS_MAX
  );
}

function motsValides(liste: unknown): EntreeMot[] {
  if (!Array.isArray(liste)) return [];
  return liste.filter((e): e is EntreeMot => {
    const m = e as EntreeMot;
    return (
      typeof e === "object" &&
      e !== null &&
      positionValide(m.sourate, m.verset) &&
      Number.isInteger(m.mot) &&
      m.mot >= 1 &&
      m.mot <= MOTS_MAX &&
      typeof m.valeur === "string" &&
      m.valeur.length > 0
    );
  });
}

function versetsValides(liste: unknown): EntreeVerset[] {
  if (!Array.isArray(liste)) return [];
  return liste.filter((e): e is EntreeVerset => {
    const v = e as EntreeVerset;
    return (
      typeof e === "object" &&
      e !== null &&
      positionValide(v.sourate, v.verset) &&
      typeof v.valeur === "string" &&
      v.valeur.length > 0
    );
  });
}

function morphologieValide(liste: unknown): EntreeMorphologie[] {
  if (!Array.isArray(liste)) return [];
  return liste.filter((e): e is EntreeMorphologie => {
    const m = e as EntreeMorphologie;
    return (
      typeof e === "object" &&
      e !== null &&
      positionValide(m.sourate, m.verset) &&
      Number.isInteger(m.mot) &&
      m.mot >= 1 &&
      m.mot <= MOTS_MAX &&
      Array.isArray(m.segments) &&
      m.segments.every((s) => typeof s === "string") &&
      typeof m.categorie === "string" &&
      typeof m.traits === "string"
    );
  });
}

function texte(valeur: unknown, defaut = ""): string {
  return typeof valeur === "string" && valeur.trim().length > 0 ? valeur.trim() : defaut;
}

export async function POST(requete: Request): Promise<Response> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return Response.json({ erreur: "Corps illisible." }, { status: 400 });
  }

  const {
    type,
    entrees,
    edition,
    clore,
  } = (corps ?? {}) as {
    type?: unknown;
    entrees?: unknown;
    edition?: unknown;
    clore?: unknown;
  };

  try {
    if (type === "mot_a_mot") {
      const valides = motsValides(entrees);
      const bilan = await ecrireSens(valides);
      return Response.json(await conclure(bilan, valides.length, entrees, clore === true));
    }

    if (type === "morphologie") {
      const valides = morphologieValide(entrees);
      const bilan = await ecrireMorphologie(valides);
      return Response.json(await conclure(bilan, valides.length, entrees, clore === true));
    }

    if (type === "traduction") {
      const meta = (edition ?? {}) as Record<string, unknown>;
      const cle = texte(meta.cle);
      if (!/^[a-z0-9._-]{3,60}$/.test(cle)) {
        return Response.json(
          { erreur: "Identifiant d'édition manquant ou mal formé." },
          { status: 400 },
        );
      }

      const nom = texte(meta.nom);
      const auteur = texte(meta.auteur);
      const licence = texte(meta.licence);
      if (!nom || !auteur || !licence) {
        return Response.json(
          {
            erreur:
              "Une traduction ne s'installe pas sans son nom, son traducteur et " +
              "ses conditions d'utilisation : chaque écran doit pouvoir les citer.",
          },
          { status: 400 },
        );
      }

      await preparerEdition({
        cle,
        langue: texte(meta.langue, "fr"),
        nom,
        auteur,
        licence,
        source: texte(meta.source, "Fichier déposé depuis l'appareil"),
      });

      const valides = versetsValides(entrees);
      const bilan = await ecrireTraduction(cle, valides);
      const reponse = await conclure(bilan, valides.length, entrees, clore === true);
      if (clore === true) {
        return Response.json({ ...reponse, versetsEdition: await cloreEdition(cle) });
      }
      return Response.json(reponse);
    }

    return Response.json(
      { erreur: `Type de ressource inconnu : ${String(type)}.` },
      { status: 400 },
    );
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    return Response.json({ erreur: message }, { status: 500 });
  }
}

/** Le bilan du lot, plus la couverture globale quand le dépôt se termine. */
async function conclure(
  bilan: BilanLot,
  valides: number,
  recues: unknown,
  clore: boolean,
): Promise<Record<string, unknown>> {
  const total = Array.isArray(recues) ? recues.length : 0;
  return {
    ...bilan,
    refusees: total - valides,
    couverture: clore ? await couvertureSens() : null,
  };
}
