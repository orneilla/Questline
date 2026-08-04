import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  LIBELLES_TYPES,
  type GroupeResultats,
  type Resultat,
  type TypeResultat,
} from "./recherche-partage";

/**
 * Recherche globale.
 *
 * Un champ unique qui traverse tout : cartes, versets, vocabulaire arabe,
 * quêtes, arcs, tâches. Les résultats sont groupés par type et chacun sait où
 * il mène — le verset dans sa sourate, la carte dans son paquet.
 *
 * ── L'insensibilité aux diacritiques, sans extension Postgres
 *
 * `unaccent` est une extension, et une extension peut manquer à l'hébergement.
 * Le pliage se fait donc avec `translate()`, à partir d'une table de
 * correspondance définie ici en TypeScript : les deux chaînes qu'attend
 * `translate` sont construites depuis la même liste de paires, donc elles ne
 * peuvent pas se désaligner — c'est exactement le genre de constante qu'on
 * finit sinon par éditer d'un seul côté.
 *
 * La liste couvre le français et la translittération savante de l'arabe : « ṣalāt »
 * se replie sur « salat », « ḥadīth » sur « hadith », et les signes ʾ et ʿ
 * disparaissent.
 *
 * ── Les alias
 *
 * Le pliage ne suffit pas pour « coran » → « Qurʾān » : ce n'est pas un accent,
 * c'est une autre façon d'écrire le mot. Une courte liste de correspondances
 * connues comble l'écart. Elle est fixe et lisible — pas de recherche floue,
 * qui rendrait des résultats qu'on ne saurait pas expliquer.
 */

/** Paires « caractère à replier » → « caractère de repli », une pour une. */
const REPLIS: [string, string][] = [
  ["á", "a"], ["à", "a"], ["â", "a"], ["ä", "a"], ["ã", "a"], ["å", "a"], ["ā", "a"], ["ă", "a"], ["ą", "a"],
  ["ç", "c"], ["ć", "c"], ["č", "c"],
  ["ď", "d"], ["đ", "d"], ["ḍ", "d"],
  ["é", "e"], ["è", "e"], ["ê", "e"], ["ë", "e"], ["ē", "e"], ["ĕ", "e"], ["ė", "e"], ["ę", "e"], ["ě", "e"],
  ["ğ", "g"], ["ġ", "g"], ["ĝ", "g"],
  ["ĥ", "h"], ["ħ", "h"], ["ḥ", "h"],
  ["í", "i"], ["ì", "i"], ["î", "i"], ["ï", "i"], ["ĩ", "i"], ["ī", "i"], ["ĭ", "i"], ["į", "i"], ["ı", "i"],
  ["ĺ", "l"], ["ļ", "l"], ["ľ", "l"], ["ł", "l"], ["ḷ", "l"],
  ["ń", "n"], ["ņ", "n"], ["ň", "n"], ["ñ", "n"], ["ṅ", "n"], ["ṇ", "n"],
  ["ó", "o"], ["ò", "o"], ["ô", "o"], ["ö", "o"], ["õ", "o"], ["ō", "o"], ["ŏ", "o"], ["ő", "o"],
  ["ŕ", "r"], ["ř", "r"], ["ṛ", "r"],
  ["ś", "s"], ["ŝ", "s"], ["ş", "s"], ["š", "s"], ["ș", "s"], ["ṣ", "s"],
  ["ť", "t"], ["ţ", "t"], ["ț", "t"], ["ṭ", "t"],
  ["ú", "u"], ["ù", "u"], ["û", "u"], ["ü", "u"], ["ũ", "u"], ["ū", "u"], ["ŭ", "u"], ["ů", "u"], ["ű", "u"],
  ["ŵ", "w"],
  ["ý", "y"], ["ÿ", "y"], ["ŷ", "y"],
  ["ź", "z"], ["ż", "z"], ["ž", "z"], ["ẓ", "z"],
  ["ṁ", "m"], ["ṃ", "m"],
  // Les signes de translittération de la hamza et du ʿayn s'effacent.
  ["ʾ", ""], ["ʿ", ""], ["ʼ", ""], ["ʻ", ""], ["'", ""], ["'", ""], ["`", ""],
];

const DE = REPLIS.map(([source]) => source).join("");
const VERS = REPLIS.map(([, cible]) => cible).join("");

/**
 * Replie une chaîne côté application, exactement comme `translate` le fera côté
 * base. Les deux doivent rester d'accord, d'où la même table.
 */
export function replier(texte: string): string {
  let sortie = texte.toLowerCase();
  for (const [source, cible] of REPLIS) sortie = sortie.replaceAll(source, cible);
  return sortie;
}

/** Une chaîne littérale SQL, apostrophes doublées. */
function litteral(valeur: string): string {
  return `'${valeur.replaceAll("'", "''")}'`;
}

/**
 * Graphies connues d'un même mot.
 *
 * Ce n'est pas une recherche approchée : c'est une liste close, que l'on peut
 * lire et corriger. Chaque groupe est symétrique — chercher l'un des mots
 * cherche tous les autres.
 */
const ALIAS: string[][] = [
  ["coran", "quran", "qur an", "kuran"],
  ["sourate", "surah", "sura"],
  ["verset", "ayah", "aya"],
  ["priere", "salat", "salah"],
  ["jeune", "sawm", "siyam"],
  ["aumone", "zakat"],
  ["pelerinage", "hajj"],
  ["invocation", "dua", "duaa"],
  ["hadith", "hadit"],
  ["mosquee", "masjid"],
];

/** Les termes à chercher pour une requête : elle-même, plus ses graphies. */
export function termes(requete: string): string[] {
  const base = replier(requete.trim());
  if (base.length === 0) return [];

  const trouves = new Set<string>([base]);
  for (const groupe of ALIAS) {
    if (groupe.includes(base)) for (const mot of groupe) trouves.add(mot);
  }
  return [...trouves];
}

/* ───────────────────────────── Résultats ───────────────────────────── */

/** Résultats rendus par groupe. Au-delà, le compte reste juste. */
const PAR_GROUPE = 8;

type Ligne = Record<string, unknown>;

async function interroger(requete: SQL): Promise<Ligne[]> {
  const resultat = await db.execute(requete);
  const lignes =
    (resultat as unknown as { rows?: Ligne[] }).rows ?? (resultat as unknown as Ligne[]);
  return Array.isArray(lignes) ? lignes : [];
}

/** `colonne LIKE '%terme%'` pour chacun des termes, reliés par OU. */
function correspond(colonnes: string[], mots: string[]): string {
  const morceaux: string[] = [];
  for (const colonne of colonnes) {
    const plie = `translate(lower(coalesce(${colonne}, '')), ${litteral(DE)}, ${litteral(VERS)})`;
    for (const mot of mots) morceaux.push(`${plie} like ${litteral(`%${mot}%`)}`);
  }
  return morceaux.length > 0 ? `(${morceaux.join(" or ")})` : "false";
}

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur : String(valeur ?? "");
}

function extrait(valeur: unknown, longueur = 110): string {
  const brut = texte(valeur).replace(/\s+/g, " ").trim();
  return brut.length > longueur ? `${brut.slice(0, longueur)}…` : brut;
}

/**
 * Cherche partout, ou dans un seul type.
 *
 * Chaque groupe est interrogé séparément : c'est plus de requêtes qu'une union,
 * mais chacune reste lisible, et le total par groupe est exact sans avoir à
 * compter deux fois.
 */
export async function chercher(
  requete: string,
  seulement?: TypeResultat,
): Promise<GroupeResultats[]> {
  const mots = termes(requete);
  if (mots.length === 0) return [];

  const veut = (type: TypeResultat) => seulement === undefined || seulement === type;
  const groupes: GroupeResultats[] = [];

  if (veut("carte")) {
    const ou = correspond(["c.recto", "c.verso", "c.notes", "array_to_string(c.tags, ' ')"], mots);
    const lignes = await interroger(sql.raw(`
      select c.id, c.paquet_id, c.recto, c.verso, p.nom as paquet,
             count(*) over () as total
        from cartes c
        join paquets p on p.id = c.paquet_id
       where ${ou} and c.suspendue = false
       order by c.id desc
       limit ${PAR_GROUPE}
    `));
    groupes.push(
      grouper("carte", lignes, (l) => ({
        type: "carte",
        titre: extrait(l.recto),
        detail: `${texte(l.paquet)} · ${extrait(l.verso, 60)}`,
        lien: `/cartes/carte/${texte(l.id)}`,
      })),
    );
  }

  if (veut("verset")) {
    // Le texte arabe et toutes les éditions installées d'un coup : la
    // translittération et la traduction sont dans la même table.
    const ou = correspond(["v.texte", "t.texte"], mots);
    const lignes = await interroger(sql.raw(`
      select distinct on (v.numero)
             v.numero, v.sourate, v.numero_dans_sourate, v.texte,
             s.nom_translittere as sourate_nom,
             t.texte as traduction,
             count(*) over () as total
        from versets v
        join sourates s on s.numero = v.sourate
        left join textes_versets t on t.verset_numero = v.numero
       where ${ou}
       order by v.numero
       limit ${PAR_GROUPE}
    `));
    groupes.push(
      grouper("verset", lignes, (l) => ({
        type: "verset",
        titre: `${texte(l.sourate_nom)} ${texte(l.sourate)}:${texte(l.numero_dans_sourate)}`,
        detail: extrait(l.traduction || l.texte),
        lien: `/coran/lire?sourate=${texte(l.sourate)}&verset=${texte(l.numero_dans_sourate)}`,
      })),
    );
  }

  if (veut("vocabulaire")) {
    const ou = correspond(["m.racine", "m.lemme", "m.sens"], mots);
    const lignes = await interroger(sql.raw(`
      select m.verset_numero, m.position, m.racine, m.lemme, m.sens,
             v.sourate, v.numero_dans_sourate,
             count(*) over () as total
        from mots_coran m
        join versets v on v.numero = m.verset_numero
       where ${ou}
       order by m.id
       limit ${PAR_GROUPE}
    `));
    groupes.push(
      grouper("vocabulaire", lignes, (l) => ({
        type: "vocabulaire",
        titre: texte(l.sens) || texte(l.lemme) || texte(l.racine),
        detail: `racine ${texte(l.racine) || "—"} · ${texte(l.sourate)}:${texte(l.numero_dans_sourate)}`,
        lien: `/coran/lire?sourate=${texte(l.sourate)}&verset=${texte(l.numero_dans_sourate)}`,
      })),
    );
  }

  if (veut("quete")) {
    const ou = correspond(["q.titre"], mots);
    const lignes = await interroger(sql.raw(`
      select q.id, q.titre, q.arc_id, a.nom as arc, q.actif,
             count(*) over () as total
        from quetes q
        join arcs a on a.id = q.arc_id
       where ${ou}
       order by q.id
       limit ${PAR_GROUPE}
    `));
    groupes.push(
      grouper("quete", lignes, (l) => ({
        type: "quete",
        titre: texte(l.titre),
        detail: `${texte(l.arc)}${l.actif === false ? " · désactivée" : ""}`,
        lien: `/arcs/${texte(l.arc_id)}`,
      })),
    );
  }

  if (veut("arc")) {
    const ou = correspond(["a.nom", "a.vision", "e.titre"], mots);
    const lignes = await interroger(sql.raw(`
      select distinct on (a.id) a.id, a.nom, a.vision, a.pilier, a.accompli_le,
             count(*) over () as total
        from arcs a
        left join etapes_arc e on e.arc_id = a.id
       where ${ou}
       order by a.id
       limit ${PAR_GROUPE}
    `));
    groupes.push(
      grouper("arc", lignes, (l) => ({
        type: "arc",
        titre: texte(l.nom),
        detail: extrait(l.vision) || texte(l.pilier),
        lien: `/arcs/${texte(l.id)}`,
      })),
    );
  }

  if (veut("tache")) {
    const ou = correspond(["t.texte"], mots);
    const lignes = await interroger(sql.raw(`
      select t.id, t.texte, t.pilier, t.faite_le,
             count(*) over () as total
        from taches t
       where ${ou}
       order by t.id desc
       limit ${PAR_GROUPE}
    `));
    groupes.push(
      grouper("tache", lignes, (l) => ({
        type: "tache",
        titre: texte(l.texte),
        detail: l.faite_le ? `faite le ${texte(l.faite_le)}` : "ouverte",
        lien: "/jour",
      })),
    );
  }

  return groupes.filter((g) => g.total > 0);
}

function grouper(
  type: TypeResultat,
  lignes: Ligne[],
  vers: (ligne: Ligne) => Resultat,
): GroupeResultats {
  return {
    type,
    libelle: LIBELLES_TYPES[type],
    total: Number(lignes[0]?.total ?? 0),
    resultats: lignes.map(vers),
  };
}

export {
  LIBELLES_TYPES,
  type GroupeResultats,
  type Resultat,
  type TypeResultat,
} from "./recherche-partage";
