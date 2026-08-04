import "server-only";

import { count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { editionsCoran, motsCoran, textesVersets, versets } from "@/db/schema";
import { aujourdhui } from "@/lib/dates";
import { TOTAL_VERSETS } from "./import";
import type {
  EntreeMorphologie,
  EntreeMot,
  EntreeVerset,
} from "./ressources";

/**
 * Écriture d'une ressource déposée depuis le navigateur.
 *
 * Ce fichier applique une seule règle, et elle décide de tout le reste : rien
 * n'est écrit qui ne soit aligné sur le texte déjà en base.
 *
 * Le texte de référence est celui de Tanzil, importé verbatim. Un fichier
 * déposé numérote les mots d'un verset à sa façon ; si son compte ne tombe pas
 * exactement sur le compte de Tanzil, le verset entier est écarté. C'est
 * volontairement brutal : un décalage d'un seul mot mettrait le sens de « au
 * nom » sur « Allah », et un sens faux est pire qu'un sens absent. Un mot sans
 * correspondance reste donc sans sens, et le rapport final dit combien.
 *
 * Rien n'est complété non plus. Ce qui est écrit dans la colonne `sens` est la
 * chaîne reçue, sans retouche ; il n'existe nulle part ici de valeur par défaut,
 * de traduction de repli, ni de texte fabriqué.
 *
 * ── Sur le découpage en lots
 *
 * Les lots arrivent par requêtes séparées, un verset n'étant jamais coupé en
 * deux : c'est ce qui permet de vérifier son alignement. Chaque requête est
 * courte, donc aucune ne s'approche de la limite de Vercel, et tout est écrit en
 * `on conflict do update` — redéposer le même fichier ne fait pas de doublon et
 * peut reprendre là où l'on s'était arrêté.
 */

/** Ce qu'un lot a produit. */
export type BilanLot = {
  ecrits: number;
  /** Versets écartés parce que le compte de mots ne tombait pas. */
  versetsEcartes: number;
  /** Positions qui ne correspondent à aucun mot du texte en base. */
  sansCorrespondance: number;
};

const VIDE: BilanLot = { ecrits: 0, versetsEcartes: 0, sansCorrespondance: 0 };

/** Découpe un verset comme le fait le lecteur : sur les blancs, sans retouche. */
function motsDuVerset(texte: string): string[] {
  return texte.split(/\s+/).filter((m) => m.length > 0);
}

type VersetEnBase = { numero: number; mots: number };

/**
 * Retrouve les versets visés par un lot et leur compte de mots.
 *
 * La clé du fichier est `sourate:verset`, celle de la base un numéro global de
 * 1 à 6236 : c'est ici que les deux se rejoignent, et un verset absent de la
 * base n'a simplement pas de ligne en retour.
 */
async function versetsVises(
  positions: { sourate: number; verset: number }[],
): Promise<Map<string, VersetEnBase>> {
  if (positions.length === 0) return new Map();

  const couples = positions.map((p) => sql`(${p.sourate}, ${p.verset})`);
  const lignes = await db
    .select({
      numero: versets.numero,
      sourate: versets.sourate,
      numeroDansSourate: versets.numeroDansSourate,
      texte: versets.texte,
    })
    .from(versets)
    .where(
      sql`(${versets.sourate}, ${versets.numeroDansSourate}) in (${sql.join(couples, sql`, `)})`,
    );

  const trouves = new Map<string, VersetEnBase>();
  for (const ligne of lignes) {
    trouves.set(`${ligne.sourate}:${ligne.numeroDansSourate}`, {
      numero: ligne.numero,
      mots: motsDuVerset(ligne.texte).length,
    });
  }
  return trouves;
}

/** Regroupe des entrées par verset : l'alignement se vérifie verset par verset. */
function parVerset<T extends { sourate: number; verset: number }>(
  entrees: T[],
): Map<string, T[]> {
  const groupes = new Map<string, T[]>();
  for (const entree of entrees) {
    const cle = `${entree.sourate}:${entree.verset}`;
    const liste = groupes.get(cle);
    if (liste) liste.push(entree);
    else groupes.set(cle, [entree]);
  }
  return groupes;
}

/**
 * Un verset s'aligne si le fichier lui donne exactement autant de mots que le
 * texte, numérotés de 1 à N sans trou ni doublon. Toute autre situation est un
 * désalignement, et un désalignement fait écarter le verset.
 */
function aligne(mots: number[], attendus: number): boolean {
  if (mots.length !== attendus) return false;
  const vus = new Set(mots);
  if (vus.size !== attendus) return false;
  for (let i = 1; i <= attendus; i += 1) if (!vus.has(i)) return false;
  return true;
}

/* ──────────────────────── Traduction mot à mot ──────────────────────── */

/**
 * Écrit le sens des mots d'un lot.
 *
 * La ligne est créée si elle n'existe pas — une glose peut donc s'installer sans
 * que le corpus morphologique ait été importé, avec une analyse vide plutôt
 * qu'inventée. Si la ligne existe déjà, seule la colonne `sens` est touchée :
 * la racine et les traits viennent du corpus et ne sont pas à réécrire.
 */
export async function ecrireSens(entrees: EntreeMot[]): Promise<BilanLot> {
  if (entrees.length === 0) return VIDE;

  const groupes = parVerset(entrees);
  const trouves = await versetsVises(
    [...groupes.keys()].map((cle) => {
      const [sourate, verset] = cle.split(":").map(Number);
      return { sourate, verset };
    }),
  );

  const lignes: (typeof motsCoran.$inferInsert)[] = [];
  let versetsEcartes = 0;
  let sansCorrespondance = 0;

  for (const [cle, mots] of groupes) {
    const verset = trouves.get(cle);
    if (!verset) {
      // Le verset n'est pas en base : son texte n'a pas été importé.
      sansCorrespondance += mots.length;
      continue;
    }

    if (!aligne(mots.map((m) => m.mot), verset.mots)) {
      versetsEcartes += 1;
      sansCorrespondance += mots.length;
      continue;
    }

    for (const mot of mots) {
      lignes.push({
        versetNumero: verset.numero,
        sourate: mot.sourate,
        position: mot.mot,
        sens: mot.valeur,
      });
    }
  }

  for (let debut = 0; debut < lignes.length; debut += 200) {
    await db
      .insert(motsCoran)
      .values(lignes.slice(debut, debut + 200))
      .onConflictDoUpdate({
        target: [motsCoran.versetNumero, motsCoran.position],
        set: { sens: sql`excluded.sens` },
      });
  }

  return { ecrits: lignes.length, versetsEcartes, sansCorrespondance };
}

/* ──────────────────────────── Morphologie ──────────────────────────── */

/** Même garde-fou, pour une analyse déposée plutôt que téléchargée. */
export async function ecrireMorphologie(
  entrees: EntreeMorphologie[],
): Promise<BilanLot> {
  if (entrees.length === 0) return VIDE;

  const groupes = parVerset(entrees);
  const trouves = await versetsVises(
    [...groupes.keys()].map((cle) => {
      const [sourate, verset] = cle.split(":").map(Number);
      return { sourate, verset };
    }),
  );

  const lignes: (typeof motsCoran.$inferInsert)[] = [];
  let versetsEcartes = 0;
  let sansCorrespondance = 0;

  for (const [cle, mots] of groupes) {
    const verset = trouves.get(cle);
    if (!verset) {
      sansCorrespondance += mots.length;
      continue;
    }
    if (!aligne(mots.map((m) => m.mot), verset.mots)) {
      versetsEcartes += 1;
      sansCorrespondance += mots.length;
      continue;
    }

    for (const mot of mots) {
      lignes.push({
        versetNumero: verset.numero,
        sourate: mot.sourate,
        position: mot.mot,
        segments: mot.segments,
        racine: mot.racine,
        lemme: mot.lemme,
        categorie: mot.categorie,
        traits: mot.traits,
      });
    }
  }

  for (let debut = 0; debut < lignes.length; debut += 200) {
    await db
      .insert(motsCoran)
      .values(lignes.slice(debut, debut + 200))
      .onConflictDoUpdate({
        target: [motsCoran.versetNumero, motsCoran.position],
        // Le sens n'est pas touché : il vient d'une autre ressource.
        set: {
          segments: sql`excluded.segments`,
          racine: sql`excluded.racine`,
          lemme: sql`excluded.lemme`,
          categorie: sql`excluded.categorie`,
          traits: sql`excluded.traits`,
        },
      });
  }

  return { ecrits: lignes.length, versetsEcartes, sansCorrespondance };
}

/* ────────────────────── Traduction de versets ────────────────────── */

/**
 * Ce qu'il faut savoir d'une traduction avant de l'écrire.
 *
 * Ces champs ne sont pas décoratifs : la règle du module est que chaque écran
 * nomme ses sources. Une traduction dont on ne sait pas dire qui l'a faite ni
 * sous quelles conditions n'a pas à entrer en base, et c'est le formulaire de
 * téléversement qui les demande — rien n'est déduit du nom du fichier.
 */
export type MetaEdition = {
  cle: string;
  langue: string;
  nom: string;
  auteur: string;
  licence: string;
  source: string;
};

export async function preparerEdition(meta: MetaEdition): Promise<void> {
  await db
    .insert(editionsCoran)
    .values({
      cle: meta.cle,
      langue: meta.langue,
      nom: meta.nom,
      auteur: meta.auteur,
      type: "traduction",
      source: meta.source,
      licence: meta.licence,
      versets: 0,
    })
    .onConflictDoUpdate({
      target: editionsCoran.cle,
      set: {
        nom: meta.nom,
        auteur: meta.auteur,
        source: meta.source,
        licence: meta.licence,
      },
    });
}

export async function ecrireTraduction(
  cle: string,
  entrees: EntreeVerset[],
): Promise<BilanLot> {
  if (entrees.length === 0) return VIDE;

  const trouves = await versetsVises(entrees);
  const lignes = entrees
    .map((e) => ({
      editionCle: cle,
      numero: trouves.get(`${e.sourate}:${e.verset}`)?.numero,
      texte: e.valeur,
    }))
    .filter((l): l is { editionCle: string; numero: number; texte: string } =>
      l.numero !== undefined,
    )
    .map((l) => ({ editionCle: l.editionCle, versetNumero: l.numero, texte: l.texte }));

  for (let debut = 0; debut < lignes.length; debut += 200) {
    await db
      .insert(textesVersets)
      .values(lignes.slice(debut, debut + 200))
      .onConflictDoUpdate({
        target: [textesVersets.editionCle, textesVersets.versetNumero],
        set: { texte: sql`excluded.texte` },
      });
  }

  return {
    ecrits: lignes.length,
    versetsEcartes: 0,
    sansCorrespondance: entrees.length - lignes.length,
  };
}

/** Met à jour le compte de l'édition une fois le dépôt terminé. */
export async function cloreEdition(cle: string): Promise<number> {
  const [total] = await db
    .select({ combien: count() })
    .from(textesVersets)
    .where(eq(textesVersets.editionCle, cle));

  const importes = total?.combien ?? 0;
  await db
    .update(editionsCoran)
    .set({
      versets: importes,
      importeeLe: importes >= TOTAL_VERSETS ? aujourdhui() : null,
    })
    .where(eq(editionsCoran.cle, cle));

  return importes;
}

/* ──────────────────────────── Rapport ──────────────────────────── */

export type CouvertureSens = {
  /** Mots du texte arabe présents en base, comptés sur le texte lui-même. */
  motsTexte: number;
  avecSens: number;
  sansSens: number;
};

/**
 * Combien de mots ont un sens, combien n'en ont pas.
 *
 * Le dénominateur est le texte, pas la table d'analyse : compter les mots qui
 * ont un sens parmi ceux qui ont déjà une ligne donnerait toujours cent pour
 * cent et ne dirait rien. Le compte se fait donc sur le découpage du texte
 * arabe, le même que celui du lecteur.
 */
export async function couvertureSens(): Promise<CouvertureSens> {
  const resultat = await db.execute(sql`
    select
      (select coalesce(sum(array_length(regexp_split_to_array(trim(texte), '\\s+'), 1)), 0)
         from ${versets})::int as mots_texte,
      (select count(*) from ${motsCoran} where sens is not null and sens <> '')::int as avec_sens
  `);

  const lignes =
    (resultat as unknown as { rows?: Record<string, unknown>[] }).rows ??
    (resultat as unknown as Record<string, unknown>[]);
  const premiere = Array.isArray(lignes) ? lignes[0] : undefined;

  const motsTexte = Number(premiere?.mots_texte ?? 0);
  const avecSens = Number(premiere?.avec_sens ?? 0);

  return { motsTexte, avecSens, sansSens: Math.max(0, motsTexte - avecSens) };
}
