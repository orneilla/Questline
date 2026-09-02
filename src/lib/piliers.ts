import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { arcs, momentum, piliers, quetes, quetesRaresFaites, taches, validations } from "@/db/schema";
import { aujourdhui } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";
import {
  clePropre,
  couleurValide,
  PILIERS_ORIGINE,
  type PilierAffiche,
} from "./piliers-partage";

/**
 * Les piliers, lus et écrits.
 *
 * Ils étaient un type énuméré du schéma ; ce sont maintenant des lignes. Tout
 * ce qui affichait « les six piliers » lit désormais cette table — et doit
 * accepter qu'il y en ait cinq, ou neuf.
 */

/**
 * La liste, dans l'ordre choisi.
 *
 * Ne lève jamais : appelée depuis la coque de l'application, une erreur ici
 * remplacerait l'écran d'installation par une page blanche. Une base
 * inaccessible rend donc les piliers d'origine, et les écrans qui savent
 * diagnostiquer le problème le diront eux-mêmes.
 */
export async function chargerPiliers(): Promise<PilierAffiche[]> {
  return (await etatPiliers()).liste;
}

/**
 * La liste, et si elle vient vraiment de la base.
 *
 * Le repli sur les piliers d'origine évite un écran vide, mais il ne doit pas
 * faire croire que tout va bien : tant que la table n'existe pas, les piliers
 * affichés ne sont modifiables ni supprimables, et l'écran doit le dire au
 * lieu de laisser un bouton échouer en silence.
 */
export type EtatPiliers = {
  liste: PilierAffiche[];
  /** Vrai tant que la migration n'a pas été appliquée. */
  tableAbsente: boolean;
};

export async function etatPiliers(): Promise<EtatPiliers> {
  try {
    const lignes = await db
      .select()
      .from(piliers)
      .orderBy(asc(piliers.ordre), asc(piliers.cle));

    return {
      liste: lignes.length > 0 ? lignes : PILIERS_ORIGINE,
      tableAbsente: false,
    };
  } catch (erreur) {
    // Une table manquante est un défaut d'installation, pas une panne : on le
    // signale. Toute autre erreur remonte, elle n'a rien à faire ici.
    if (diagnostiquer(erreur) === null) throw erreur;
    return { liste: PILIERS_ORIGINE, tableAbsente: true };
  }
}

/** Les clés existantes, pour valider une saisie. */
export async function clesPiliers(): Promise<string[]> {
  const liste = await chargerPiliers();
  return liste.map((p) => p.cle);
}

/* ──────────────────────────── Écriture ──────────────────────────── */

export type SaisiePilier = { nom: string; couleur: string };

/**
 * Crée un pilier, et sa ligne d'élan avec lui.
 *
 * Sans cette ligne, le pilier n'aurait pas d'élan tant qu'une journée ne
 * l'aurait pas créée : il apparaîtrait au jardin sans plante et dans le bilan
 * sans barre. On la pose donc tout de suite, à zéro.
 */
export async function creerPilier(saisie: SaisiePilier): Promise<string | null> {
  const nom = saisie.nom.trim().slice(0, 40);
  if (nom.length === 0) return null;
  if (!couleurValide(saisie.couleur)) return null;

  const base = clePropre(nom);
  if (base.length === 0) return null;

  const existantes = new Set(await clesPiliers());
  let cle = base;
  for (let n = 2; existantes.has(cle); n += 1) cle = `${base}_${n}`;

  const [dernier] = await db
    .select({ ordre: sql<number>`coalesce(max(${piliers.ordre}), 0)::int` })
    .from(piliers);

  await db.insert(piliers).values({
    cle,
    nom,
    couleur: saisie.couleur,
    ordre: Number(dernier?.ordre ?? 0) + 1,
  });

  await db
    .insert(momentum)
    .values({ pilier: cle, valeur: 0, majLe: aujourdhui() })
    .onConflictDoNothing();

  return cle;
}

/** Renomme et recolorie. La clé ne bouge pas : elle est portée ailleurs. */
export async function modifierPilier(
  cle: string,
  saisie: SaisiePilier,
): Promise<boolean> {
  const nom = saisie.nom.trim().slice(0, 40);
  if (nom.length === 0 || !couleurValide(saisie.couleur)) return false;

  const lignes = await db
    .update(piliers)
    .set({ nom, couleur: saisie.couleur })
    .where(eq(piliers.cle, cle))
    .returning({ cle: piliers.cle });

  return lignes.length > 0;
}

/** Range les piliers dans l'ordre donné. */
export async function reordonnerPiliers(cles: string[]): Promise<void> {
  for (const [rang, cle] of cles.entries()) {
    await db.update(piliers).set({ ordre: rang + 1 }).where(eq(piliers.cle, cle));
  }
}

/* ─────────────────────── Suppression d'un pilier ─────────────────────── */

export type PertePilier = {
  nom: string;
  arcs: number;
  quetes: number;
  validations: number;
  quetesRares: number;
  taches: number;
  /** Vrai si c'est le dernier : l'app ne tourne pas sans un seul pilier. */
  dernier: boolean;
};

/**
 * Ce qu'une suppression emporterait, compté avant de demander confirmation.
 *
 * Un pilier est plus lourd qu'un arc : il emmène tous ses arcs, et avec eux
 * leurs quêtes et leurs validations. Ces nombres sont la seule façon de mesurer
 * ce qu'on s'apprête à faire.
 */
export async function pertePilier(cle: string): Promise<PertePilier | null> {
  const [ligne] = await db
    .select({ nom: piliers.nom })
    .from(piliers)
    .where(eq(piliers.cle, cle))
    .limit(1);
  if (!ligne) return null;

  const compte = async (requete: Promise<{ combien: number }[]>) =>
    Number((await requete)[0]?.combien ?? 0);

  const [nbArcs, nbQuetes, nbValidations, nbRares, nbTaches, total] = await Promise.all([
    compte(
      db
        .select({ combien: sql<number>`count(*)::int` })
        .from(arcs)
        .where(eq(arcs.pilier, cle)),
    ),
    compte(
      db
        .select({ combien: sql<number>`count(*)::int` })
        .from(quetes)
        .innerJoin(arcs, eq(quetes.arcId, arcs.id))
        .where(eq(arcs.pilier, cle)),
    ),
    compte(
      db
        .select({ combien: sql<number>`count(*)::int` })
        .from(validations)
        .innerJoin(quetes, eq(validations.queteId, quetes.id))
        .innerJoin(arcs, eq(quetes.arcId, arcs.id))
        .where(eq(arcs.pilier, cle)),
    ),
    compte(
      db
        .select({ combien: sql<number>`count(*)::int` })
        .from(quetesRaresFaites)
        .where(eq(quetesRaresFaites.pilier, cle)),
    ),
    compte(
      db
        .select({ combien: sql<number>`count(*)::int` })
        .from(taches)
        .where(eq(taches.pilier, cle)),
    ),
    compte(db.select({ combien: sql<number>`count(*)::int` }).from(piliers)),
  ]);

  return {
    nom: ligne.nom,
    arcs: nbArcs,
    quetes: nbQuetes,
    validations: nbValidations,
    quetesRares: nbRares,
    taches: nbTaches,
    dernier: total <= 1,
  };
}

/**
 * Supprime un pilier et tout ce qui n'existe que par lui.
 *
 * Les arcs partent, et avec eux quêtes, validations, étapes et seuils ; la
 * ligne d'élan et les quêtes rares partent aussi. Les clés étrangères s'en
 * chargent en cascade. Les tâches, elles, survivent : elles perdent leur
 * étiquette et redeviennent des tâches libres — une course à faire n'appartient
 * pas au pilier qui la classait.
 *
 * Le dernier pilier ne se supprime pas : une app sans aucun pilier n'aurait
 * plus rien à proposer, et le refus est plus honnête qu'un écran vide.
 */
export async function supprimerPilier(cle: string): Promise<"fait" | "dernier" | "absent"> {
  const perte = await pertePilier(cle);
  if (!perte) return "absent";
  if (perte.dernier) return "dernier";

  await db.delete(piliers).where(eq(piliers.cle, cle));
  return "fait";
}
