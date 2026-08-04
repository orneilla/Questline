/**
 * Reconnaissance d'une ressource déposée — logique pure, sans base ni réseau.
 *
 * QUL (qul.tarteel.ai) publie ses ressources sans adresse stable : le fichier
 * s'obtient depuis le site, pas par requête. Il faut donc pouvoir le déposer
 * depuis la tablette. Et comme il en existe plusieurs sortes — traduction mot à
 * mot, traduction de versets, morphologie — servies tantôt en JSON, tantôt en
 * base SQLite, ce module ne suppose rien du fichier : il l'ouvre, regarde ce
 * qu'il y a dedans, et dit ce qu'il a reconnu.
 *
 * Deux règles gouvernent ce fichier.
 *
 * La première : il ne devine pas. Une clé qu'il ne sait pas lire est comptée
 * comme ignorée, jamais rattachée au mot le plus proche. Un fichier dont la
 * forme n'est reconnue par aucun lecteur lève une erreur qui dit ce qui a été
 * lu — pas « format invalide », mais les premiers octets et ce qu'on en a fait.
 *
 * La seconde : il ne produit rien. Aucun sens n'est inventé, aucun texte n'est
 * reformulé, aucune valeur n'est complétée. Ce qui sort d'ici est exactement ce
 * qui était dans le fichier, rattaché à une position.
 *
 * Tout est pur, donc exécutable dans le navigateur : le fichier fait plusieurs
 * mégaoctets et ne doit jamais traverser le réseau d'un coup.
 */

import { analyserCorpus } from "./morphologie";
import { lireSqlite, SqliteIllisible, type TableSqlite } from "./sqlite";

export class RessourceIllisible extends Error {}

export type TypeRessource = "mot_a_mot" | "traduction" | "morphologie";

/** Un sens attaché à un mot précis d'un verset. */
export type EntreeMot = {
  sourate: number;
  verset: number;
  mot: number;
  valeur: string;
};

/** Une traduction de verset entier. */
export type EntreeVerset = {
  sourate: number;
  verset: number;
  valeur: string;
};

/** Une analyse grammaticale, de même forme que celle du corpus de Leeds. */
export type EntreeMorphologie = {
  sourate: number;
  verset: number;
  mot: number;
  segments: string[];
  racine: string | null;
  lemme: string | null;
  categorie: string;
  traits: string;
};

export type Exemple = { cle: string; valeur: string };

export type Diagnostic = {
  type: TypeRessource;
  /** Le nom de la sorte de ressource, en français. */
  libelle: string;
  /** Le contenant : JSON, base SQLite, texte tabulé. */
  format: string;
  /** Ce qui a été reconnu dans le fichier, en une phrase lisible. */
  structure: string;
  entrees: number;
  /** Trois entrées réelles, prises loin les unes des autres. */
  exemples: Exemple[];
  /** Entrées écartées faute de clé lisible ou de valeur. */
  ignorees: number;
  avertissements: string[];
};

export type Ressource =
  | { type: "mot_a_mot"; diagnostic: Diagnostic; entrees: EntreeMot[] }
  | { type: "traduction"; diagnostic: Diagnostic; entrees: EntreeVerset[] }
  | { type: "morphologie"; diagnostic: Diagnostic; entrees: EntreeMorphologie[] };

export const LIBELLES: Record<TypeRessource, string> = {
  mot_a_mot: "Traduction mot à mot",
  traduction: "Traduction de versets",
  morphologie: "Analyse morphologique",
};

/* ────────────────────────── Repères et bornes ────────────────────────── */

const TOTAL_SOURATES = 114;
/** Le plus long verset du Coran compte 129 mots ; large de quoi. */
const MOTS_MAX = 200;
const VERSETS_MAX = 286;

/**
 * Lit une clé de position : « 1:1:1 », « 1:1 », « 1-1-1 », « 001:001 ».
 * Rend `null` dès que la forme n'est pas certaine — c'est ce refus qui garantit
 * qu'aucun sens ne finira sur le mauvais mot.
 */
function reperes(brut: string): { sourate: number; verset: number; mot: number | null } | null {
  const parties = brut.trim().split(/[:\-_.]/);
  if (parties.length < 2 || parties.length > 4) return null;

  const nombres: number[] = [];
  for (const partie of parties.slice(0, 3)) {
    if (!/^\d{1,3}$/.test(partie)) return null;
    nombres.push(Number(partie));
  }

  const [sourate, verset, mot] = nombres;
  if (sourate < 1 || sourate > TOTAL_SOURATES) return null;
  if (verset < 1 || verset > VERSETS_MAX) return null;
  if (mot !== undefined && (mot < 1 || mot > MOTS_MAX)) return null;

  return { sourate, verset, mot: mot ?? null };
}

/* ────────────────────────────── Champs JSON ────────────────────────────── */

/**
 * Les noms de champs rencontrés dans les exports QUL et leurs voisins. La liste
 * est ouverte : un nom inconnu ne casse rien, il rend simplement la ressource
 * illisible, avec un message qui dit quels champs étaient présents.
 */
const CHAMPS_SOURATE = ["surah", "sura", "surah_number", "chapter", "chapter_number", "s"];
const CHAMPS_VERSET = ["ayah", "aya", "ayah_number", "verse", "verse_number", "v"];
const CHAMPS_MOT = ["word", "word_number", "word_index", "position", "w"];
const CHAMPS_CLE = ["word_key", "verse_key", "key", "location", "id"];
const CHAMPS_TEXTE = [
  "text",
  "t",
  "translation",
  "translated_text",
  "word_translation",
  "meaning",
  "tr",
  "value",
  "fr",
  "en",
];

type Objet = Record<string, unknown>;

function estObjet(valeur: unknown): valeur is Objet {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

function champ(objet: Objet, noms: string[]): unknown {
  for (const nom of noms) {
    if (nom in objet && objet[nom] !== null && objet[nom] !== undefined) return objet[nom];
  }
  return undefined;
}

function entier(valeur: unknown): number | null {
  if (typeof valeur === "number" && Number.isInteger(valeur)) return valeur;
  if (typeof valeur === "string" && /^\d{1,3}$/.test(valeur.trim())) {
    return Number(valeur.trim());
  }
  return null;
}

/**
 * Extrait le texte d'une valeur. Une chaîne est prise telle quelle ; un objet
 * est fouillé sur les noms connus. Rien d'autre n'est accepté — un nombre ou un
 * tableau n'est pas un sens.
 */
function texte(valeur: unknown): string | null {
  if (typeof valeur === "string") return valeur;
  if (estObjet(valeur)) {
    const trouve = champ(valeur, CHAMPS_TEXTE);
    if (typeof trouve === "string") return trouve;
  }
  return null;
}

/* ──────────────────────────── Lecture du JSON ──────────────────────────── */

type Paire = {
  sourate: number;
  verset: number;
  mot: number | null;
  valeur: string;
};

type Moisson = { paires: Paire[]; ignorees: number; forme: string };

/**
 * QUL enveloppe parfois ses données dans un objet de tête. On déballe une seule
 * couche, et seulement si l'enveloppe est reconnaissable : au-delà, on préfère
 * échouer en disant ce qu'on a vu.
 */
const ENVELOPPES = ["data", "words", "verses", "translations", "quran", "result", "content"];

function deballer(racine: unknown): { corps: unknown; enveloppe: string | null } {
  if (!estObjet(racine)) return { corps: racine, enveloppe: null };
  for (const nom of ENVELOPPES) {
    const dedans = racine[nom];
    if (Array.isArray(dedans) || estObjet(dedans)) {
      return { corps: dedans, enveloppe: nom };
    }
  }
  return { corps: racine, enveloppe: null };
}

/** Un tableau d'objets portant leurs propres repères. */
function moissonnerTableau(liste: unknown[]): Moisson {
  const paires: Paire[] = [];
  let ignorees = 0;
  const champsVus = new Set<string>();

  for (const element of liste) {
    if (!estObjet(element)) {
      ignorees += 1;
      continue;
    }
    for (const nom of Object.keys(element)) champsVus.add(nom);

    const valeur = texte(champ(element, CHAMPS_TEXTE));
    if (valeur === null) {
      ignorees += 1;
      continue;
    }

    const sourate = entier(champ(element, CHAMPS_SOURATE));
    const verset = entier(champ(element, CHAMPS_VERSET));
    const mot = entier(champ(element, CHAMPS_MOT));

    if (sourate !== null && verset !== null) {
      paires.push({ sourate, verset, mot, valeur });
      continue;
    }

    // À défaut de champs séparés, une clé « 1:1:1 ».
    const cle = champ(element, CHAMPS_CLE);
    const lus = typeof cle === "string" ? reperes(cle) : null;
    if (lus) {
      paires.push({ ...lus, valeur });
      continue;
    }

    ignorees += 1;
  }

  return {
    paires,
    ignorees,
    forme: `tableau de ${liste.length} objets (champs : ${[...champsVus].slice(0, 8).join(", ")})`,
  };
}

/**
 * Un objet dont les clés sont des positions, à plat (« 1:1:1 ») ou imbriquées
 * (sourate → verset → mot). Les deux se rencontrent chez QUL.
 */
function moissonnerObjet(objet: Objet): Moisson {
  const paires: Paire[] = [];
  let ignorees = 0;
  let plates = 0;
  let imbriquees = 0;

  const visiter = (noeud: Objet, prefixe: number[]): void => {
    for (const [cle, valeur] of Object.entries(noeud)) {
      const chemin = cle.trim();

      // Clé complète : elle porte toute la position à elle seule.
      const complets = prefixe.length === 0 ? reperes(chemin) : null;
      if (complets) {
        const lu = texte(valeur);
        if (lu === null) ignorees += 1;
        else {
          paires.push({ ...complets, valeur: lu });
          plates += 1;
        }
        continue;
      }

      // Sinon la clé est un seul nombre, et la position s'assemble en chemin.
      if (!/^\d{1,3}$/.test(chemin)) {
        ignorees += 1;
        continue;
      }
      const suite = [...prefixe, Number(chemin)];

      const lu = texte(valeur);
      if (lu !== null && suite.length >= 2) {
        const [sourate, verset, mot] = suite;
        if (sourate >= 1 && sourate <= TOTAL_SOURATES && verset >= 1) {
          paires.push({ sourate, verset, mot: mot ?? null, valeur: lu });
          imbriquees += 1;
        } else ignorees += 1;
        continue;
      }

      if (estObjet(valeur) && suite.length < 3) {
        visiter(valeur, suite);
        continue;
      }

      ignorees += 1;
    }
  };

  visiter(objet, []);

  const forme = plates >= imbriquees
    ? `objet à clés de position (« sourate:verset[:mot] »)`
    : `objet imbriqué (sourate → verset${imbriquees > 0 && paires.some((p) => p.mot !== null) ? " → mot" : ""})`;

  return { paires, ignorees, forme };
}

/* ─────────────────────────── Lecture d'une base ─────────────────────────── */

type Colonne = { nom: string; index: number };

function trouverColonne(table: TableSqlite, noms: string[]): Colonne | null {
  for (const nom of noms) {
    const index = table.colonnes.findIndex((c) => c.toLowerCase() === nom);
    if (index >= 0) return { nom: table.colonnes[index], index };
  }
  return null;
}

/**
 * Choisit la table qui porte la ressource et en tire les paires.
 *
 * Une base QUL contient souvent plusieurs tables — la ressource, ses métadonnées,
 * parfois un index. On retient celle qui a à la fois des repères et du texte, et
 * qui en a le plus : les tables de métadonnées ont deux lignes, la ressource en
 * a des dizaines de milliers.
 */
function moissonnerSqlite(tables: TableSqlite[]): Moisson {
  let meilleure: (Moisson & { nom: string }) | null = null;
  const examinees: string[] = [];

  for (const table of tables) {
    examinees.push(`${table.nom} (${table.colonnes.join(", ")})`);

    const colonneTexte = trouverColonne(table, CHAMPS_TEXTE);
    if (!colonneTexte) continue;

    const colonneSourate = trouverColonne(table, CHAMPS_SOURATE);
    const colonneVerset = trouverColonne(table, CHAMPS_VERSET);
    const colonneMot = trouverColonne(table, CHAMPS_MOT);
    const colonneCle = trouverColonne(table, CHAMPS_CLE);

    const parChamps = colonneSourate !== null && colonneVerset !== null;
    if (!parChamps && !colonneCle) continue;

    const paires: Paire[] = [];
    let ignorees = 0;

    for (const ligne of table.lignes) {
      const valeur = ligne[colonneTexte.index];
      if (typeof valeur !== "string" || valeur.length === 0) {
        ignorees += 1;
        continue;
      }

      if (parChamps) {
        const sourate = entier(ligne[colonneSourate.index]);
        const verset = entier(ligne[colonneVerset.index]);
        const mot = colonneMot ? entier(ligne[colonneMot.index]) : null;
        if (sourate !== null && verset !== null) {
          paires.push({ sourate, verset, mot, valeur });
          continue;
        }
      }

      const cle = colonneCle ? ligne[colonneCle.index] : null;
      const lus = typeof cle === "string" ? reperes(cle) : null;
      if (lus) paires.push({ ...lus, valeur });
      else ignorees += 1;
    }

    if (paires.length > (meilleure?.paires.length ?? 0)) {
      const colonnes = [
        colonneSourate?.nom,
        colonneVerset?.nom,
        colonneMot?.nom,
        parChamps ? null : colonneCle?.nom,
        colonneTexte.nom,
      ].filter((c): c is string => Boolean(c));
      meilleure = {
        paires,
        ignorees,
        nom: table.nom,
        forme: `table « ${table.nom} », colonnes ${colonnes.join(", ")}`,
      };
    }
  }

  if (!meilleure) {
    throw new RessourceIllisible(
      "Aucune table de cette base ne porte à la fois une position et un texte. " +
        `Tables lues : ${examinees.join(" ; ") || "aucune"}.`,
    );
  }

  return meilleure;
}

/* ──────────────────────────── Mise en ressource ──────────────────────────── */

/** Trois exemples réels, pris loin l'un de l'autre plutôt que tous au début. */
function exemples(entrees: { cle: string; valeur: string }[]): Exemple[] {
  if (entrees.length <= 3) return entrees;
  const rangs = [0, Math.floor(entrees.length / 2), entrees.length - 1];
  return rangs.map((r) => entrees[r]);
}

function verifier(paires: Paire[], type: TypeRessource): string[] {
  const avertissements: string[] = [];

  const vides = paires.filter((p) => p.valeur.trim().length === 0).length;
  if (vides > 0) {
    avertissements.push(
      `${vides} entrée(s) ont un texte vide : elles ne seront pas écrites.`,
    );
  }

  const balises = paires.filter((p) => /<[a-z/][^>]*>/i.test(p.valeur)).length;
  if (balises > 0) {
    avertissements.push(
      `${balises} entrée(s) contiennent des balises HTML ; elles seront écrites ` +
        "telles quelles, sans nettoyage.",
    );
  }

  const vues = new Set<string>();
  let doublons = 0;
  for (const p of paires) {
    const cle = `${p.sourate}:${p.verset}:${p.mot ?? 0}`;
    if (vues.has(cle)) doublons += 1;
    else vues.add(cle);
  }
  if (doublons > 0) {
    avertissements.push(
      `${doublons} position(s) apparaissent plusieurs fois ; la dernière l'emportera.`,
    );
  }

  const melange = paires.filter((p) => (p.mot === null) !== (type === "traduction")).length;
  if (melange > 0) {
    avertissements.push(
      `${melange} entrée(s) n'ont pas la même profondeur de clé que le reste du ` +
        "fichier ; elles seront écartées.",
    );
  }

  return avertissements;
}

function enRessource(moisson: Moisson, format: string): Ressource {
  const { paires, ignorees, forme } = moisson;

  if (paires.length === 0) {
    throw new RessourceIllisible(
      `Aucune entrée exploitable. Ce qui a été reconnu : ${forme}. ` +
        `${ignorees} élément(s) écartés faute de position ou de texte lisibles.`,
    );
  }

  // Le type se décide à la majorité : un fichier mot à mot a des clés à trois
  // nombres, une traduction de versets à deux. Le reste sera écarté.
  const avecMot = paires.filter((p) => p.mot !== null).length;
  const type: TypeRessource = avecMot * 2 >= paires.length ? "mot_a_mot" : "traduction";

  const avertissements = verifier(paires, type);
  const structure = `${forme} — ${paires.length.toLocaleString("fr-FR")} entrées lues.`;

  if (type === "mot_a_mot") {
    const entrees: EntreeMot[] = paires
      .filter((p): p is Paire & { mot: number } => p.mot !== null)
      .filter((p) => p.valeur.trim().length > 0)
      .map((p) => ({ sourate: p.sourate, verset: p.verset, mot: p.mot, valeur: p.valeur }));

    return {
      type,
      entrees,
      diagnostic: {
        type,
        libelle: LIBELLES[type],
        format,
        structure,
        entrees: entrees.length,
        ignorees,
        avertissements,
        exemples: exemples(
          entrees.map((e) => ({
            cle: `${e.sourate}:${e.verset}:${e.mot}`,
            valeur: e.valeur,
          })),
        ),
      },
    };
  }

  const entrees: EntreeVerset[] = paires
    .filter((p) => p.mot === null)
    .filter((p) => p.valeur.trim().length > 0)
    .map((p) => ({ sourate: p.sourate, verset: p.verset, valeur: p.valeur }));

  return {
    type,
    entrees,
    diagnostic: {
      type,
      libelle: LIBELLES[type],
      format,
      structure,
      entrees: entrees.length,
      ignorees,
      avertissements,
      exemples: exemples(
        entrees.map((e) => ({ cle: `${e.sourate}:${e.verset}`, valeur: e.valeur })),
      ),
    },
  };
}

/* ──────────────────────────── Morphologie ──────────────────────────── */

function enMorphologie(contenu: string): Ressource {
  const analyse = analyserCorpus(contenu);
  const entrees: EntreeMorphologie[] = [];

  for (const [cle, mots] of analyse) {
    const [sourate, verset] = cle.split(":").map(Number);
    for (const mot of mots) {
      entrees.push({
        sourate,
        verset,
        mot: mot.position,
        segments: mot.segments,
        racine: mot.racine,
        lemme: mot.lemme,
        categorie: mot.categorie,
        traits: mot.traits,
      });
    }
  }

  if (entrees.length === 0) {
    throw new RessourceIllisible(
      "Le fichier ressemble à du texte tabulé mais aucune ligne n'a la forme " +
        "attendue : position, forme arabe, catégorie, traits, séparés par des tabulations.",
    );
  }

  const avertissements: string[] = [];
  const sansRacine = entrees.filter((e) => e.racine === null).length;
  if (sansRacine > 0) {
    avertissements.push(
      `${sansRacine} mot(s) sans racine dans le fichier — particules et pronoms ` +
        "n'en ont pas ; rien ne sera inventé pour eux.",
    );
  }

  return {
    type: "morphologie",
    entrees,
    diagnostic: {
      type: "morphologie",
      libelle: LIBELLES.morphologie,
      format: "texte tabulé",
      structure:
        `${analyse.size.toLocaleString("fr-FR")} versets analysés, ` +
        `${entrees.length.toLocaleString("fr-FR")} mots.`,
      entrees: entrees.length,
      ignorees: 0,
      avertissements,
      exemples: exemples(
        entrees.map((e) => ({
          cle: `${e.sourate}:${e.verset}:${e.mot}`,
          valeur: [e.segments.join(" + "), e.racine ? `racine ${e.racine}` : null, e.categorie]
            .filter(Boolean)
            .join(" — "),
        })),
      ),
    },
  };
}

/* ─────────────────────────────── Entrée ─────────────────────────────── */

const MAGIE_SQLITE = "SQLite format 3";

/** Un extrait du début du fichier, pour que le message d'erreur soit utile. */
function apercu(contenu: string): string {
  return contenu.slice(0, 180).replace(/\s+/g, " ").trim();
}

/**
 * Ouvre un fichier déposé et dit ce que c'est.
 *
 * Le nom du fichier n'est qu'un indice : c'est le contenu qui décide. Un `.json`
 * mal nommé contenant une base SQLite sera lu comme une base.
 */
export function lireRessource(donnees: ArrayBuffer): Ressource {
  const octets = new Uint8Array(donnees);
  if (octets.length === 0) {
    throw new RessourceIllisible("Le fichier est vide.");
  }

  const tete = new TextDecoder("utf-8").decode(octets.subarray(0, 16));

  if (tete.startsWith(MAGIE_SQLITE)) {
    try {
      return enRessource(moissonnerSqlite(lireSqlite(donnees)), "base SQLite");
    } catch (erreur) {
      if (erreur instanceof SqliteIllisible) {
        throw new RessourceIllisible(`Base SQLite illisible : ${erreur.message}`);
      }
      throw erreur;
    }
  }

  const contenu = new TextDecoder("utf-8").decode(octets);
  const debut = contenu.trimStart();

  if (debut.startsWith("{") || debut.startsWith("[")) {
    let racine: unknown;
    try {
      racine = JSON.parse(debut) as unknown;
    } catch (erreur) {
      throw new RessourceIllisible(
        `Le fichier commence comme du JSON mais ne s'analyse pas : ` +
          `${erreur instanceof Error ? erreur.message : String(erreur)}`,
      );
    }

    const { corps, enveloppe } = deballer(racine);
    const moisson = Array.isArray(corps)
      ? moissonnerTableau(corps)
      : estObjet(corps)
        ? moissonnerObjet(corps)
        : null;

    if (!moisson) {
      throw new RessourceIllisible(
        `Le JSON n'est ni un tableau ni un objet de positions. Début du fichier : ${apercu(debut)}`,
      );
    }

    return enRessource(
      {
        ...moisson,
        forme: enveloppe ? `${moisson.forme}, sous la clé « ${enveloppe} »` : moisson.forme,
      },
      "JSON",
    );
  }

  // Le corpus morphologique : quatre colonnes séparées par des tabulations.
  const premieres = contenu.split("\n", 60).filter((l) => l.trim().length > 0);
  if (premieres.some((l) => l.includes("\t"))) return enMorphologie(contenu);

  throw new RessourceIllisible(
    "Format non reconnu : ce n'est ni du JSON, ni une base SQLite, ni du texte " +
      `tabulé. Début du fichier : ${apercu(debut)}`,
  );
}
