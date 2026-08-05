import "server-only";

import { and, count, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import {
  arcs,
  momentum,
  quetes,
  quetesRaresFaites,
  seuilsArcs,
  taches,
  validations,
  type Pilier,
} from "@/db/schema";
import { PILIERS } from "@/lib/constantes";
import { aujourdhui } from "@/lib/dates";

/**
 * Remise à zéro de la vie courante : élan, quêtes validées, tâches faites.
 *
 * Écrite sur le même principe que celle du Coran. Trois choses distinctes, qui
 * s'effacent séparément, et rien d'autre ne bouge : ni les cartes, ni leur
 * historique de révision, ni la lecture du Coran, ni les arcs et les quêtes
 * eux-mêmes — seulement la trace de ce qui a été fait.
 *
 * Le momentum est par ailleurs conçu pour ne jamais retomber à zéro tout seul :
 * il s'érode, il ne casse pas. C'est exactement pourquoi cette porte de sortie
 * existe. Sortir d'une période de test, ou rouvrir un cycle, est une décision
 * explicite — jamais un effet de bord.
 */

/** Un pilier, ou tous. */
export type Portee = Pilier | null;

export type Choix = {
  /** L'élan des piliers : la valeur retombe à zéro, la ligne reste. */
  elan: boolean;
  /** Les validations de quêtes, les quêtes rares, les seuils d'arcs franchis. */
  quetes: boolean;
  /** Les tâches marquées faites. */
  taches: boolean;
};

/** Ce qui serait effacé. Compté avant de demander confirmation. */
export type Apercu = {
  piliers: number;
  validations: number;
  quetesRares: number;
  seuils: number;
  taches: number;
};

export type Bilan = Apercu;

function estPilier(valeur: string): valeur is Pilier {
  return (PILIERS as readonly string[]).includes(valeur);
}

/** Lit la portée demandée. Toute valeur qui ne désigne pas un pilier vaut « tous ». */
export function lirePortee(valeur: string): Portee {
  return estPilier(valeur) ? valeur : null;
}

/** Les identifiants d'arcs concernés. Null quand la portée est « tous les piliers ». */
async function arcsDuPilier(portee: Portee): Promise<number[] | null> {
  if (portee === null) return null;
  const lignes = await db.select({ id: arcs.id }).from(arcs).where(eq(arcs.pilier, portee));
  return lignes.map((l) => l.id);
}

/** Les quêtes de ces arcs. Null quand la portée est « tous les piliers ». */
async function quetesDuPilier(portee: Portee): Promise<number[] | null> {
  const ids = await arcsDuPilier(portee);
  if (ids === null) return null;
  if (ids.length === 0) return [];
  const lignes = await db
    .select({ id: quetes.id })
    .from(quetes)
    .where(inArray(quetes.arcId, ids));
  return lignes.map((l) => l.id);
}

/** Les tâches faites, dans la portée. Une tâche sans pilier n'entre que dans « tous ». */
function filtreTaches(portee: Portee) {
  return portee === null
    ? isNotNull(taches.faiteLe)
    : and(isNotNull(taches.faiteLe), eq(taches.pilier, portee));
}

/**
 * Compte ce qu'une remise à zéro effacerait, sans rien toucher.
 *
 * L'écran de confirmation affiche ces nombres : « ce qui sera effacé » doit
 * être une mesure, pas une formule vague.
 */
export async function apercuRemise(portee: Portee): Promise<Apercu> {
  const [idsQuetes, idsArcs] = await Promise.all([
    quetesDuPilier(portee),
    arcsDuPilier(portee),
  ]);

  const [piliers, nbValidations, nbRares, nbSeuils, nbTaches] = await Promise.all([
    db
      .select({ combien: count() })
      .from(momentum)
      .where(portee === null ? undefined : eq(momentum.pilier, portee))
      .then((r) => r[0]?.combien ?? 0),

    idsQuetes !== null && idsQuetes.length === 0
      ? Promise.resolve(0)
      : db
          .select({ combien: count() })
          .from(validations)
          .where(idsQuetes === null ? undefined : inArray(validations.queteId, idsQuetes))
          .then((r) => r[0]?.combien ?? 0),

    db
      .select({ combien: count() })
      .from(quetesRaresFaites)
      .where(portee === null ? undefined : eq(quetesRaresFaites.pilier, portee))
      .then((r) => r[0]?.combien ?? 0),

    idsArcs !== null && idsArcs.length === 0
      ? Promise.resolve(0)
      : db
          .select({ combien: count() })
          .from(seuilsArcs)
          .where(idsArcs === null ? undefined : inArray(seuilsArcs.arcId, idsArcs))
          .then((r) => r[0]?.combien ?? 0),

    db
      .select({ combien: count() })
      .from(taches)
      .where(filtreTaches(portee))
      .then((r) => r[0]?.combien ?? 0),
  ]);

  return {
    piliers,
    validations: nbValidations,
    quetesRares: nbRares,
    seuils: nbSeuils,
    taches: nbTaches,
  };
}

/**
 * Efface ce qui a été demandé, et rien de plus.
 *
 * Les lignes de momentum ne sont pas supprimées mais remises à zéro : la table
 * garde une ligne par pilier, et sa date de mise à jour repart d'aujourd'hui,
 * sans quoi une décroissance rétroactive s'appliquerait sur un zéro.
 */
export async function remettreVieAZero(
  portee: Portee,
  choix: Choix,
  date = aujourdhui(),
): Promise<Bilan> {
  const bilan: Bilan = {
    piliers: 0,
    validations: 0,
    quetesRares: 0,
    seuils: 0,
    taches: 0,
  };

  if (choix.elan) {
    const lignes = await db
      .update(momentum)
      .set({ valeur: 0, majLe: date })
      .where(portee === null ? undefined : eq(momentum.pilier, portee))
      .returning({ pilier: momentum.pilier });
    bilan.piliers = lignes.length;
  }

  if (choix.quetes) {
    const idsQuetes = await quetesDuPilier(portee);
    if (idsQuetes === null || idsQuetes.length > 0) {
      const effacees = await db
        .delete(validations)
        .where(idsQuetes === null ? undefined : inArray(validations.queteId, idsQuetes))
        .returning({ id: validations.id });
      bilan.validations = effacees.length;
    }

    const rares = await db
      .delete(quetesRaresFaites)
      .where(portee === null ? undefined : eq(quetesRaresFaites.pilier, portee))
      .returning({ date: quetesRaresFaites.date });
    bilan.quetesRares = rares.length;

    // Les seuils partent avec les validations : la progression d'un arc en
    // découle entièrement, et un seuil déjà consigné ne se réannoncerait pas.
    const idsArcs = await arcsDuPilier(portee);
    if (idsArcs === null || idsArcs.length > 0) {
      const seuils = await db
        .delete(seuilsArcs)
        .where(idsArcs === null ? undefined : inArray(seuilsArcs.arcId, idsArcs))
        .returning({ id: seuilsArcs.id });
      bilan.seuils = seuils.length;
    }
  }

  if (choix.taches) {
    const effacees = await db
      .delete(taches)
      .where(filtreTaches(portee))
      .returning({ id: taches.id });
    bilan.taches = effacees.length;
  }

  return bilan;
}
