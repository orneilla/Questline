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
 * L'export XML de l'Anses n'est pas un fichier, c'est une famille.
 *
 * Il vient en plusieurs documents séparés : les aliments d'un côté (ALIM), les
 * teneurs de l'autre (COMPO — une ligne par aliment et par constituant), et
 * souvent les libellés des constituants dans un troisième (CONST). Une table
 * relationnelle exportée table par table, en somme.
 *
 * Le lecteur les prend donc ensemble, dans n'importe quel ordre, et ne se
 * plaint que de ce qui manque vraiment. Attendre les trois dans un seul
 * document — ce que faisait la première version — revenait à refuser le
 * fichier officiel.
 *
 * Extraction ciblée plutôt qu'un vrai analyseur XML : les documents sont plats
 * et réguliers, et ajouter une dépendance pour quatre balises n'en vaut pas le
 * prix sur un import qui n'a lieu qu'une fois.
 */

/** Ce qu'un document apporte, sans encore savoir ce que les autres apportent. */
export type ApportXml = {
  aliments: AlimentLu[];
  /** Libellés de constituants rencontrés, par code. */
  constituants: Map<string, string>;
  /** Le texte, gardé pour la passe des teneurs — voir `assembler`. */
  contenu: string;
  nbCompo: number;
};

export function lireApportXml(contenu: string): ApportXml {
  const aliments: AlimentLu[] = [];
  for (const bloc of blocs(contenu, "ALIM")) {
    const code = contenuBalise(bloc, "alim_code");
    const nom = contenuBalise(bloc, "alim_nom_fr");
    if (!code || !nom) continue;
    const groupe =
      contenuBalise(bloc, "alim_ssssgrp_nom_fr") ??
      contenuBalise(bloc, "alim_sssgrp_nom_fr") ??
      contenuBalise(bloc, "alim_ssgrp_nom_fr") ??
      contenuBalise(bloc, "alim_grp_nom_fr") ??
      "";

    aliments.push({
      code,
      nom,
      categorie: deviner(`${groupe} ${nom}`),
      etat: lireEtat(nom),
      valeurs: {},
    });
  }

  // Les libellés viennent soit d'un document CONST, soit des lignes COMPO
  // elles-mêmes quand l'édition les y répète. On prend les deux.
  const constituants = new Map<string, string>();
  const relever = (bloc: string) => {
    const code = contenuBalise(bloc, "const_code");
    const nom = contenuBalise(bloc, "const_nom_fr");
    if (code && nom && !constituants.has(code)) constituants.set(code, nom);
  };
  for (const bloc of blocs(contenu, "CONST")) relever(bloc);

  let nbCompo = 0;
  for (const bloc of blocs(contenu, "COMPO")) {
    nbCompo += 1;
    relever(bloc);
  }

  return { aliments, constituants, contenu, nbCompo };
}

/** Ce qu'il manque encore pour pouvoir écrire quoi que ce soit. */
export type Manque = "aliments" | "teneurs" | "libelles";

export const LIBELLES_MANQUE: Record<Manque, string> = {
  aliments: "la liste des aliments (blocs <ALIM>)",
  teneurs: "les teneurs (blocs <COMPO>)",
  libelles: "les noms des constituants (blocs <CONST>)",
};

export function manquantsXml(apports: ApportXml[]): Manque[] {
  const manque: Manque[] = [];
  if (apports.every((a) => a.aliments.length === 0)) manque.push("aliments");
  if (apports.every((a) => a.nbCompo === 0)) manque.push("teneurs");
  if (apports.every((a) => a.constituants.size === 0)) manque.push("libelles");
  return manque;
}

/**
 * Recolle les documents en une lecture unique.
 *
 * Deux passes sur les teneurs, et c'est voulu. La première ne relève que les
 * couples code/libellé pour savoir quels constituants nous intéressent ; la
 * seconde ne garde que ceux-là. Tout charger d'abord pour trier ensuite
 * demanderait de tenir en mémoire des centaines de milliers de lignes dont on
 * jette les neuf dixièmes — sur un téléphone, ça ne passe pas.
 */
export function assemblerXml(apports: ApportXml[]): LectureCiqual {
  const manque = manquantsXml(apports);
  if (manque.length > 0) {
    throw new Error(
      `Il manque ${manque.map((m) => LIBELLES_MANQUE[m]).join(" et ")}. ` +
        "L'export Ciqual est livré en plusieurs fichiers : dépose-les ensemble.",
    );
  }

  const constituants = new Map<string, string>();
  for (const apport of apports) {
    for (const [code, nom] of apport.constituants) {
      if (!constituants.has(code)) constituants.set(code, nom);
    }
  }

  const codes = [...constituants.keys()];
  const libelles = codes.map((c) => constituants.get(c) ?? "");
  const { choix, absents } = associer(libelles);

  const codeParNutriment = new Map<string, NutrimentCle>();
  for (const [cle, index] of choix) codeParNutriment.set(codes[index], cle);

  const parCode = new Map<string, AlimentLu>();
  for (const apport of apports) {
    for (const aliment of apport.aliments) {
      if (!parCode.has(aliment.code)) parCode.set(aliment.code, aliment);
    }
  }

  for (const apport of apports) {
    if (apport.nbCompo === 0) continue;
    for (const bloc of blocs(apport.contenu, "COMPO")) {
      const constituant = contenuBalise(bloc, "const_code");
      if (!constituant) continue;
      const cle = codeParNutriment.get(constituant);
      if (!cle) continue;

      const alim = contenuBalise(bloc, "alim_code");
      if (!alim) continue;
      const cible = parCode.get(alim);
      if (!cible) continue;

      const valeur = lireTeneur(contenuBalise(bloc, "teneur"));
      if (valeur !== null) cible.valeurs[cle] = valeur;
    }
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
export type Fichier = { nom: string; contenu: string };

function estXml(contenu: string): boolean {
  const debut = contenu.slice(0, 4000);
  return /<\?xml|<(ALIM|COMPO|CONST)[\s>]/i.test(debut);
}

function refuserBinaire(fichier: Fichier): void {
  const debut = fichier.contenu.slice(0, 8);
  if (debut.startsWith("PK")) {
    throw new Error(
      `« ${fichier.nom} » est une archive compressée. Ouvre-la d'abord dans ` +
        "Fichiers, puis dépose les documents qu'elle contient.",
    );
  }
  if (debut.startsWith("\xd0\xcf")) {
    throw new Error(
      `« ${fichier.nom} » est un classeur binaire (XLS/XLSX). Enregistre-le en ` +
        "CSV depuis le tableur, puis redépose-le.",
    );
  }
}

/**
 * Lit un ou plusieurs fichiers, quel que soit leur format, ou refuse en disant
 * pourquoi.
 *
 * Un CSV Ciqual se suffit à lui-même : une ligne par aliment, les nutriments en
 * colonnes. L'XML, lui, arrive éclaté en plusieurs documents et doit être
 * recollé — d'où cette entrée qui en prend plusieurs.
 *
 * L'XLS binaire n'est pas lu : il demanderait une dépendance entière pour un
 * import qui n'a lieu qu'une fois. Le tableur sait exporter en CSV, et le
 * message le dit plutôt que de laisser deviner.
 */
export function lireCiqualMulti(fichiers: Fichier[]): LectureCiqual {
  if (fichiers.length === 0) throw new Error("Aucun fichier.");

  for (const fichier of fichiers) refuserBinaire(fichier);

  const xml = fichiers.filter((f) => estXml(f.contenu));
  const autres = fichiers.filter((f) => !estXml(f.contenu));

  if (xml.length > 0) {
    if (autres.length > 0) {
      throw new Error(
        "Mélange de formats : dépose soit les documents XML ensemble, soit le CSV seul.",
      );
    }
    return assemblerXml(xml.map((f) => lireApportXml(f.contenu)));
  }

  if (autres.length > 1) {
    throw new Error("Un seul fichier CSV à la fois : celui-ci se suffit à lui-même.");
  }

  const seul = autres[0];
  const debut = seul.contenu.slice(0, 4000);
  if (debut.includes(";") || debut.includes("\t") || debut.includes(",")) {
    return lireCsv(seul.contenu);
  }

  throw new Error(`« ${seul.nom} » n'est ni un document XML Ciqual, ni un CSV.`);
}

/** Un seul fichier — le chemin du script en ligne de commande. */
export function lireCiqual(contenu: string): LectureCiqual {
  return lireCiqualMulti([{ nom: "fichier", contenu }]);
}
