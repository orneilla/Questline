/**
 * Lecture du corpus morphologique — logique pure.
 *
 * Le fichier retenu est le fork de Mustafa (mustafa0x/quran-morphology), issu
 * du Quranic Arabic Corpus v0.4. Sa forme diffère de celle du 0.4 officiel, et
 * c'est cette forme-ci qui est analysée, pas la documentée :
 *
 *   1:1:1:1⇥بِ⇥P⇥P|PREF|LEM:ب
 *   1:1:1:2⇥سْمِ⇥N⇥ROOT:سمو|LEM:اسْم|M|GEN
 *   1:5:4:1⇥نَسْتَعِينُ⇥V⇥IMPF|VF:10|ROOT:عون|LEM:اسْتَعِينُ|1P|MOOD:IND
 *
 * — quatre colonnes séparées par des tabulations, toujours ;
 * — la localisation `sourate:verset:mot:segment` sans parenthèses ;
 * — la deuxième colonne porte l'arabe réel, non du Buckwalter ;
 * — la troisième une catégorie grossière : N, P ou V, rien d'autre ;
 * — la quatrième les traits, séparés par des barres verticales, où l'on trouve
 *   ROOT, LEM, VF (forme verbale, 1 à 11), MOOD, FAM, et des drapeaux nus —
 *   PREF, SUFF, PRON, DET, PN, ADJ, CONJ, NEG, REL, les cas et les personnes,
 *   plus les étiquettes propres à ce fork : NV, ATT, DIST, ADDR.
 *
 * Un mot est fait de plusieurs segments. Le radical est celui qui porte une
 * racine, ou à défaut le premier qui n'est ni préfixe ni suffixe : c'est de lui
 * que viennent la catégorie et les traits retenus. Les parenthèses de l'ancien
 * format sont tolérées, pour qu'un fichier au 0.4 officiel ne casse rien.
 */

export type SegmentMot = {
  /** L'arabe du segment, recopié tel quel. */
  forme: string;
  categorie: string;
  traits: string[];
};

export type MotAnalyse = {
  position: number;
  segments: string[];
  racine: string | null;
  lemme: string | null;
  categorie: string;
  traits: string;
};

/** Un trait porté par le radical, jamais par un affixe. */
const AFFIXES = new Set(["PREF", "SUFF"]);

function valeur(traits: string[], cle: string): string | null {
  const prefixe = `${cle}:`;
  const trouve = traits.find((t) => t.startsWith(prefixe));
  return trouve ? trouve.slice(prefixe.length) : null;
}

/** Le segment qui porte le sens : celui qui a une racine, sinon le radical. */
function radical(segments: SegmentMot[]): SegmentMot {
  return (
    segments.find((s) => valeur(s.traits, "ROOT") !== null) ??
    segments.find((s) => !s.traits.some((t) => AFFIXES.has(t))) ??
    segments[0]
  );
}

export function analyserCorpus(contenu: string): Map<string, MotAnalyse[]> {
  const parVerset = new Map<string, Map<number, SegmentMot[]>>();

  for (const ligne of contenu.split("\n")) {
    const colonnes = ligne.replace(/\r$/, "").split("\t");
    if (colonnes.length < 3) continue;

    // Les parenthèses n'existent pas dans ce fork ; on les tolère quand même.
    const reperes = colonnes[0].replace(/[()]/g, "").split(":").map(Number);
    if (reperes.length < 3 || reperes.some((n) => !Number.isInteger(n))) continue;

    const [sourate, verset, mot] = reperes;
    const cle = `${sourate}:${verset}`;
    const mots = parVerset.get(cle) ?? new Map<number, SegmentMot[]>();
    const segments = mots.get(mot) ?? [];

    segments.push({
      forme: colonnes[1] ?? "",
      categorie: colonnes[2] ?? "",
      traits: (colonnes[3] ?? "").split("|").filter((t) => t.length > 0),
    });

    mots.set(mot, segments);
    parVerset.set(cle, mots);
  }

  const sortie = new Map<string, MotAnalyse[]>();
  for (const [cle, mots] of parVerset) {
    const analyses = [...mots.entries()]
      .sort(([a], [b]) => a - b)
      .map(([position, segments]) => {
        const noyau = radical(segments);
        return {
          position,
          segments: segments.map((s) => s.forme),
          racine: valeur(noyau.traits, "ROOT"),
          lemme: valeur(noyau.traits, "LEM"),
          categorie: noyau.categorie,
          traits: noyau.traits.join("|"),
        };
      });
    sortie.set(cle, analyses);
  }
  return sortie;
}

/* ──────────────────── Ce que les codes veulent dire ──────────────────── */

const ASPECTS: Record<string, string> = {
  PERF: "accompli",
  IMPF: "inaccompli",
  IMPV: "impératif",
};

const NATURES: Record<string, string> = {
  PN: "nom propre",
  ADJ: "adjectif",
  ACT_PCPL: "participe actif",
  PASS_PCPL: "participe passif",
  PRON: "pronom",
  DET: "article",
  CONJ: "conjonction",
  NEG: "négation",
  REL: "pronom relatif",
  REM: "reprise",
  ATT: "particule d'attention",
  DIST: "marque d'éloignement",
  ADDR: "marque d'adresse",
  NV: "nom verbal",
};

/**
 * Traduit les codes du corpus en français.
 *
 * C'est de la terminologie grammaticale, pas de l'exégèse : « IMPF|VF:10 »
 * devient « verbe inaccompli, forme X ». Les codes bruts restent affichés à
 * côté — ce qui est recopié du corpus doit rester lisible tel quel.
 */
export function libelleGrammatical(categorie: string, traits: string): string {
  const liste = traits.split("|").filter(Boolean);
  const nature = liste.find((t) => t in NATURES);

  if (categorie === "V") {
    const aspect = liste.map((t) => ASPECTS[t]).find(Boolean);
    const forme = liste.find((t) => t.startsWith("VF:"))?.slice(3);
    const romaine = forme ? ROMAINS[Number(forme)] : undefined;
    return [
      "verbe",
      aspect,
      romaine ? `forme ${romaine}` : null,
    ]
      .filter(Boolean)
      .join(", ");
  }

  if (categorie === "N") return nature ? NATURES[nature] : "nom";
  if (categorie === "P") return nature ? NATURES[nature] : "particule";
  return nature ? NATURES[nature] : categorie;
}

const ROMAINS: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
  10: "X",
  11: "XI",
};
