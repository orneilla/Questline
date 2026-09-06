import { deviner } from "./categories";

/**
 * Lecture de la table Ciqual de l'Anses — logique pure, sans base ni réseau.
 *
 * Le même code sert au script en ligne de commande et à la route de dépôt
 * depuis le navigateur : deux lecteurs qui divergeraient finiraient par ne plus
 * importer la même chose.
 *
 * ── Le principe : reconnaître, puis dire ce qu'on a reconnu
 *
 * Le fichier ne vient pas d'ici et son format peut changer d'une édition à
 * l'autre. Plutôt que de deviner en silence, le lecteur rend un diagnostic :
 * quelles colonnes il a associées à quels nutriments, et combien d'aliments il
 * a vus. Une association fausse se voit alors avant l'import, pas six mois
 * plus tard dans un compteur qui ment.
 *
 * Si le format n'est pas reconnu, on refuse. On n'importe pas à moitié.
 */

export type NutrimentCle =
  | "kcal100g"
  | "proteines100g"
  | "glucides100g"
  | "sucres100g"
  | "lipides100g"
  | "ags100g"
  | "fibres100g"
  | "sel100g";

export type AlimentLu = {
  code: string;
  nom: string;
  categorie: string;
  etat: "cru" | "cuit";
  valeurs: Partial<Record<NutrimentCle, number>>;
};

export type DiagnosticCiqual = {
  format: "xml" | "csv";
  /** Ce que chaque nutriment a trouvé en face de lui, pour vérification. */
  associations: { nutriment: NutrimentCle; libelle: string }[];
  /** Nutriments qu'aucune colonne n'a pu renseigner. */
  absents: NutrimentCle[];
  aliments: number;
  cuits: number;
  crus: number;
};

export type LectureCiqual = {
  diagnostic: DiagnosticCiqual;
  aliments: AlimentLu[];
};

export const LIBELLES_NUTRIMENTS: Record<NutrimentCle, string> = {
  kcal100g: "Énergie (kcal)",
  proteines100g: "Protéines",
  glucides100g: "Glucides",
  sucres100g: "Sucres",
  lipides100g: "Lipides",
  ags100g: "Acides gras saturés",
  fibres100g: "Fibres",
  sel100g: "Sel",
};

/* ─────────────────────────── Valeurs ─────────────────────────── */

function plier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Une teneur Ciqual, telle qu'elle est écrite.
 *
 * Le fichier ne contient pas que des nombres : « traces », « < 0,1 », « - »
 * quand la mesure n'a pas été faite. Les trois se traitent différemment.
 *
 * — « traces » vaut zéro : c'est ce que le mot signifie.
 * — « < 0,1 » vaut 0,1, la borne haute. Sur le sel et les sucres, arrondir
 *   vers le bas embellirait le compte ; on préfère l'inverse.
 * — un tiret, un vide ou « ND » ne valent rien du tout, et rendent `null` :
 *   écrire zéro serait affirmer une mesure qui n'existe pas.
 */
export function lireTeneur(brut: string | null | undefined): number | null {
  if (brut === null || brut === undefined) return null;

  const texte = plier(String(brut))
    .replace(/ /g, "")
    .replace(/\s/g, "");
  if (texte.length === 0) return null;
  if (texte === "-" || texte === "nd" || texte === "na") return null;
  if (texte.includes("trace")) return 0;

  const nombre = Number(texte.replace(/^</, "").replace(",", "."));
  return Number.isFinite(nombre) ? nombre : null;
}

/* ─────────────────────── Association des colonnes ─────────────────────── */

/**
 * Ce qui doit se trouver dans le libellé d'une colonne pour qu'elle soit
 * retenue. L'ordre compte : le premier motif qui trouve preneur gagne, et une
 * colonne déjà prise ne se réutilise pas — sans quoi « glucides » attraperait
 * aussi la colonne des sucres.
 */
const MOTIFS: { cle: NutrimentCle; motifs: RegExp[] }[] = [
  {
    cle: "kcal100g",
    motifs: [/energie.*kcal/, /^energie$/, /\bkcal\b/],
  },
  { cle: "ags100g", motifs: [/ag satures/, /acides gras satures/, /\bags\b/] },
  { cle: "sucres100g", motifs: [/^sucres/, /\bsucres\b/] },
  { cle: "fibres100g", motifs: [/fibres alimentaires/, /\bfibres\b/] },
  { cle: "proteines100g", motifs: [/proteines.*jones/, /^proteines/, /\bproteines\b/] },
  { cle: "glucides100g", motifs: [/^glucides/, /\bglucides\b/] },
  { cle: "lipides100g", motifs: [/^lipides/, /\blipides\b/] },
  { cle: "sel100g", motifs: [/sel chlorure/, /^sel\b/, /\bsel\b/] },
];

/**
 * Associe chaque nutriment à un libellé de colonne.
 *
 * Rend aussi les nutriments restés sans colonne : mieux vaut importer huit
 * champs sur huit en le sachant, ou six en le sachant, qu'un chiffre inventé.
 */
export function associer(libelles: string[]): {
  choix: Map<NutrimentCle, number>;
  absents: NutrimentCle[];
} {
  const plies = libelles.map(plier);
  const choix = new Map<NutrimentCle, number>();
  const pris = new Set<number>();
  const absents: NutrimentCle[] = [];

  for (const { cle, motifs } of MOTIFS) {
    let trouve = -1;
    for (const motif of motifs) {
      const index = plies.findIndex((l, i) => !pris.has(i) && motif.test(l));
      if (index >= 0) {
        trouve = index;
        break;
      }
    }
    if (trouve >= 0) {
      choix.set(cle, trouve);
      pris.add(trouve);
    } else {
      absents.push(cle);
    }
  }

  return { choix, absents };
}

/* ───────────────────────────── État ───────────────────────────── */

/**
 * Cru ou cuit, d'après le libellé.
 *
 * Ciqual écrit l'état dans le nom : « Riz blanc, cru », « Riz blanc, cuit ».
 * Ce qui ne dit rien est rangé en cru, parce que c'est ce que « 100 g de ce
 * produit tel qu'il est » veut dire pour une huile ou une pomme. Le compte des
 * deux est rendu dans le diagnostic : un déséquilibre absurde se verrait.
 */
export function lireEtat(nom: string): "cru" | "cuit" {
  const plie = plier(nom);
  if (/\bcuit(e|s|es)?\b/.test(plie)) return "cuit";
  if (/\b(braise|roti|grille|frit|bouilli|poele|vapeur|au four)\b/.test(plie)) {
    return "cuit";
  }
  return "cru";
}

/* ───────────────────────────── CSV ───────────────────────────── */

/** Découpe une ligne CSV en respectant les guillemets. */
export function decouper(ligne: string, separateur: string): string[] {
  const cellules: string[] = [];
  let courante = "";
  let dansGuillemets = false;

  for (let i = 0; i < ligne.length; i += 1) {
    const c = ligne[i];
    if (c === '"') {
      if (dansGuillemets && ligne[i + 1] === '"') {
        courante += '"';
        i += 1;
      } else {
        dansGuillemets = !dansGuillemets;
      }
      continue;
    }
    if (c === separateur && !dansGuillemets) {
      cellules.push(courante);
      courante = "";
      continue;
    }
    courante += c;
  }
  cellules.push(courante);
  return cellules.map((c) => c.trim());
}

/** Le séparateur le plus probable, déduit de la ligne d'en-tête. */
function separateurDe(entete: string): string {
  const candidats = [";", "\t", ","];
  let meilleur = ";";
  let compte = -1;
  for (const c of candidats) {
    const n = decouper(entete, c).length;
    if (n > compte) {
      compte = n;
      meilleur = c;
    }
  }
  return meilleur;
}

function lireCsv(contenu: string): LectureCiqual {
  const lignes = contenu.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lignes.length < 2) throw new Error("Fichier CSV vide ou sans données.");

  const separateur = separateurDe(lignes[0]);
  const entete = decouper(lignes[0], separateur);
  const { choix, absents } = associer(entete);

  const plies = entete.map(plier);
  const colNom = plies.findIndex((l) => /alim_nom_fr|nom.*aliment|^nom$/.test(l));
  const colCode = plies.findIndex((l) => /alim_code|^code$/.test(l));
  const colGroupe = plies.findIndex((l) => /grp_nom_fr|groupe|categorie/.test(l));

  if (colNom < 0) {
    throw new Error(
      "Aucune colonne de nom d'aliment trouvée (attendu « alim_nom_fr » ou « nom »).",
    );
  }
  if (choix.size === 0) {
    throw new Error("Aucune colonne nutritionnelle reconnue dans l'en-tête.");
  }

  const aliments: AlimentLu[] = [];
  for (let i = 1; i < lignes.length; i += 1) {
    const cellules = decouper(lignes[i], separateur);
    const nom = cellules[colNom]?.trim();
    if (!nom) continue;

    const valeurs: Partial<Record<NutrimentCle, number>> = {};
    for (const [cle, index] of choix) {
      const valeur = lireTeneur(cellules[index]);
      if (valeur !== null) valeurs[cle] = valeur;
    }

    aliments.push({
      code: (colCode >= 0 ? cellules[colCode]?.trim() : "") || `csv:${i}`,
      nom,
      categorie: deviner(colGroupe >= 0 ? `${cellules[colGroupe]} ${nom}` : nom),
      etat: lireEtat(nom),
      valeurs,
    });
  }

  return {
    aliments,
    diagnostic: bilan("csv", entete, choix, absents, aliments),
  };
}

/* ───────────────────────────── XML ───────────────────────────── */

function contenuBalise(bloc: string, balise: string): string | null {
  const motif = new RegExp(`<${balise}>([\\s\\S]*?)</${balise}>`, "i");
  const trouve = bloc.match(motif);
  if (!trouve) return null;
  return trouve[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function blocs(contenu: string, balise: string): string[] {
  const motif = new RegExp(`<${balise}(?:\\s[^>]*)?>([\\s\\S]*?)</${balise}>`, "gi");
  return [...contenu.matchAll(motif)].map((m) => m[1]);
}

/**
 * L'export XML de l'Anses : une table ALIM (les aliments) et une table COMPO
 * (une ligne par aliment et par constituant).
 *
 * Extraction ciblée plutôt qu'un vrai analyseur XML : le fichier est plat et
 * régulier, et ajouter une dépendance pour trois balises n'en vaut pas le prix.
 */
function lireXml(contenu: string): LectureCiqual {
  const alims = blocs(contenu, "ALIM");
  const compos = blocs(contenu, "COMPO");

  if (alims.length === 0) {
    throw new Error("Aucun bloc <ALIM> trouvé : ce n'est pas l'export XML Ciqual.");
  }
  if (compos.length === 0) {
    throw new Error(
      "Aucun bloc <COMPO> trouvé : le fichier ne contient pas les teneurs.",
    );
  }

  // Les libellés de constituants, dédupliqués, pour l'association.
  const libelleParCode = new Map<string, string>();
  for (const bloc of compos) {
    const code = contenuBalise(bloc, "const_code");
    const nom = contenuBalise(bloc, "const_nom_fr");
    if (code && nom && !libelleParCode.has(code)) libelleParCode.set(code, nom);
  }

  const codes = [...libelleParCode.keys()];
  const libelles = codes.map((c) => libelleParCode.get(c) ?? "");
  const { choix, absents } = associer(libelles);

  // On repasse de « index dans la liste » à « code de constituant ».
  const codeParNutriment = new Map<string, NutrimentCle>();
  for (const [cle, index] of choix) codeParNutriment.set(codes[index], cle);

  const parCode = new Map<string, AlimentLu>();
  for (const bloc of alims) {
    const code = contenuBalise(bloc, "alim_code");
    const nom = contenuBalise(bloc, "alim_nom_fr");
    if (!code || !nom) continue;
    const groupe =
      contenuBalise(bloc, "alim_ssssgrp_nom_fr") ??
      contenuBalise(bloc, "alim_sssgrp_nom_fr") ??
      contenuBalise(bloc, "alim_ssgrp_nom_fr") ??
      contenuBalise(bloc, "alim_grp_nom_fr") ??
      "";

    parCode.set(code, {
      code,
      nom,
      categorie: deviner(`${groupe} ${nom}`),
      etat: lireEtat(nom),
      valeurs: {},
    });
  }

  for (const bloc of compos) {
    const alim = contenuBalise(bloc, "alim_code");
    const constituant = contenuBalise(bloc, "const_code");
    if (!alim || !constituant) continue;

    const cle = codeParNutriment.get(constituant);
    const cible = parCode.get(alim);
    if (!cle || !cible) continue;

    const valeur = lireTeneur(contenuBalise(bloc, "teneur"));
    if (valeur !== null) cible.valeurs[cle] = valeur;
  }

  const aliments = [...parCode.values()];
  return { aliments, diagnostic: bilan("xml", libelles, choix, absents, aliments) };
}

function bilan(
  format: "xml" | "csv",
  libelles: string[],
  choix: Map<NutrimentCle, number>,
  absents: NutrimentCle[],
  aliments: AlimentLu[],
): DiagnosticCiqual {
  return {
    format,
    associations: [...choix.entries()].map(([nutriment, index]) => ({
      nutriment,
      libelle: libelles[index] ?? "",
    })),
    absents,
    aliments: aliments.length,
    cuits: aliments.filter((a) => a.etat === "cuit").length,
    crus: aliments.filter((a) => a.etat === "cru").length,
  };
}

/* ─────────────────────────── Entrée ─────────────────────────── */

/**
 * Lit le fichier, quel que soit son format, ou refuse en disant pourquoi.
 *
 * L'XLS binaire n'est pas lu : il demanderait une dépendance entière pour un
 * import qui n'a lieu qu'une fois. Le tableur sait exporter en CSV, et le
 * message le dit plutôt que de laisser deviner.
 */
export function lireCiqual(contenu: string): LectureCiqual {
  const debut = contenu.slice(0, 4000);

  if (/<\?xml|<ALIM[\s>]/i.test(debut)) return lireXml(contenu);
  if (debut.startsWith("PK") || debut.startsWith("\xd0\xcf")) {
    throw new Error(
      "Ce fichier est un classeur binaire (XLS/XLSX). Enregistre-le en CSV " +
        "depuis le tableur, puis redépose-le.",
    );
  }
  if (debut.includes(";") || debut.includes("\t") || debut.includes(",")) {
    return lireCsv(contenu);
  }

  throw new Error("Format non reconnu : ni XML Ciqual, ni CSV.");
}
