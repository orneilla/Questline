/**
 * Groupes protecteurs courants — CH0905, Synthèse totale de produits naturels.
 *
 * La matière et son ordre sont ceux du fascicule du Pr J.-B. Behr : alcools
 * (éthers alkyles, acétals, éthers silylés, esters), diols, cétones, amines.
 * Chaque groupe devient une fiche, et chaque fiche une poignée de cartes
 * courtes — une question par carte : structure, pose, retrait, stabilité,
 * sélectivité. Un dernier paquet croise tout, réactif par réactif : c'est là
 * que se joue l'orthogonalité, ce qu'on demande vraiment en synthèse.
 *
 * Les explications « pourquoi » sont des ajouts au fascicule, limitées à ce
 * qui est établi. Deux coquilles du fascicule sont signalées sur les cartes
 * concernées plutôt que recopiées : les noms dioxane/dioxolane inversés
 * (p. 5) et le chlorure de Troc (p. 10).
 */

import type { Catalogue, NoteCatalogue, PaquetCatalogue } from "./types";
import { STRUCTURES_GROUPES_PROTECTEURS } from "./groupes-protecteurs-structures";

const img = (cle: string) => `[[structure:${cle}]]`;
const liste = (elements: string[]) => elements.map((e) => `- ${e}`).join("\n");

type Fonction = "alcool" | "diol" | "cetone" | "amine";

type Fiche = {
  cle: string;
  /** Tel qu'on l'écrit dans un schéma : TBS, Boc… */
  abrev: string;
  nom: string;
  /** Formule condensée, telle que dans le fascicule. */
  formule: string;
  structure: string;
  fonction: Fonction;
  famille: string;
  page: number;
  protection: string[];
  deprotection: string[];
  stabilite?: string[];
  instable?: string[];
  selectivite?: string;
  /** Image affichée au verso de la carte de pose, à la place de la structure seule. */
  schemaPose?: string;
  schemaRetrait?: string;
  pourquoi?: Partial<Record<"protection" | "deprotection" | "stabilite" | "selectivite", string>>;
};

const FAMILLE: Record<string, string> = {
  "ether-alkyle": "éther alkyle",
  acetal: "acétal",
  silyle: "éther silylé",
  ester: "ester",
  "acetal-cyclique": "acétal cyclique",
  carbonate: "carbonate",
  orthoester: "orthoester",
  alkylamine: "alkylamine",
  amide: "amide",
  carbamate: "carbamate",
  sulfonamide: "sulfonamide",
};

const ARTICLE: Record<Fonction, string> = {
  alcool: "un alcool",
  diol: "un diol",
  cetone: "une cétone",
  amine: "une amine",
};

function note(
  cle: string,
  recto: string,
  verso: string,
  tags: string[],
  notes?: string,
): NoteCatalogue {
  return { cle, recto, verso, tags: ["groupes-protecteurs", ...tags], notes };
}

function source(page: number, pourquoi?: string): string {
  const ref = `Fascicule CH0905, p. ${page}.`;
  return pourquoi ? `${pourquoi} — ${ref}` : ref;
}

/** Une fiche du fascicule → ses cartes, toujours dans le même ordre. */
function fiche(f: Fiche): NoteCatalogue[] {
  const tags = [f.fonction, f.famille, f.cle];
  const titre = `**${f.abrev}**`;
  const cartes: NoteCatalogue[] = [
    note(
      `${f.cle}:structure`,
      `Structure de ${titre} ?\n\n*${f.nom}*`,
      `${img(f.structure)}\n\n${f.formule}`,
      [...tags, "structure"],
      source(f.page),
    ),
    note(
      `${f.cle}:nom`,
      `${img(f.structure)}\n\nQuel groupe protecteur ?`,
      `${titre} — *${f.nom}*\n\nprotège ${ARTICLE[f.fonction]} · ${FAMILLE[f.famille] ?? f.famille}`,
      [...tags, "structure"],
      source(f.page),
    ),
  ];

  if (f.selectivite) {
    cartes.push(
      note(
        `${f.cle}:selectivite`,
        `Sélectivité de ${titre} ?`,
        f.selectivite,
        [...tags, "selectivite"],
        source(f.page, f.pourquoi?.selectivite),
      ),
    );
  }

  cartes.push(
    note(
      `${f.cle}:protection`,
      `**Poser** ${titre}\n\n${img(f.structure)}`,
      `${liste(f.protection)}${f.schemaPose ? `\n\n${img(f.schemaPose)}` : ""}`,
      [...tags, "protection"],
      source(f.page, f.pourquoi?.protection),
    ),
    note(
      `${f.cle}:deprotection`,
      `**Retirer** ${titre}\n\n${img(f.structure)}`,
      `${liste(f.deprotection)}${f.schemaRetrait ? `\n\n${img(f.schemaRetrait)}` : ""}`,
      [...tags, "deprotection"],
      source(f.page, f.pourquoi?.deprotection),
    ),
  );

  if (f.stabilite) {
    const verso =
      liste(f.stabilite) +
      (f.instable ? `\n\n**Mais pas :** ${f.instable.join(" · ")}` : "");
    cartes.push(
      note(
        `${f.cle}:stabilite`,
        `${titre} résiste à… ?`,
        verso,
        [...tags, "stabilite"],
        source(f.page, f.pourquoi?.stabilite),
      ),
    );
  }

  return cartes;
}

/* ═════════════════════════════ 1 · Alcools ═════════════════════════════ */

const ALCOOLS: NoteCatalogue[] = [
  note(
    "alcool:familles",
    "Protéger un **alcool** R–OH : les quatre familles ?",
    liste([
      "**éthers alkyles** R–O–R′ (t-Bu, allyle, Bn, PMB, Tr)",
      "**acétals** R–O–CHR–O–R′ (MOM, BOM, SEM, THP)",
      "**éthers silylés** R–O–SiR₃ (TMS, TBS, TIPS, TBDPS)",
      "**esters** R–O–COR′ (formate, Ac, Piv, Bz)",
    ]),
    ["alcool", "familles"],
    source(1),
  ),

  // a) Éthers alkyles
  ...fiche({
    cle: "tbu",
    abrev: "t-Bu",
    nom: "éther tert-butylique",
    formule: "R–O–C(CH₃)₃",
    structure: "tbu",
    fonction: "alcool",
    famille: "ether-alkyle",
    page: 1,
    protection: [
      "H⁺, CH₂=C(CH₃)₂ (isobutène), solvant anhydre",
      "BF₃·OEt₂, CH₂=C(CH₃)₂",
    ],
    deprotection: ["HBr, AcOH", "CF₃CO₂H (TFA)", "Me₃SiI"],
    stabilite: ["H⁺ faible", "bases (B⁻)", "hydrures (H⁻)", "H₂"],
    pourquoi: {
      protection: "L'isobutène protoné donne le cation tert-butyle, que l'alcool piège",
      deprotection: "Le chemin inverse : en acide fort, le cation tert-butyle repart (→ isobutène)",
    },
  }),
  ...fiche({
    cle: "allyl",
    abrev: "All",
    nom: "éther allylique",
    formule: "R–O–CH₂CH=CH₂",
    structure: "allyl",
    fonction: "alcool",
    famille: "ether-alkyle",
    page: 1,
    protection: ["NaH, THF, BrCH₂CH=CH₂"],
    deprotection: [
      "**en une étape :** Pd/C, MeOH, H₂O, APTS cat. (ou HClO₄ cat.)",
      "**en deux étapes :** 1) isomérisation en éther d'énol R–O–CH=CHCH₃ — t-BuOK, DMSO, 100 °C ou (Ph₃P)₃RhCl, DABCO, EtOH, reflux ; 2) coupure de l'éther d'énol — O₃, ou HCl acétone–eau, ou KMnO₄, NaOH, H₂O",
    ],
    schemaRetrait: "allyl-deux-etapes",
    pourquoi: {
      deprotection:
        "Un éther allylique est un éther robuste ; isomérisé en éther d'énol, il devient fragile en acide",
    },
  }),
  ...fiche({
    cle: "bn",
    abrev: "Bn",
    nom: "éther benzylique",
    formule: "R–O–CH₂Ph",
    structure: "bn",
    fonction: "alcool",
    famille: "ether-alkyle",
    page: 1,
    protection: ["BnBr, NaH, Bu₄N⁺I⁻, THF", "BnX (X = Cl, Br), Ag₂O, DMF"],
    deprotection: [
      "H₂, Pd/C, EtOH (hydrogénolyse)",
      "Na, NH₃, EtOH",
      "Me₃SiI",
      "BCl₃, CH₂Cl₂",
      "réduction électrolytique −3,1 V, R₄N⁺F⁻, DMF",
    ],
    pourquoi: {
      protection:
        "Synthèse de Williamson : NaH forme l'alcoolate ; l'iodure échange le brome et donne BnI, plus réactif",
      deprotection: "La liaison C–O benzylique se coupe par hydrogénolyse : l'alcool et du toluène",
    },
  }),
  ...fiche({
    cle: "pmb",
    abrev: "PMB",
    nom: "para-méthoxybenzyle",
    formule: "R–O–CH₂C₆H₄OMe",
    structure: "pmb",
    fonction: "alcool",
    famille: "ether-alkyle",
    page: 1,
    protection: ["PMBBr, NaH, DMF"],
    deprotection: [
      "**DDQ ou CAN**, CH₂Cl₂, H₂O — ne touche pas un Bn",
      "TFA",
      "H₂, Pd/C, EtOH (comme un Bn)",
    ],
    pourquoi: {
      deprotection:
        "Le méthoxy en para enrichit le cycle : DDQ ou CAN l'oxydent, alors que le Bn, moins riche, résiste",
    },
  }),
  ...fiche({
    cle: "tr",
    abrev: "Tr",
    nom: "trityle (triphénylméthyle)",
    formule: "R–O–CPh₃",
    structure: "tr",
    fonction: "alcool",
    famille: "ether-alkyle",
    page: 1,
    selectivite: "alcool **primaire ≫ secondaire**",
    protection: ["TrCl, pyridine, DMAP, DMF", "Tr-pyr⁺ BF₄⁻, CH₃CN, pyridine"],
    deprotection: ["H₃O⁺ faible", "SiO₂, PhH", "H₂, Pd/C, EtOH", "Na, NH₃"],
    stabilite: ["hydrures (H⁻)", "bases (B⁻)"],
    pourquoi: {
      selectivite: "Trois phényles : trop encombré pour un alcool secondaire",
      deprotection: "Le cation trityle est si stabilisé qu'un acide faible — même la silice — suffit",
    },
  }),

  // b) Acétals
  ...fiche({
    cle: "mom",
    abrev: "MOM",
    nom: "méthoxyméthyle",
    formule: "R–O–CH₂OCH₃",
    structure: "mom",
    fonction: "alcool",
    famille: "acetal",
    page: 2,
    protection: ["ClCH₂OCH₃ (MOMCl — ⚠ toxique !), NaH, THF"],
    deprotection: ["HCl, MeOH", "BF₃·OEt₂, RSH", "Ph₃C⁺BF₄⁻, H₂O"],
    pourquoi: { deprotection: "C'est un acétal : il tombe en acide" },
  }),
  ...fiche({
    cle: "bom",
    abrev: "BOM",
    nom: "benzyloxyméthyle",
    formule: "R–O–CH₂OCH₂Ph",
    structure: "bom",
    fonction: "alcool",
    famille: "acetal",
    page: 2,
    protection: ["BnOCH₂Cl, i-Pr₂NEt"],
    deprotection: ["H₂, Pd/C", "Na, NH₃, EtOH"],
    stabilite: ["bases (B⁻)", "hydrures (H⁻)", "oxydants [O]"],
    pourquoi: {
      deprotection:
        "Le benzyle part comme celui d'un Bn ; l'hémiacétal R–O–CH₂OH restant perd seul le formaldéhyde",
    },
  }),
  ...fiche({
    cle: "sem",
    abrev: "SEM",
    nom: "2-(triméthylsilyl)éthoxyméthyle",
    formule: "R–O–CH₂OCH₂CH₂Si(CH₃)₃",
    structure: "sem",
    fonction: "alcool",
    famille: "acetal",
    page: 2,
    protection: ["SEMCl, i-Pr₂NEt, CH₂Cl₂"],
    deprotection: ["**F⁻** : Bu₄N⁺F⁻, LiBF₄, CsF"],
    stabilite: ["bases faibles", "oxydants [O]", "hydrures (H⁻)", "H₃O⁺ faible"],
    pourquoi: {
      deprotection:
        "F⁻ attaque le silicium ; la chaîne se fragmente (éthylène, Me₃SiF, CH₂=O) et libère l'alcool",
    },
  }),
  ...fiche({
    cle: "thp",
    abrev: "THP",
    nom: "tétrahydropyranyle",
    formule: "R–O–THP (acétal du dihydropyrane)",
    structure: "thp",
    fonction: "alcool",
    famille: "acetal",
    page: 2,
    protection: ["DHP, APTS ou PPTS, CH₂Cl₂"],
    deprotection: ["H₃O⁺ (PPTS, AcOH…), MeOH ou EtOH"],
    stabilite: ["hydrures (H⁻)", "bases (B⁻)", "[O] douce", "RLi", "R₂CuLi", "H₂"],
    schemaPose: "thp-schema",
    pourquoi: {
      protection: "L'alcool s'additionne sur l'éther d'énol du DHP activé par l'acide",
    },
  }),
  note(
    "thp:particularite",
    "Le défaut du **THP** ?\n\n" + img("thp"),
    "Il crée un **nouveau centre stéréogène** (*) : sur un alcool déjà chiral, on obtient un **mélange de diastéréoisomères**.",
    ["alcool", "acetal", "thp", "piege"],
    source(2, "Spectres RMN dédoublés, purifications plus pénibles"),
  ),

  // c) Éthers silylés
  note(
    "silyles:acide",
    "Éthers silylés : classe-les par stabilité en milieu **acide**\n\n" + img("silyles-rangee"),
    "**TMS** (1) < **TES** (64) < **TBS** (2 × 10⁴) < **TIPS** (7 × 10⁵) < **TBDPS** (5 × 10⁶)",
    ["alcool", "silyle", "stabilite", "comparaison"],
    source(2, "Plus le silicium est encombré, plus il résiste"),
  ),
  note(
    "silyles:base",
    "Éthers silylés : classe-les par stabilité en milieu **basique**\n\n" + img("silyles-rangee"),
    "**TMS** (1) < **TES** (10–100) < **TBS** ≈ **TBDPS** (2 × 10⁴) < **TIPS** (10⁵)",
    ["alcool", "silyle", "stabilite", "comparaison"],
    source(2, "Le TBDPS, champion en acide, ne vaut qu'un TBS en base ; c'est le TIPS qui gagne"),
  ),
  note(
    "silyles:demi-vies",
    "n-C₆H₁₃–O–SiR₃ : lequel survit **24 h** dans 5 % NaOH–MeOH mais tombe en **≤ 1 min** dans 1 % HCl–MeOH ?",
    "**TBS**\n\n(TIPS et TBDPS survivent aussi à la base, mais tiennent 55 et 225 min en acide)",
    ["alcool", "silyle", "stabilite", "comparaison"],
    source(2, "Davies et al., J. Chem. Soc. Perkin Trans. 1 1992, 3043"),
  ),
  note(
    "silyles:stabilite",
    "Éthers silylés en général : ils **résistent** à… et **tombent** avec… ?",
    "**Stables :** Wittig · H⁻ · R₂CuLi · [O]\n\n**Instables :** F⁻ · bases aqueuses fortes · H₃O⁺ · Me₃SiI · Ph₃C⁺BF₄⁻",
    ["alcool", "silyle", "stabilite"],
    source(3),
  ),
  note(
    "silyles:fluorure",
    "Pourquoi **F⁻** retire-t-il tous les silyles ?",
    "La liaison **Si–F** est nettement plus forte que **Si–O** : le fluorure attaque le silicium et libère l'alcoolate.",
    ["alcool", "silyle", "deprotection", "mecanisme"],
    source(3, "Bu₄N⁺F⁻ (TBAF), HF, HF·pyridine, CsF"),
  ),
  ...fiche({
    cle: "tms",
    abrev: "TMS",
    nom: "triméthylsilyle",
    formule: "R–O–Si(CH₃)₃",
    structure: "tms",
    fonction: "alcool",
    famille: "silyle",
    page: 3,
    protection: ["TMSCl, Et₃N (ou pyridine), CH₂Cl₂"],
    deprotection: ["H₃O⁺ doux", "K₂CO₃, MeOH", "F⁻ (Bu₄N⁺F⁻ ou HF)"],
    stabilite: ["sur OH **tertiaire ≫ secondaire ≫ primaire** — le plus fragile des silyles"],
    pourquoi: { stabilite: "Seul l'encombrement de l'alcool protège un silicium aussi dégagé" },
  }),
  ...fiche({
    cle: "tbs",
    abrev: "TBS (TBDMS)",
    nom: "tert-butyldiméthylsilyle",
    formule: "R–O–SiMe₂t-Bu",
    structure: "tbs",
    fonction: "alcool",
    famille: "silyle",
    page: 3,
    selectivite: "alcool **primaire ≫ secondaire ⋙ tertiaire**",
    protection: [
      "TBSCl, **imidazole, DMF**",
      "TBSCl, Et₃N, DMAP, DMF",
      "TBSOTf, 2,6-lutidine, CH₂Cl₂",
    ],
    deprotection: [
      "**H₃O⁺** : AcOH ; TFA, CH₂Cl₂ ; APTS, THF, H₂O ; PPTS, EtOH",
      "**F⁻** : Bu₄N⁺F⁻, THF ; HF aq. ; BF₃·OEt₂, CHCl₃ ; LiBF₄ ; HF·pyridine, THF",
    ],
    stabilite: ["10⁴ fois plus stable à l'hydrolyse que TMS", "bases douces", "H⁻", "[O]", "H₂"],
    pourquoi: {
      protection: "Le triflate, bien plus réactif que le chlorure, sert pour les alcools encombrés",
    },
  }),
  ...fiche({
    cle: "tips",
    abrev: "TIPS",
    nom: "triisopropylsilyle",
    formule: "R–O–Si(i-Pr)₃",
    structure: "tips",
    fonction: "alcool",
    famille: "silyle",
    page: 3,
    protection: ["TIPSCl, imidazole, DMF", "TIPSOTf, 2,6-lutidine, CH₂Cl₂"],
    deprotection: [
      "**H₃O⁺** : HCl 0,01 N, EtOH ; AcOH 80 %",
      "**F⁻** : Bu₄N⁺F⁻, THF ; HF aq., CH₃CN",
    ],
    stabilite: ["le plus stable des silyles en **base** (10⁵ × TMS)", "très stable en acide (7 × 10⁵ × TMS)"],
  }),
  ...fiche({
    cle: "tbdps",
    abrev: "TBDPS",
    nom: "tert-butyldiphénylsilyle",
    formule: "R–O–SiPh₂t-Bu",
    structure: "tbdps",
    fonction: "alcool",
    famille: "silyle",
    page: 3,
    selectivite: "**primaire ≫ secondaire ≫ tertiaire**, et **équatorial > axial**",
    protection: ["TBDPSCl, imidazole, DMF", "TBDPSCl, Et₃N, DMAP, CH₂Cl₂"],
    deprotection: [
      "**H₃O⁺** : HCl 3 %, MeOH",
      "**F⁻** : Bu₄N⁺F⁻, THF ; HF aq., CH₃CN ; HF·pyridine, THF",
      "**base** : NaOH 5 N, EtOH ou KOH 10 %, MeOH",
    ],
    stabilite: ["H⁻", "H₃O⁺ modéré", "[O]", "bases modérées", "H₂"],
    pourquoi: { stabilite: "Le plus stable des silyles en acide (5 × 10⁶ × TMS)" },
  }),

  // d) Esters
  ...fiche({
    cle: "formate",
    abrev: "formate",
    nom: "ester formique",
    formule: "R–O–CHO",
    structure: "formate",
    fonction: "alcool",
    famille: "ester",
    page: 3,
    protection: ["HCO₂H", "CH₃CO₂CHO (anhydride acétoformique), pyridine"],
    deprotection: ["KHCO₃, H₂O, MeOH", "NH₄OH dilué"],
    pourquoi: { deprotection: "Hydrolysé 100 fois plus vite qu'un acétate ou un benzoate" },
  }),
  ...fiche({
    cle: "ac",
    abrev: "Ac",
    nom: "acétate",
    formule: "R–O–C(=O)CH₃",
    structure: "ac",
    fonction: "alcool",
    famille: "ester",
    page: 4,
    protection: ["Ac₂O, pyridine", "AcCl, Ac₂O, pyridine, DMAP"],
    deprotection: ["K₂CO₃ (ou MeONa), MeOH, H₂O", "lipases, tampon pH 7"],
    pourquoi: {
      protection: "DMAP, bien plus nucléophile que la pyridine, forme un acylpyridinium très réactif",
      deprotection: "Transestérification : l'acétyle part sur le méthanol (AcOMe)",
    },
  }),
  ...fiche({
    cle: "piv",
    abrev: "Piv",
    nom: "pivaloate",
    formule: "R–O–C(=O)t-Bu",
    structure: "piv",
    fonction: "alcool",
    famille: "ester",
    page: 4,
    selectivite: "**primaire > secondaire** ; ne se pose **pas** sur un tertiaire",
    protection: ["PivCl, pyridine"],
    deprotection: ["Bu₄N⁺OH⁻", "MeNH₂, H₂O", "NaOH, EtOH, H₂O", "MeLi, Et₂O"],
    stabilite: ["NH₃ (là où Ac et Bz tombent)"],
    pourquoi: { selectivite: "Le tert-butyle encombre le carbonyle" },
  }),
  ...fiche({
    cle: "bz",
    abrev: "Bz",
    nom: "benzoate",
    formule: "R–O–C(=O)Ph",
    structure: "bz",
    fonction: "alcool",
    famille: "ester",
    page: 4,
    selectivite: "**primaire > secondaire**, **équatorial > axial**",
    protection: ["BzCl (ou Bz₂O), pyridine", "BzCl, Bu₄N⁺Cl⁻, NaOH 40 % (transfert de phase)"],
    deprotection: ["NaOH, MeOH", "NH₃, MeOH, H₂O"],
    stabilite: ["oxydants [O]", "H₃O⁺"],
  }),
  note(
    "pnbz:variante",
    "Variante du Bz : pourquoi un **p-nitrobenzoate** ?\n\n" + img("pnbz"),
    "**Plus cristallin** (purification, rayons X) et **plus facile à cliver** que le benzoate.",
    ["alcool", "ester", "bz"],
    source(4, "Le nitro, attracteur, rend le carbonyle plus électrophile"),
  ),
];

/* ═════════════════════════════ 2 · Diols ═════════════════════════════ */

const DIOLS: NoteCatalogue[] = [
  note(
    "diol:familles",
    "Protéger un **diol** : les trois familles ?",
    liste([
      "**acétals / cétals cycliques** (méthylène, éthylidène, acétonide, benzylidène)",
      "**carbonates** cycliques",
      "**orthoesters** cycliques",
    ]),
    ["diol", "familles"],
    source(5),
  ),
  note(
    "diol:12",
    "Un **1,2-diol** + un carbonyle, H⁺ : quel cycle ?",
    img("diol-12-dioxolane") + "\n\n**1,3-dioxolane** — cycle à 5",
    ["diol", "acetal-cyclique", "structure"],
    source(5, "⚠ Le fascicule (p. 5) inverse les noms sous ses deux dessins : le cycle à 5 est le dioxolane"),
  ),
  note(
    "diol:13",
    "Un **1,3-diol** + un carbonyle, H⁺ : quel cycle ?",
    img("diol-13-dioxane") + "\n\n**1,3-dioxane** — cycle à 6",
    ["diol", "acetal-cyclique", "structure"],
    source(5, "⚠ Le fascicule (p. 5) inverse les noms sous ses deux dessins : le cycle à 6 est le dioxane"),
  ),
  note(
    "diol:acetal-cetal",
    "Acétal ou cétal cyclique : quelle différence ?",
    "**Acétal** (d'un aldéhyde) : R₁ = H, R₂ = alkyle\n\n**Cétal** (d'une cétone) : R₁, R₂ = alkyles",
    ["diol", "acetal-cyclique"],
    source(5),
  ),
  ...fiche({
    cle: "methylene",
    abrev: "méthylène",
    nom: "acétal méthylénique (R₁ = R₂ = H)",
    formule: "–O–CH₂–O–",
    structure: "methylene",
    fonction: "diol",
    famille: "acetal-cyclique",
    page: 5,
    protection: ["formaldéhyde, H₃O⁺", "CH₂Br₂, NaH, DMF"],
    deprotection: ["BCl₃, CH₂Cl₂", "HCl 2 N"],
    stabilite: ["le plus dur à cliver de **tous** les acétals"],
  }),
  ...fiche({
    cle: "ethylidene",
    abrev: "éthylidène",
    nom: "acétal de l'acétaldéhyde (R₁ = CH₃, R₂ = H)",
    formule: "–O–CH(CH₃)–O–",
    structure: "ethylidene",
    fonction: "diol",
    famille: "acetal-cyclique",
    page: 5,
    protection: ["CH₃CHO ou CH₃CH(OCH₃)₂, H⁺ anhydre"],
    deprotection: ["AcOH 80 %"],
  }),
  ...fiche({
    cle: "acetonide",
    abrev: "acétonide",
    nom: "isopropylidène (R₁ = R₂ = CH₃)",
    formule: "–O–C(CH₃)₂–O–",
    structure: "acetonide",
    fonction: "diol",
    famille: "acetal-cyclique",
    page: 5,
    selectivite: "**cycle à 5** (1,3-dioxolane, sur un 1,2-diol) **> cycle à 6**",
    protection: [
      "CH₃C(OCH₃)=CH₂ (2-méthoxypropène), H⁺ anhydre, CH₂Cl₂",
      "Me₂C(OMe)₂ (2,2-diméthoxypropane), APTS ou PPTS, DMF",
      "acétone, H⁺",
    ],
    deprotection: ["H₃O⁺", "HCl, MeOH", "BCl₃"],
    pourquoi: {
      selectivite:
        "En 1,3-dioxane chaise, l'un des deux méthyles est forcément axial (gêne 1,3-diaxiale) ; le fascicule inverse ici les noms dioxane/dioxolane",
    },
  }),
  note(
    "acetonide:reactifs",
    "Les **trois réactifs** qui posent un acétonide (avec H⁺) ?",
    img("acetonide-reactifs") + "\n\nacétone · 2,2-diméthoxypropane · 2-méthoxypropène",
    ["diol", "acetal-cyclique", "acetonide", "protection"],
    source(5, "Les deux derniers ne libèrent pas d'eau : l'équilibre est déplacé sans desséchant"),
  ),
  note(
    "acetonide:williams",
    "Acétone, TsOH sur ce triol : quel acétonide l'emporte ?\n\n" + img("triol-williams"),
    img("acetonide-selectivite") +
      "\n\nLe **1,2-acétonide** (1,3-dioxolane, cycle à 5), **5 : 1** devant le 1,3.",
    ["diol", "acetal-cyclique", "acetonide", "selectivite"],
    source(6, "Williams & Sit, J. Am. Chem. Soc. 1984, 106, 2949"),
  ),
  note(
    "acetonide:ribose",
    "**D-ribose** et acétonide : contrôle **thermodynamique** ou **cinétique** ?",
    liste([
      "**thermodynamique** — acétone, MeOH, 2-méthoxypropène, HCl (70 %) : 2,3-O-isopropylidène **furanose**",
      "**cinétique** — 2-méthoxypropène, p-TsOH, DMF (50 %) : 3,4-O-isopropylidène **pyranose**",
    ]),
    ["diol", "acetal-cyclique", "acetonide", "selectivite"],
    source(
      6,
      "En solution le ribose est à 80 % pyranose : la voie cinétique piège cette forme ; à l'équilibre, c'est l'acétonide du furanose (cis-2,3, cycle à 5) qui l'emporte",
    ),
  ),
  ...fiche({
    cle: "benzylidene",
    abrev: "benzylidène",
    nom: "acétal du benzaldéhyde (R₁ = Ph, R₂ = H)",
    formule: "–O–CHPh–O–",
    structure: "benzylidene",
    fonction: "diol",
    famille: "acetal-cyclique",
    page: 6,
    selectivite: "**cycle à 6** (1,3-dioxane, sur un 1,3-diol) **> cycle à 5**",
    protection: ["PhCHO, H⁺ anhydre, DMSO", "PhCHO, ZnCl₂"],
    deprotection: ["H₂, Pd/C, AcOH", "H₃O⁺", "Na, NH₃"],
    pourquoi: {
      selectivite:
        "Dans le 1,3-dioxane chaise, le phényle se range en équatorial, sans gêne ; le fascicule inverse ici les noms dioxane/dioxolane",
    },
  }),
  note(
    "benzylidene:reduction-primaire",
    "Ouvrir un benzylidène pour mettre le **Bn sur l'O primaire** (OH secondaire libre) ?\n\n" +
      img("benzylidene-13"),
    liste([
      "**Et₃SiH, TFA** (95 % si R = Ac, 80 % si R = Bn)",
      "**NaBH₃CN, HCl**, THF (82 %)",
      "BH₃·NMe₃, AlCl₃ (72 %)",
    ]) + "\n\n" + img("benzylidene-reduction"),
    ["diol", "acetal-cyclique", "benzylidene", "reduction"],
    source(7, "Sur un 4,6-O-benzylidène glucoside : régio-isomère A, 6-OBn et 4-OH"),
  ),
  note(
    "benzylidene:reduction-secondaire",
    "Ouvrir un benzylidène pour mettre le **Bn sur l'O secondaire** (OH primaire libre) ?\n\n" +
      img("benzylidene-13"),
    liste(["**Bu₂BOTf, BH₃·THF** (87 %)"]) + "\n\n" + img("benzylidene-reduction"),
    ["diol", "acetal-cyclique", "benzylidene", "reduction"],
    source(7, "Sur un 4,6-O-benzylidène glucoside : régio-isomère B, 4-OBn et 6-OH"),
  ),

  // b) Carbonates
  ...fiche({
    cle: "carbonate",
    abrev: "carbonate cyclique",
    nom: "1,3-dioxolan-2-one",
    formule: "–O–C(=O)–O–",
    structure: "carbonate",
    fonction: "diol",
    famille: "carbonate",
    page: 7,
    protection: [
      "Cl₂CO (phosgène — à proscrire) → **diphosgène** CCl₃OC(O)Cl ou **triphosgène** (CCl₃O)₂CO, pyridine",
      "Im₂CO (CDI), PhH, reflux",
    ],
    deprotection: ["OH⁻"],
    stabilite: ["H₃O⁺"],
    schemaPose: "carbonate-schema",
    pourquoi: { stabilite: "Ester : il craint la base et pas l'acide — l'inverse d'un acétal" },
  }),

  // c) Orthoesters
  ...fiche({
    cle: "orthoester",
    abrev: "méthoxyéthylidène",
    nom: "orthoester cyclique (R = R′ = CH₃)",
    formule: "–O–C(CH₃)(OCH₃)–O–",
    structure: "orthoester",
    fonction: "diol",
    famille: "orthoester",
    page: 7,
    protection: ["MeC(OMe)₃, H⁺ anhydre"],
    deprotection: ["AcOH — plus sensible à H₃O⁺ qu'un acétonide"],
    stabilite: ["bases (B⁻)", "hydrures (H⁻)", "RLi", "R₂CuLi"],
    instable: ["H⁺, plus encore qu'un acétal ou un cétal"],
    schemaPose: "orthoester-schema",
    pourquoi: { stabilite: "« Méthoxyéthylène » dans le fascicule" },
  }),
  note(
    "orthoester:triol",
    "Protéger **trois OH d'un coup** (myo-inositol) ?",
    "**Orthoformate** : HC(OEt)₃, pTSA cat., DMF, 140 °C (72 %).\n\nEnsuite, **DIBAL-H** ouvre l'orthoester en acétal méthylène et libère un seul OH.",
    ["diol", "orthoester", "protection"],
    source(8),
  ),
];

/* ═════════════════════════════ 3 · Cétones ═════════════════════════════ */

const ACETALS_CETONE: [string, string, string][] = [
  ["dimethylacetal", "acétal diméthylique", "ouvert, O,O"],
  ["dioxane", "1,3-dioxane", "cycle à 6, O,O"],
  ["dioxolane", "1,3-dioxolane", "cycle à 5, O,O"],
  ["dimethylthioacetal", "S,S′-diméthylthioacétal", "ouvert, S,S"],
  ["dithiane", "1,3-dithiane", "cycle à 6, S,S"],
  ["dithiolane", "1,3-dithiolane", "cycle à 5, S,S"],
  ["oxathiolane", "1,3-oxathiolane", "cycle à 5, O,S"],
];

const CETONES: NoteCatalogue[] = [
  note(
    "cetone:familles",
    "Protéger une **cétone** : les deux familles ?",
    "**cétals cycliques** (O,O) et **dithiocétals cycliques** (S,S)",
    ["cetone", "familles"],
    source(8),
  ),
  ...ACETALS_CETONE.map(([cle, nom, detail]) => ({
    ...note(
      `cetone:${cle}`,
      `**${nom}**\n\n${detail}`,
      img(cle),
      ["cetone", "structure", cle],
      source(8),
    ),
    type: "inversee" as const,
  })),
  note(
    "cetal:protection",
    "**Poser** un cétal cyclique sur une cétone ?",
    liste(["diol, APTS, PhMe, reflux", "bis(TMS)diol, TMSOTf, CH₂Cl₂, −78 °C"]) +
      "\n\n" +
      img("cetone-dioxolane"),
    ["cetone", "cetal", "protection"],
    source(8, "Au reflux du toluène, l'eau formée est chassée (Dean-Stark) ; la variante silylée ne forme pas d'eau du tout"),
  ),
  note(
    "cetal:deprotection",
    "**Retirer** un cétal cyclique ?\n\n" + img("dioxolane"),
    "**H₃O⁺**",
    ["cetone", "cetal", "deprotection"],
    source(8),
  ),
  note(
    "dithiocetal:protection",
    "**Poser** un dithiocétal cyclique ?",
    liste(["dithiol, **BF₃·OEt₂**, CH₂Cl₂"]) + "\n\n" + img("cetone-dithiane"),
    ["cetone", "dithiocetal", "protection"],
    source(8),
  ),
  note(
    "dithiocetal:deprotection",
    "**Retirer** un dithiocétal cyclique ?\n\n" + img("dithiane"),
    liste([
      "**Hg(ClO₄)₂**, MeOH, CHCl₃ — ne clive pas les acétonides",
      "AgNO₃, EtOH, H₂O",
      "MeI, H₂O, MeCN ou MeOH",
    ]),
    ["cetone", "dithiocetal", "deprotection"],
    source(
      8,
      "Le soufre, mou, ne se protone pas assez : on l'active par un métal thiophile (Hg²⁺, Ag⁺) ou en le méthylant (MeI)",
    ),
  ),
  note(
    "cetone:hydrolyse",
    "Classe-les par vitesse d'**hydrolyse acide**\n\n" + img("hydrolyse-acetals"),
    img("hydrolyse-acetals-vitesses") +
      "\n\nacétal ouvert (160) > **1,3-dioxolane** (5) ⋙ **dithioacétal** (3,5 × 10⁻⁴)",
    ["cetone", "stabilite", "comparaison"],
    source(
      9,
      "Un acétal cyclique se clive plus lentement que son analogue ouvert ; un dithioacétal ne se clive pas par un acide de Brønsted",
    ),
  ),
];

/* ═════════════════════════════ 4 · Amines ═════════════════════════════ */

const AMINES: NoteCatalogue[] = [
  note(
    "amine:familles",
    "Protéger une **amine** R–NH₂ : les quatre familles ?",
    liste([
      "**alkylamines** R–NH–R′ (Bn)",
      "**amides** R–NH–COR′ (formamide, acétamide, trifluoroacétamide)",
      "**carbamates** R–NH–CO₂R′ (Boc, Alloc, Cbz, Troc)",
      "**sulfonamides** R–NH–SO₂R′ (Ts)",
    ]),
    ["amine", "familles"],
    source(9),
  ),
  ...fiche({
    cle: "nbn",
    abrev: "Bn (amine)",
    nom: "benzylamine",
    formule: "R–NH–CH₂Ph",
    structure: "nbn",
    fonction: "amine",
    famille: "alkylamine",
    page: 9,
    selectivite:
      "**dibenzylation** R–NBn₂ par BnX + base ; **monobenzylation** R–NHBn par amination réductrice (PhCHO puis réduction)",
    protection: [
      "BnCl, K₂CO₃, H₂O → R–NBn₂",
      "BnBr, Et₃N, MeCN → R–NBn₂",
      "PhCHO, CH₂Cl₂, puis NaBH₄ ou H₂–Pd/C → R–NHBn",
    ],
    deprotection: ["Na, NH₃", "Pd/C, HCOOH, MeOH"],
    pourquoi: {
      deprotection: "L'acide formique sert de source d'hydrogène : hydrogénolyse par transfert",
    },
  }),
  ...fiche({
    cle: "formamide",
    abrev: "formamide",
    nom: "N-formyle",
    formule: "R–NH–CHO",
    structure: "formamide",
    fonction: "amine",
    famille: "amide",
    page: 9,
    protection: ["HCO₂H, Ac₂O", "HCO₂H, DCC, pyridine"],
    deprotection: ["HCl, H₂O, dioxane", "H₂, Pd/C, HCl, THF", "NaOH, H₂O, reflux"],
  }),
  ...fiche({
    cle: "acetamide",
    abrev: "Ac (amine)",
    nom: "acétamide",
    formule: "R–NH–COCH₃",
    structure: "acetamide",
    fonction: "amine",
    famille: "amide",
    page: 9,
    protection: ["Ac₂O ou AcCl, avec ou sans base"],
    deprotection: ["HCl aq., reflux", "NH₂NH₂, H₂O"],
    pourquoi: { deprotection: "Un amide est robuste : il faut chauffer en acide, ou l'hydrazine" },
  }),
  ...fiche({
    cle: "tfa",
    abrev: "TFA (amine)",
    nom: "trifluoroacétamide",
    formule: "R–NH–COCF₃",
    structure: "tfa",
    fonction: "amine",
    famille: "amide",
    page: 10,
    protection: ["(CF₃CO)₂O, pyridine, CH₂Cl₂"],
    deprotection: [
      "K₂CO₃ ou Na₂CO₃, MeOH, H₂O — **ne clive pas les esters méthyliques**",
      "NaBH₄, EtOH",
    ],
    pourquoi: {
      deprotection:
        "Les trois fluors rendent le carbonyle très électrophile : une base douce suffit, là où un acétamide exige un reflux acide. Ne pas confondre avec TFA, l'acide trifluoroacétique",
    },
  }),
  ...fiche({
    cle: "boc",
    abrev: "Boc",
    nom: "tert-butyloxycarbonyle",
    formule: "R–NH–CO₂t-Bu",
    structure: "boc",
    fonction: "amine",
    famille: "carbamate",
    page: 10,
    protection: ["Boc₂O, NaOH, H₂O"],
    deprotection: ["HCl 3 M, EtOAc", "**TFA** pur ou dans CH₂Cl₂", "Δ ≥ 150 °C"],
    stabilite: ["nucléophiles", "bases (B⁻)"],
    pourquoi: {
      deprotection:
        "En acide, le cation tert-butyle part (→ isobutène) ; l'acide carbamique restant perd CO₂ et rend l'amine",
    },
  }),
  ...fiche({
    cle: "alloc",
    abrev: "Alloc",
    nom: "allyloxycarbonyle",
    formule: "R–NH–CO₂CH₂CH=CH₂",
    structure: "alloc",
    fonction: "amine",
    famille: "carbamate",
    page: 10,
    protection: ["AllocCl (AllOCOCl), pyridine"],
    deprotection: ["**Pd(PPh₃)₄**, Bu₃SnH, AcOH"],
    pourquoi: {
      deprotection:
        "Le Pd(0) arrache l'allyle (complexe π-allyle) que l'hydrure d'étain piège ; le carbamate libre perd CO₂",
    },
  }),
  ...fiche({
    cle: "cbz",
    abrev: "Cbz (Z)",
    nom: "benzyloxycarbonyle",
    formule: "R–NH–CO₂CH₂Ph",
    structure: "cbz",
    fonction: "amine",
    famille: "carbamate",
    page: 10,
    protection: ["BnOCOCl (CbzCl), Na₂CO₃, H₂O", "(BnOCO)₂O, dioxane, H₂O, NaOH ou Et₃N"],
    deprotection: [
      "**H₂** (ou un donneur d'H₂), **Pd/C**, EtOH",
      "BBr₃, CH₂Cl₂",
      "H₃O⁺ fort",
      "Na, NH₃",
    ],
    pourquoi: {
      deprotection: "Hydrogénolyse de la liaison O–benzyle : toluène, puis CO₂ et l'amine",
    },
  }),
  ...fiche({
    cle: "troc",
    abrev: "Troc",
    nom: "2,2,2-trichloroéthoxycarbonyle",
    formule: "R–NH–CO₂CH₂CCl₃",
    structure: "troc",
    fonction: "amine",
    famille: "carbamate",
    page: 10,
    protection: ["Cl₃CCH₂OCOCl (TrocCl), pyridine ou NaOH"],
    deprotection: ["**Zn**, THF, H₂O — ne touche ni Boc, ni Bn, ni TFA"],
    pourquoi: {
      protection: "Le fascicule écrit « Cl₃CH₂OCOCl » : il manque un C",
      deprotection:
        "Le zinc réduit une liaison C–Cl ; β-élimination : 1,1-dichloroéthylène, CO₂ et l'amine",
    },
  }),
  ...fiche({
    cle: "ts",
    abrev: "Ts",
    nom: "tosyle (p-toluènesulfonamide)",
    formule: "R–NH–SO₂C₆H₄CH₃",
    structure: "ts",
    fonction: "amine",
    famille: "sulfonamide",
    page: 10,
    protection: ["TsCl, pyridine ou Et₃N, CH₂Cl₂"],
    deprotection: ["Li ou Na, NH₃", "HBr, AcOH, 70 °C"],
    pourquoi: { deprotection: "Un sulfonamide est l'un des groupes les plus robustes : conditions dures" },
  }),
];

/* ═════════════════════════ 5 · Réflexes ═════════════════════════ */

function reflexe(
  cle: string,
  recto: string,
  verso: string,
  pourquoi?: string,
  image?: string,
): NoteCatalogue {
  const question = image ? `${recto}\n\n${img(image)}` : recto;
  return note(`reflexe:${cle}`, question, verso, ["reflexe", "orthogonalite"], pourquoi);
}

const REFLEXES: NoteCatalogue[] = [
  reflexe(
    "h2-pdc",
    "Qu'est-ce qui tombe sous **H₂, Pd/C** ?",
    "**Alcools :** Bn · PMB · Tr · BOM\n\n**Diols :** benzylidène\n\n**Amines :** Cbz · Bn (transfert, HCOOH) · formamide (avec HCl)",
    "Tout ce qui porte une liaison O–benzyle ou N–benzyle",
  ),
  reflexe(
    "fluorure",
    "Qu'est-ce qui tombe sous **F⁻** (TBAF, HF, CsF) ?",
    "**TMS · TES · TBS · TIPS · TBDPS** et le **SEM**",
    "Tout ce qui porte un silicium",
  ),
  reflexe(
    "birch",
    "Qu'est-ce qui tombe sous **Na, NH₃** ?",
    "**Alcools :** Bn · Tr · BOM\n\n**Diols :** benzylidène\n\n**Amines :** Bn · Cbz · **Ts**",
    "La réduction à un électron coupe les liaisons benzyliques et même les sulfonamides",
  ),
  reflexe(
    "tfa-acide",
    "Qu'est-ce qui tombe sous **TFA** (acide trifluoroacétique) ?",
    "**t-Bu** (éther) · **PMB** · **Boc** — et un TBS (TFA, CH₂Cl₂) ; a fortiori un Tr, qui part déjà en acide faible",
    "Ceux qui libèrent un cation stabilisé : tert-butyle ou p-méthoxybenzyle",
  ),
  reflexe(
    "base-douce",
    "Qu'est-ce qui tombe sous **K₂CO₃, MeOH** ?",
    "**Ac** (ester) · **TMS** · **trifluoroacétamide**",
    "Et a fortiori un formate, cent fois plus fragile qu'un acétate",
  ),
  reflexe(
    "me3sii",
    "Qu'est-ce qui tombe sous **Me₃SiI** ?",
    "éthers **t-Bu** et **Bn**",
    "Et les éthers silylés n'y survivent pas non plus",
  ),
  reflexe(
    "bcl3",
    "Qu'est-ce qui tombe sous **BCl₃** ?",
    "**Bn** · **méthylène** · **acétonide**",
  ),
  reflexe(
    "pmb-bn",
    "Retirer un **PMB** en gardant un **Bn** ?",
    "**DDQ** (ou CAN), CH₂Cl₂, H₂O",
    "Seul le cycle enrichi par le méthoxy s'oxyde",
    "paire-pmb-bn",
  ),
  reflexe(
    "troc",
    "Retirer un **Troc** en gardant **Boc**, **Bn** et **TFA** ?",
    "**Zn**, THF, H₂O",
    undefined,
    "troc",
  ),
  reflexe(
    "alloc",
    "Retirer un **Alloc** sans acide ni base ?",
    "**Pd(PPh₃)₄**, Bu₃SnH, AcOH",
    undefined,
    "alloc",
  ),
  reflexe(
    "tfa-ester",
    "Retirer un **trifluoroacétamide** sans toucher un **ester méthylique** ?",
    "**K₂CO₃** (ou Na₂CO₃), MeOH, H₂O",
    undefined,
    "tfa",
  ),
  reflexe(
    "dithio-acetonide",
    "Cliver un **dithiocétal** en gardant un **acétonide** ?",
    "**Hg(ClO₄)₂**, MeOH, CHCl₃",
    undefined,
    "paire-dithiane-acetonide",
  ),
  reflexe(
    "formate",
    "Retirer un **formate** en gardant un **Ac** ou un **Bz** ?",
    "**KHCO₃**, MeOH, H₂O ou **NH₄OH** dilué — le formate s'hydrolyse **100 fois** plus vite",
    undefined,
    "paire-formate-ac",
  ),
  reflexe(
    "boc-cbz",
    "**Boc** et **Cbz** sur la même molécule : comment les retirer l'un sans l'autre ?",
    "**Boc** : acide (TFA, HCl) — le Cbz résiste\n\n**Cbz** : H₂, Pd/C — le Boc résiste",
    undefined,
    "paire-boc-cbz",
  ),
  reflexe(
    "tbs-tbdps",
    "Retirer un **TBS** en gardant un **TBDPS** ?",
    "**Acide doux** (AcOH, PPTS) : en acide, le TBDPS est ~250 fois plus stable",
    "L'inverse n'a pas de solution simple : en base, TBS et TBDPS se valent (2 × 10⁴ × TMS)",
    "paire-tbs-tbdps",
  ),
  reflexe(
    "tertiaire",
    "Quels groupes **ne se posent pas** (ou mal) sur un alcool **tertiaire** ?",
    "**Tr** (primaire ≫ secondaire) · **Piv** (jamais sur un tertiaire) · **TBS**-Cl (primaire ≫ secondaire ⋙ tertiaire)",
    "Pour un tertiaire, le triflate TBSOTf, 2,6-lutidine prend le relais",
  ),
  reflexe(
    "plus-dur",
    "L'acétal de diol **le plus dur à cliver** ?",
    "le **méthylène** (–O–CH₂–O–)",
  ),
  reflexe(
    "orthoester-acetonide",
    "En acide, lequel tombe en premier : **orthoester** ou **acétonide** ?",
    "l'**orthoester** — plus labile que tous les acétals et cétals",
  ),
  reflexe(
    "acetal-carbonate",
    "Acétonide et carbonate : qui craint l'acide, qui craint la base ?",
    "**acétonide** : l'acide (stable en base)\n\n**carbonate** : la base (stable en acide)",
  ),
  reflexe(
    "5-ou-6",
    "Acétonide ou benzylidène : quelle taille de cycle chacun préfère-t-il ?",
    "**acétonide** → cycle à **5** (1,2-diol)\n\n**benzylidène** → cycle à **6** (1,3-diol)",
    "Acétonide : un méthyle serait axial dans le cycle à 6. Benzylidène : le phényle y est équatorial",
  ),
  reflexe(
    "toxiques",
    "Deux réactifs du fascicule à manier avec précaution ?",
    "**MOMCl** (toxique) · **phosgène** (à proscrire : diphosgène, triphosgène ou CDI à la place)",
  ),
];

/* ═════════════════════════════ Catalogue ═════════════════════════════ */

const PAQUETS: PaquetCatalogue[] = [
  { cle: "alcools", nom: "1 · Alcools", notes: ALCOOLS },
  { cle: "diols", nom: "2 · Diols", notes: DIOLS },
  { cle: "cetones", nom: "3 · Cétones", notes: CETONES },
  { cle: "amines", nom: "4 · Amines", notes: AMINES },
  { cle: "reflexes", nom: "5 · Réflexes", notes: REFLEXES },
];

export const GROUPES_PROTECTEURS: Catalogue = {
  id: "groupes-protecteurs",
  titre: "Groupes protecteurs",
  source: "CH0905 · Synthèse totale de produits naturels · Pr J.-B. Behr",
  description:
    "Alcools, diols, cétones, amines, dans l'ordre du fascicule : structure, pose, retrait, stabilité et sélectivité de chaque groupe, puis les réflexes d'orthogonalité réactif par réactif.",
  espace: { nom: "Synthèse totale", couleur: "#7e92b8" },
  racine: "Groupes protecteurs",
  paquets: PAQUETS,
  images: STRUCTURES_GROUPES_PROTECTEURS,
};
