import "server-only";

import { asc, count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  editionsCoran,
  motsCoran,
  sourates,
  textesVersets,
  versets,
  type Revelation,
} from "@/db/schema";
import { aujourdhui } from "@/lib/dates";
import { API_BASE, EDITION_ARABE, editionProposee, URL_MORPHOLOGIE } from "./sources";

/**
 * Import du texte depuis alquran.cloud.
 *
 * Deux exigences gouvernent ce fichier.
 *
 * La première : le texte reçu est écrit tel quel. Aucun `trim`, aucun
 * `normalize`, aucun remplacement de caractère. Les diacritiques et les
 * marques de tajwid tiennent à des points de code que la moindre normalisation
 * NFC/NFKC déplacerait ou fusionnerait — ce qui, sur un texte coranique, n'est
 * pas une coquille mais une altération. La seule vérification appliquée est un
 * refus : une chaîne vide n'est pas écrite.
 *
 * La seconde : l'import doit survivre à une coupure. Vercel arrête une fonction
 * au bout d'un temps borné, et 114 sourates ne passent pas toujours. L'état
 * d'avancement n'est donc stocké nulle part — il se lit dans ce qui est déjà en
 * base. Relancer la route reprend exactement là où elle s'était arrêtée, et la
 * relancer une fois terminée ne réécrit rien.
 */

/** Marge gardée sous la limite de la fonction pour rendre la main proprement. */
const BUDGET_DEFAUT_MS = 40_000;

/** Versets écrits par requête : au-delà, la requête HTTP de Neon devient lourde. */
const TAILLE_LOT = 120;

export type EtatEdition = {
  cle: string;
  nom: string;
  auteur: string;
  type: string;
  source: string;
  licence: string;
  versets: number;
  complete: boolean;
};

export type EtatImport = {
  sourates: number;
  versetsArabe: number;
  arabeComplet: boolean;
  editions: EtatEdition[];
};

export const TOTAL_SOURATES = 114;
export const TOTAL_VERSETS = 6236;

export async function etatImport(): Promise<EtatImport> {
  const [nbSourates, nbVersets, editions] = await Promise.all([
    db.select({ combien: count() }).from(sourates),
    db.select({ combien: count() }).from(versets),
    db.select().from(editionsCoran),
  ]);

  return {
    sourates: nbSourates[0]?.combien ?? 0,
    versetsArabe: nbVersets[0]?.combien ?? 0,
    arabeComplet: (nbVersets[0]?.combien ?? 0) >= TOTAL_VERSETS,
    editions: editions.map((e) => ({
      cle: e.cle,
      nom: e.nom,
      auteur: e.auteur,
      type: e.type,
      source: e.source,
      licence: e.licence,
      versets: e.versets,
      complete: e.versets >= TOTAL_VERSETS,
    })),
  };
}

export class ImportRefuse extends Error {}

async function recuperer(chemin: string): Promise<unknown> {
  const reponse = await fetch(`${API_BASE}${chemin}`, {
    headers: { accept: "application/json" },
    // Le texte ne change pas ; inutile de le redemander pendant un import.
    cache: "no-store",
  });

  if (!reponse.ok) {
    throw new ImportRefuse(
      `${API_BASE}${chemin} a répondu ${reponse.status} ${reponse.statusText}.`,
    );
  }

  const brut: unknown = await reponse.json();
  if (
    typeof brut !== "object" ||
    brut === null ||
    (brut as { code?: unknown }).code !== 200
  ) {
    throw new ImportRefuse(
      `Réponse inattendue de ${chemin} : ${apercu(brut)}. ` +
        "L'API a peut-être changé de forme ; rien n'a été écrit.",
    );
  }

  return (brut as { data: unknown }).data;
}

/** Un extrait court d'une réponse, pour un message d'erreur utile. */
function apercu(valeur: unknown): string {
  const texte = typeof valeur === "string" ? valeur : JSON.stringify(valeur);
  return (texte ?? "").slice(0, 300);
}

type AyahBrut = {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
  hizbQuarter: number;
  sajda: boolean | { recommended?: boolean; obligatory?: boolean };
};

function estAyah(valeur: unknown): valeur is AyahBrut {
  const a = valeur as AyahBrut;
  return (
    typeof valeur === "object" &&
    valeur !== null &&
    Number.isInteger(a.number) &&
    typeof a.text === "string" &&
    Number.isInteger(a.numberInSurah)
  );
}

/* ─────────────────────── Métadonnées des sourates ─────────────────────── */

function revelation(brut: unknown): Revelation {
  return String(brut).toLowerCase().startsWith("med") ? "medinoise" : "mecquoise";
}

export async function importerSourates(): Promise<number> {
  const donnees = await recuperer("/surah");
  if (!Array.isArray(donnees) || donnees.length !== TOTAL_SOURATES) {
    throw new ImportRefuse(
      `La liste des sourates devrait en compter ${TOTAL_SOURATES}, ` +
        `${Array.isArray(donnees) ? donnees.length : "aucune"} reçue(s).`,
    );
  }

  let premierVerset = 1;
  const lignes = donnees.map((brut) => {
    const s = brut as {
      number: number;
      name: string;
      englishName: string;
      englishNameTranslation: string;
      numberOfAyahs: number;
      revelationType: string;
    };
    const ligne = {
      numero: s.number,
      nomArabe: s.name,
      nomTranslittere: s.englishName,
      sensDuNom: s.englishNameTranslation,
      revelation: revelation(s.revelationType),
      versets: s.numberOfAyahs,
      premierVerset,
    };
    premierVerset += s.numberOfAyahs;
    return ligne;
  });

  if (premierVerset - 1 !== TOTAL_VERSETS) {
    throw new ImportRefuse(
      `La somme des versets annoncés fait ${premierVerset - 1} au lieu de ${TOTAL_VERSETS}.`,
    );
  }

  for (let debut = 0; debut < lignes.length; debut += 40) {
    await db
      .insert(sourates)
      .values(lignes.slice(debut, debut + 40))
      .onConflictDoNothing();
  }

  return lignes.length;
}

/* ───────────────────────────── Texte arabe ───────────────────────────── */

/** Les numéros de sourate dont il manque au moins un verset. */
async function souratesIncompletes(): Promise<{ numero: number; versets: number }[]> {
  const lignes = await db
    .select({
      numero: sourates.numero,
      attendus: sourates.versets,
      presents: sql<number>`(select count(*) from ${versets} v where v.sourate = ${sourates.numero})`,
    })
    .from(sourates)
    .orderBy(sourates.numero);

  return lignes
    .filter((l) => Number(l.presents) < l.attendus)
    .map((l) => ({ numero: l.numero, versets: l.attendus }));
}

export type Avancement = {
  traitees: number;
  restantes: number;
  fini: boolean;
  detail: string;
};

export async function importerTexteArabe(
  budgetMs = BUDGET_DEFAUT_MS,
): Promise<Avancement> {
  const depart = Date.now();

  if ((await db.select({ combien: count() }).from(sourates))[0].combien === 0) {
    await importerSourates();
  }

  const restantes = await souratesIncompletes();
  let traitees = 0;

  for (const sourate of restantes) {
    if (Date.now() - depart > budgetMs) break;

    const donnees = await recuperer(`/surah/${sourate.numero}/${EDITION_ARABE.cle}`);
    const ayahs = (donnees as { ayahs?: unknown }).ayahs;

    if (!Array.isArray(ayahs) || ayahs.length !== sourate.versets) {
      throw new ImportRefuse(
        `Sourate ${sourate.numero} : ${Array.isArray(ayahs) ? ayahs.length : 0} versets ` +
          `reçus au lieu de ${sourate.versets}. Rien n'a été écrit pour cette sourate.`,
      );
    }

    const lignes = ayahs.map((brut) => {
      if (!estAyah(brut)) {
        throw new ImportRefuse(`Verset mal formé dans la sourate ${sourate.numero}.`);
      }
      if (brut.text.length === 0) {
        throw new ImportRefuse(
          `Verset ${sourate.numero}:${brut.numberInSurah} reçu vide. Import interrompu.`,
        );
      }
      return {
        numero: brut.number,
        sourate: sourate.numero,
        numeroDansSourate: brut.numberInSurah,
        juz: brut.juz,
        page: brut.page,
        hizbQuart: brut.hizbQuarter,
        sajda: brut.sajda !== false,
        // Écrit tel quel : voir l'en-tête de ce fichier.
        texte: brut.text,
      };
    });

    for (let debut = 0; debut < lignes.length; debut += TAILLE_LOT) {
      await db
        .insert(versets)
        .values(lignes.slice(debut, debut + TAILLE_LOT))
        .onConflictDoNothing();
    }

    traitees += 1;
  }

  const reste = restantes.length - traitees;
  return {
    traitees,
    restantes: reste,
    fini: reste === 0,
    detail:
      reste === 0
        ? `Texte arabe complet : ${TOTAL_VERSETS} versets.`
        : `${traitees} sourate(s) importée(s), ${reste} restante(s).`,
  };
}

/* ─────────────────────── Traductions, translittération ─────────────────────── */

export async function importerEdition(
  cle: string,
  budgetMs = BUDGET_DEFAUT_MS,
): Promise<Avancement> {
  const depart = Date.now();
  const proposee = editionProposee(cle);

  if (!proposee) {
    throw new ImportRefuse(
      `Édition « ${cle} » inconnue. Seules les éditions dont la licence est ` +
        "documentée dans sources.ts peuvent être importées.",
    );
  }

  const [existante] = await db
    .select()
    .from(editionsCoran)
    .where(eq(editionsCoran.cle, cle))
    .limit(1);

  if (!existante) {
    await db.insert(editionsCoran).values({
      cle: proposee.cle,
      langue: proposee.langue,
      nom: proposee.nom,
      auteur: proposee.auteur,
      type: proposee.type,
      source: proposee.source,
      licence: proposee.licence,
      versets: 0,
    });
  }

  const listeSourates = await db
    .select({
      numero: sourates.numero,
      attendus: sourates.versets,
      premierVerset: sourates.premierVerset,
      presents: sql<number>`(select count(*) from ${textesVersets} t
        where t.edition_cle = ${cle}
          and t.verset_numero >= ${sourates.premierVerset}
          and t.verset_numero < ${sourates.premierVerset} + ${sourates.versets})`,
    })
    .from(sourates)
    .orderBy(sourates.numero);

  const restantes = listeSourates.filter((s) => Number(s.presents) < s.attendus);
  let traitees = 0;

  for (const sourate of restantes) {
    if (Date.now() - depart > budgetMs) break;

    const donnees = await recuperer(`/surah/${sourate.numero}/${cle}`);
    const ayahs = (donnees as { ayahs?: unknown }).ayahs;

    if (!Array.isArray(ayahs) || ayahs.length !== sourate.attendus) {
      throw new ImportRefuse(
        `Sourate ${sourate.numero} de « ${cle} » : ${Array.isArray(ayahs) ? ayahs.length : 0} ` +
          `versets reçus au lieu de ${sourate.attendus}.`,
      );
    }

    const lignes = ayahs
      .filter(estAyah)
      .filter((a) => a.text.length > 0)
      .map((a) => ({ editionCle: cle, versetNumero: a.number, texte: a.text }));

    for (let debut = 0; debut < lignes.length; debut += TAILLE_LOT) {
      await db
        .insert(textesVersets)
        .values(lignes.slice(debut, debut + TAILLE_LOT))
        .onConflictDoNothing();
    }

    traitees += 1;
  }

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

  const reste = restantes.length - traitees;
  return {
    traitees,
    restantes: reste,
    fini: reste === 0,
    detail:
      reste === 0
        ? `« ${proposee.nom} » complète : ${importes} versets.`
        : `${traitees} sourate(s) importée(s), ${reste} restante(s).`,
  };
}

/** Retire une édition et tous ses textes. Le texte arabe n'est jamais touché. */
export async function retirerEdition(cle: string): Promise<void> {
  await db.delete(editionsCoran).where(eq(editionsCoran.cle, cle));
}

/** Place occupée par le module, pour la rapporter au quota Neon. */
export async function poidsCoran(): Promise<{
  versets: number;
  textes: number;
  octets: number | null;
}> {
  const [nbVersets, nbTextes] = await Promise.all([
    db.select({ combien: count() }).from(versets),
    db.select({ combien: count() }).from(textesVersets),
  ]);

  const octets = await db
    .execute(
      sql`select coalesce(sum(pg_total_relation_size(c.oid)), 0)::bigint as octets
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname in ('versets', 'textes_versets', 'sourates', 'editions_coran')`,
    )
    .then((r) => {
      const lignes = (r as unknown as { rows?: { octets: unknown }[] }).rows ?? r;
      const premiere = Array.isArray(lignes) ? lignes[0] : undefined;
      const brut = (premiere as { octets?: unknown } | undefined)?.octets;
      return brut === undefined || brut === null ? null : Number(brut);
    })
    .catch(() => null);

  return {
    versets: nbVersets[0]?.combien ?? 0,
    textes: nbTextes[0]?.combien ?? 0,
    octets,
  };
}

/* ─────────────────────── Corpus morphologique ─────────────────────── */

/**
 * Import de l'analyse mot à mot.
 *
 * Le corpus est un seul fichier de quelques mégaoctets, trié par sourate. On le
 * retélécharge à chaque passage et l'on n'écrit que les sourates encore
 * absentes : c'est le même principe de reprise que le reste — aucun état
 * d'avancement stocké, tout se lit dans la base.
 *
 * L'alignement est le point délicat. Le corpus numérote les mots d'un verset ;
 * le texte, lui, vient de Tanzil. On vérifie que les deux comptes coïncident
 * avant d'écrire : si un verset ne s'aligne pas, il est laissé de côté plutôt
 * que d'attacher une racine au mauvais mot, et le total des versets écartés est
 * rapporté.
 */
export async function importerMorphologie(
  budgetMs = BUDGET_DEFAUT_MS,
): Promise<Avancement & { desalignes: number }> {
  const depart = Date.now();

  const reponse = await fetch(URL_MORPHOLOGIE, { cache: "no-store" });
  if (!reponse.ok) {
    throw new ImportRefuse(
      `${URL_MORPHOLOGIE} a répondu ${reponse.status}. ` +
        "Renseigne CORAN_MORPHOLOGIE_URL avec un miroir joignable.",
    );
  }

  const brut = await reponse.text();
  const analyse = analyserCorpus(brut);
  if (analyse.size === 0) {
    throw new ImportRefuse(
      "Le fichier reçu ne contient aucune ligne exploitable ; rien n'a été écrit.",
    );
  }

  const dejaFaites = await db
    .select({ sourate: motsCoran.sourate })
    .from(motsCoran)
    .groupBy(motsCoran.sourate);
  const faites = new Set(dejaFaites.map((l) => l.sourate));

  const listeVersets = await db
    .select({
      numero: versets.numero,
      sourate: versets.sourate,
      numeroDansSourate: versets.numeroDansSourate,
      texte: versets.texte,
    })
    .from(versets)
    .orderBy(asc(versets.numero));

  const parSourate = new Map<number, typeof listeVersets>();
  for (const v of listeVersets) {
    const liste = parSourate.get(v.sourate) ?? [];
    liste.push(v);
    parSourate.set(v.sourate, liste);
  }

  let traitees = 0;
  let desalignes = 0;
  const restantes = [...parSourate.keys()].filter((s) => !faites.has(s)).sort((a, b) => a - b);

  for (const sourate of restantes) {
    if (Date.now() - depart > budgetMs) break;

    const lignes: (typeof motsCoran.$inferInsert)[] = [];

    for (const verset of parSourate.get(sourate) ?? []) {
      const mots = verset.texte.split(/\s+/).filter((m) => m.length > 0);
      const analyses = analyse.get(`${sourate}:${verset.numeroDansSourate}`);
      if (!analyses || analyses.length !== mots.length) {
        desalignes += 1;
        continue;
      }

      for (const mot of analyses) {
        lignes.push({
          versetNumero: verset.numero,
          sourate,
          position: mot.position,
          buckwalter: mot.buckwalter,
          racine: mot.racine,
          lemme: mot.lemme,
          categorie: mot.categorie,
        });
      }
    }

    for (let debut = 0; debut < lignes.length; debut += TAILLE_LOT) {
      await db
        .insert(motsCoran)
        .values(lignes.slice(debut, debut + TAILLE_LOT))
        .onConflictDoNothing();
    }

    traitees += 1;
  }

  const reste = restantes.length - traitees;
  return {
    traitees,
    restantes: reste,
    fini: reste === 0,
    desalignes,
    detail:
      reste === 0
        ? "Analyse mot à mot complète."
        : `${traitees} sourate(s) analysée(s), ${reste} restante(s).`,
  };
}

type MotAnalyse = {
  position: number;
  buckwalter: string;
  racine: string | null;
  lemme: string | null;
  categorie: string;
};

/**
 * Lit le format du corpus : une ligne par segment, la localisation en
 * `(sourate:verset:mot:segment)`, puis la forme, la catégorie et les traits.
 * Les segments d'un même mot sont recollés — c'est le mot entier qui intéresse
 * la lecture, et sa racine se trouve sur l'un de ses segments.
 */
export function analyserCorpus(contenu: string): Map<string, MotAnalyse[]> {
  const parVerset = new Map<string, Map<number, MotAnalyse>>();

  for (const ligne of contenu.split("\n")) {
    if (!ligne.startsWith("(")) continue;
    const colonnes = ligne.split("\t");
    if (colonnes.length < 4) continue;

    const reperes = colonnes[0].replace(/[()]/g, "").split(":").map(Number);
    if (reperes.length < 3 || reperes.some((n) => !Number.isInteger(n))) continue;

    const [sourate, verset, mot] = reperes;
    const cle = `${sourate}:${verset}`;
    const mots = parVerset.get(cle) ?? new Map<number, MotAnalyse>();

    const traits = colonnes[3] ?? "";
    const racine = /ROOT:([^|\s]+)/.exec(traits)?.[1] ?? null;
    const lemme = /LEM:([^|\s]+)/.exec(traits)?.[1] ?? null;

    const existant = mots.get(mot);
    mots.set(mot, {
      position: mot,
      buckwalter: (existant?.buckwalter ?? "") + (colonnes[1] ?? ""),
      // La racine d'un mot est portée par son segment nominal ou verbal :
      // le premier trouvé est le bon, les suivants sont des affixes.
      racine: existant?.racine ?? racine,
      lemme: existant?.lemme ?? lemme,
      categorie: existant?.categorie || (colonnes[2] ?? ""),
    });

    parVerset.set(cle, mots);
  }

  const sortie = new Map<string, MotAnalyse[]>();
  for (const [cle, mots] of parVerset) {
    sortie.set(cle, [...mots.values()].sort((a, b) => a.position - b.position));
  }
  return sortie;
}

/** Place occupée par l'analyse mot à mot. */
export async function poidsMorphologie(): Promise<{ mots: number; octets: number | null }> {
  const compte = await db.select({ combien: count() }).from(motsCoran);
  const octets = await db
    .execute(
      sql`select coalesce(pg_total_relation_size('mots_coran'), 0)::bigint as octets`,
    )
    .then((r) => {
      const lignes = (r as unknown as { rows?: { octets: unknown }[] }).rows ?? r;
      const premiere = Array.isArray(lignes) ? lignes[0] : undefined;
      const brut = (premiere as { octets?: unknown } | undefined)?.octets;
      return brut === undefined || brut === null ? null : Number(brut);
    })
    .catch(() => null);

  return { mots: compte[0]?.combien ?? 0, octets };
}
