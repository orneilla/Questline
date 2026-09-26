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
 * Chaque affirmation a été recoupée avec l'ouvrage que le fascicule
 * recommande : T. W. Greene et P. G. M. Wuts, *Protective Groups in Organic
 * Synthesis*, 3ᵉ éd., Wiley, 1999. Les explications « pourquoi » et les
 * mécanismes viennent de P. J. Kocienski, *Protecting Groups*, Thieme, 1994 :
 * chacune cite sa page, et rien n'est écrit qui ne soit dans l'une des trois
 * sources. Deux coquilles du fascicule sont
 * signalées plutôt que recopiées : les noms dioxane/dioxolane inversés (p. 5)
 * et le chlorure de Troc (p. 10).
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
  /** Page de Greene & Wuts, 3ᵉ éd., où commence la section du groupe. */
  greene: number;
  protection: string[];
  deprotection: string[];
  stabilite?: string[];
  instable?: string[];
  selectivite?: string;
  /** Image affichée au verso de la carte de pose, à la place de la structure seule. */
  schemaPose?: string;
  schemaRetrait?: string;
  /** Mécanisme du retrait, redessiné d'après Kocienski : dessin, schéma, page, précision. */
  mecanisme?: { image: string; schema: string; page: number; precision?: string };
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

/** Bloc « Mécanisme » ajouté au verso : une ligne de source, puis le dessin. */
function mecanisme(image: string, schema: string, page: number): string {
  return `\n\n**Mécanisme** · Kocienski, schéma ${schema}, p. ${page}\n\n${img(image)}`;
}

function source(page: number | null, pourquoi?: string, greene?: number): string {
  const refs = [
    page !== null ? `Fascicule CH0905, p. ${page}` : null,
    greene ? `Greene & Wuts, 3ᵉ éd., p. ${greene}` : null,
  ].filter(Boolean);
  const ref = `${refs.join(" · ")}.`;
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
      source(f.page, undefined, f.greene),
    ),
    note(
      `${f.cle}:nom`,
      `${img(f.structure)}\n\nQuel groupe protecteur ?`,
      `${titre} — *${f.nom}*\n\nprotège ${ARTICLE[f.fonction]} · ${FAMILLE[f.famille] ?? f.famille}`,
      [...tags, "structure"],
      source(f.page, undefined, f.greene),
    ),
  ];

  if (f.selectivite) {
    cartes.push(
      note(
        `${f.cle}:selectivite`,
        `Sélectivité de ${titre} ?`,
        f.selectivite,
        [...tags, "selectivite"],
        source(f.page, f.pourquoi?.selectivite, f.greene),
      ),
    );
  }

  cartes.push(
    note(
      `${f.cle}:protection`,
      `**Poser** ${titre}\n\n${img(f.structure)}`,
      `${liste(f.protection)}${f.schemaPose ? `\n\n${img(f.schemaPose)}` : ""}`,
      [...tags, "protection"],
      source(f.page, f.pourquoi?.protection, f.greene),
    ),
    note(
      `${f.cle}:deprotection`,
      `**Retirer** ${titre}\n\n${img(f.structure)}`,
      `${liste(f.deprotection)}${f.schemaRetrait ? `\n\n${img(f.schemaRetrait)}` : ""}` +
        (f.mecanisme ? mecanisme(f.mecanisme.image, f.mecanisme.schema, f.mecanisme.page) : ""),
      [...tags, "deprotection"],
      source(
        f.page,
        [f.pourquoi?.deprotection, f.mecanisme?.precision && `Mécanisme : ${f.mecanisme.precision}`]
          .filter(Boolean)
          .join(". "),
        f.greene,
      ),
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
        source(f.page, f.pourquoi?.stabilite, f.greene),
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
    greene: 65,
    mecanisme: {
      image: "meca-tbu",
      schema: "1.3",
      page: 4,
      precision: "dessiné sur un ester ; même rupture pour les éthers et carbamates tert-butyliques",
    },
    protection: [
      "H⁺, CH₂=C(CH₃)₂ (isobutène), solvant anhydre",
      "BF₃·OEt₂, CH₂=C(CH₃)₂",
    ],
    deprotection: ["HBr, AcOH", "CF₃CO₂H (TFA)", "Me₃SiI"],
    stabilite: ["H⁺ faible", "bases (B⁻)", "hydrures (H⁻)", "H₂"],
    pourquoi: {
      deprotection:
        "En acide fort, mécanisme E1 avec perte d'isobutène, grâce à la stabilité du carbocation tert-butyle (Kocienski, Protecting Groups, p. 59)",
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
    greene: 67,
    mecanisme: {
      image: "meca-rh",
      schema: "1.16",
      page: 11,
      precision: "isomérisation par Rh(I), puis hydrolyse acide",
    },
    protection: ["NaH, THF, BrCH₂CH=CH₂"],
    deprotection: [
      "**en une étape :** Pd/C, MeOH, H₂O, APTS cat. (ou HClO₄ cat.)",
      "**en deux étapes :** 1) isomérisation en éther d'énol R–O–CH=CHCH₃ — t-BuOK, DMSO, 100 °C ou (Ph₃P)₃RhCl, DABCO, EtOH, reflux ; 2) coupure de l'éther d'énol — O₃, ou HCl acétone–eau, ou KMnO₄, NaOH, H₂O",
    ],
    schemaRetrait: "allyl-deux-etapes",
    stabilite: ["acide modéré (HCl 1 N, reflux, 10 h)", "la plupart des réactifs de glycosylation"],
    instable: ["hydrogénation catalytique", "électrophiles forts (Br₂)"],
    pourquoi: {
      stabilite: "Stabilité : d'après Greene, le fascicule ne la donne pas",
      deprotection:
        "Robuste tel quel ; une fois la double liaison déplacée en conjugaison avec l'oxygène, l'éther d'énol se coupe facilement par hydrolyse acide ou oxydation (Kocienski, Protecting Groups, p. 62)",
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
    greene: 76,
    mecanisme: {
      image: "meca-birch",
      schema: "1.14",
      page: 10,
      precision: "coupure par Na, NH₃",
    },
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
        "Synthèse de Williamson ; l'iodure déplace le bromure et donne in situ BnI, bien meilleur agent alkylant (Kocienski, Protecting Groups, p. 50)",
      deprotection: "Hydrogénolyse de la liaison C–O benzylique (Kocienski, Protecting Groups, p. 8)",
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
    greene: 86,
    mecanisme: {
      image: "meca-ddq",
      schema: "1.13",
      page: 9,
    },
    protection: ["PMBBr, NaH, DMF"],
    deprotection: [
      "**DDQ ou CAN**, CH₂Cl₂, H₂O — ne touche pas un Bn (sauf conditions forcées, Greene)",
      "TFA",
      "H₂, Pd/C, EtOH (comme un Bn)",
    ],
    pourquoi: {
      deprotection:
        "Le PMB cède facilement un électron à la DDQ : il se forme un ion oxonium que l'eau capte (Kocienski, Protecting Groups, p. 9). Greene : il se coupe par oxydation bien plus facilement qu'un Bn",
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
    greene: 102,
    selectivite: "alcool **primaire ≫ secondaire**",
    protection: ["TrCl, pyridine, DMAP, DMF", "Tr-pyr⁺ BF₄⁻, CH₃CN, pyridine"],
    deprotection: ["H₃O⁺ faible", "SiO₂, PhH", "H₂, Pd/C, EtOH", "Na, NH₃"],
    stabilite: ["hydrures (H⁻)", "bases (B⁻)"],
    pourquoi: {
      selectivite: "Avec TrCl, pyridine, les alcools secondaires réagissent très lentement, voire pas du tout (Kocienski, Protecting Groups, p. 58)",
      deprotection: "Facile à retirer en acide grâce à la stabilité du carbocation triphénylméthyle (Kocienski, Protecting Groups, p. 55)",
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
    greene: 27,
    mecanisme: {
      image: "meca-acetal",
      schema: "1.6",
      page: 5,
      precision: "dessiné sur un acétonide ; même mécanisme pour tous les O,O-acétals, MOM compris",
    },
    protection: ["ClCH₂OCH₃ (MOMCl — ⚠ toxique, cancérogène), NaH, THF"],
    deprotection: ["HCl, MeOH", "BF₃·OEt₂, RSH", "Ph₃C⁺BF₄⁻, H₂O"],
    pourquoi: {
      protection: "Greene : le MOMCl est cancérogène, et son sous-produit ClCH₂OCHCl₂ l'est plus encore",
      deprotection: "C'est un acétal (mécanisme de la carte « Retirer ») ; sans substituant sur le carbone acétalique, il demande un acide minéral dilué, à chaud (Kocienski, Protecting Groups, p. 5)",
    },
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
    greene: 36,
    protection: ["BnOCH₂Cl, i-Pr₂NEt"],
    deprotection: ["H₂, Pd/C", "Na, NH₃, EtOH"],
    stabilite: ["bases (B⁻)", "hydrures (H⁻)", "oxydants [O]"],
    pourquoi: {
      deprotection:
        "L'hydrogénolyse d'un BOM libère du formaldéhyde, qui peut N-méthyler une amine présente (Kocienski, Protecting Groups, p. 78)",
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
    greene: 45,
    mecanisme: {
      image: "meca-sem",
      schema: "1.10",
      page: 7,
    },
    protection: ["SEMCl, i-Pr₂NEt, CH₂Cl₂"],
    deprotection: ["**F⁻** : Bu₄N⁺F⁻, LiBF₄, CsF"],
    stabilite: ["bases faibles", "oxydants [O]", "hydrures (H⁻)", "H₃O⁺ faible"],
    pourquoi: {
      stabilite:
        "Greene : il survit à AcOH, H₂O, THF à 45 °C, qui retirent THP et TBS ; le TFA, lui, le retire",
      deprotection:
        "Fragmentation induite par le fluorure : perte d'éthylène, de formaldéhyde et de FSiMe₃ (Kocienski, Protecting Groups, p. 7)",
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
    greene: 49,
    mecanisme: {
      image: "meca-acetal",
      schema: "1.6",
      page: 5,
      precision: "dessiné sur un acétonide ; même mécanisme pour tous les O,O-acétals, THP compris",
    },
    protection: ["DHP, APTS ou PPTS, CH₂Cl₂"],
    deprotection: ["H₃O⁺ (PPTS, AcOH…), MeOH ou EtOH"],
    stabilite: ["hydrures (H⁻)", "bases (B⁻)", "[O] douce", "RLi", "R₂CuLi", "H₂"],
    schemaPose: "thp-schema",
    pourquoi: {
      protection: "Protonation du carbone de l'éther d'énol : l'ion oxonium, très électrophile, est attaqué par l'alcool (Kocienski, Protecting Groups, p. 85)",
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
    source(2, "L'encombrement autour du silicium, et l'électronique, règlent la stabilité (Greene)", 114),
  ),
  note(
    "silyles:base",
    "Éthers silylés : classe-les par stabilité en milieu **basique**\n\n" + img("silyles-rangee"),
    "**TMS** (1) < **TES** (10–100) < **TBS** ≈ **TBDPS** (2 × 10⁴) < **TIPS** (10⁵)",
    ["alcool", "silyle", "stabilite", "comparaison"],
    source(
      2,
      "Le TBDPS, champion en acide, ne vaut qu'un TBS en base — Greene le dit même un peu moins stable : NaOH 5 N le retire et laisse le TBS. C'est le TIPS qui gagne",
      114,
    ),
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
    "La liaison **Si–F** est plus forte que **Si–O** de **30 kcal/mol** (142 contre 112) : le fluorure attaque le silicium, passe par un siliconate pentavalent et libère l'alcoolate." +
      mecanisme("meca-fluorure", "1.8", 6),
    ["alcool", "silyle", "deprotection", "mecanisme"],
    source(3, "Bu₄N⁺F⁻ (TBAF), HF, HF·pyridine, CsF — Kocienski, Protecting Groups, p. 6, 29", 114),
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
    greene: 116,
    protection: ["TMSCl, Et₃N (ou pyridine), CH₂Cl₂"],
    deprotection: ["H₃O⁺ doux", "K₂CO₃, MeOH", "F⁻ (Bu₄N⁺F⁻ ou HF)"],
    stabilite: ["sur OH **tertiaire ≫ secondaire ≫ primaire** — le plus fragile des silyles"],
    pourquoi: {
      stabilite:
        "La vitesse d'hydrolyse dépend des effets stériques et électroniques : un environnement encombré la ralentit (Kocienski, Protecting Groups, p. 29)",
    },
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
    greene: 127,
    mecanisme: {
      image: "meca-fluorure",
      schema: "1.8",
      page: 6,
      precision: "passage par un siliconate pentavalent",
    },
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
      protection: "Greene : le triflate est l'une des méthodes les plus puissantes, pour les alcools encombrés",
      deprotection: "Le fascicule range BF₃·OEt₂ et LiBF₄ avec les fluorures",
      stabilite: "Greene précise : 10⁴ fois plus stable que TMS à l'hydrolyse basique ; il reste assez sensible à l'acide",
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
    greene: 123,
    protection: ["TIPSCl, imidazole, DMF", "TIPSOTf, 2,6-lutidine, CH₂Cl₂"],
    deprotection: [
      "**H₃O⁺** : HCl 0,01 N, EtOH ; AcOH 80 %",
      "**F⁻** : Bu₄N⁺F⁻, THF ; HF aq., CH₃CN",
    ],
    selectivite: "alcool **primaire > secondaire**",
    stabilite: [
      "le plus stable des silyles en **base** (10⁵ × TMS)",
      "en acide, entre TBS et TBDPS (7 × 10⁵ × TMS)",
    ],
    pourquoi: {
      selectivite: "Sélectivité et stabilité : d'après Greene, le fascicule ne les détaille pas",
      stabilite: "Chiffres du fascicule, p. 2",
    },
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
    greene: 141,
    selectivite: "**primaire ≫ secondaire ≫ tertiaire**, et **équatorial > axial**",
    protection: ["TBDPSCl, imidazole, DMF", "TBDPSCl, Et₃N, DMAP, CH₂Cl₂"],
    deprotection: [
      "**H₃O⁺** : HCl 3 %, MeOH",
      "**F⁻** : Bu₄N⁺F⁻, THF ; HF aq., CH₃CN ; HF·pyridine, THF",
      "**base** : NaOH 5 N, EtOH ou KOH 10 %, MeOH",
    ],
    stabilite: ["H⁻", "H₃O⁺ modéré", "[O]", "bases modérées", "H₂"],
    pourquoi: {
      stabilite:
        "Le plus stable des silyles en acide (5 × 10⁶ × TMS). Greene : il survit à AcOH 80 %, qui retire TBS, Tr et THP, et à K₂CO₃/MeOH",
    },
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
    greene: 149,
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
    greene: 150,
    selectivite:
      "Ac₂O, pyridine : **primaire > secondaire**, les **tertiaires** ne s'acétylent généralement **pas** ; avec **DMAP**, même les tertiaires",
    protection: ["Ac₂O, pyridine", "AcCl, Ac₂O, pyridine, DMAP"],
    deprotection: ["K₂CO₃ (ou MeONa), MeOH, H₂O", "lipases, tampon pH 7"],
    pourquoi: {
      selectivite: "Sélectivité : d'après Greene",
      protection:
        "La DMAP accélère l'acylation d'un facteur 10⁴ par rapport à la pyridine (Greene ; Kocienski, Protecting Groups, p. 119)",
      deprotection: "Solvolyse basique douce ; en milieu acide, la transestérification marche aussi (Kocienski, Protecting Groups, p. 22)",
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
    greene: 170,
    selectivite: "**primaire > secondaire** ; ne se pose **pas** sur un tertiaire",
    protection: ["PivCl, pyridine"],
    deprotection: ["Bu₄N⁺OH⁻", "MeNH₂, H₂O", "NaOH, EtOH, H₂O", "MeLi, Et₂O"],
    stabilite: ["NH₃ (là où Ac et Bz tombent)"],
    pourquoi: {
      selectivite:
        "Le tert-butyle protège le carbonyle de l'attaque nucléophile : NH₃/MeOH l'hydrolyse si lentement qu'on retire un acétate sans lui (Kocienski, Protecting Groups, p. 22, 24)",
    },
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
    greene: 173,
    selectivite: "**primaire > secondaire**, **équatorial > axial**",
    protection: ["BzCl (ou Bz₂O), pyridine", "BzCl, Bu₄N⁺Cl⁻, NaOH 40 % (transfert de phase)"],
    deprotection: ["NaOH, MeOH", "NH₃, MeOH, H₂O"],
    stabilite: ["oxydants [O]", "H₃O⁺"],
  }),
  note(
    "pnbz:variante",
    "Variante du Bz : pourquoi un **p-nitrobenzoate** ?\n\n" + img("pnbz"),
    "**Plus cristallin** et **plus facile à cliver** que le benzoate.",
    ["alcool", "ester", "bz"],
    source(
      4,
      "Greene : p-nitrobenzoate > acétate > benzoate > pivaloate pour la vitesse de clivage ; voir la règle de la Rem 1",
      155,
    ),
  ),
];

/* Les trois remarques de la page 4 : figures seules dans le fascicule. */
ALCOOLS.push(
  note(
    "esters:hydrolyse",
    "Esters méthyliques : classe-les du plus **lent** au plus **rapide** à l'hydrolyse basique\n\nacétate · trifluoroacétate · pivalate · benzoate · trichloroacétate · p-méthoxybenzoate · chloroacétate",
    img("hydrolyse-esters") +
      "\n\n**pivalate < p-méthoxybenzoate < benzoate < acétate < chloroacétate < trichloroacétate < trifluoroacétate**",
    ["alcool", "ester", "stabilite", "comparaison"],
    source(
      4,
      "Rem 1 : la sensibilité à l'hydrolyse basique croît avec l'acidité de l'acide libéré. Greene : p-nitrobenzoate > acétate > benzoate > pivaloate",
      155,
    ),
  ),
  note(
    "esters:stannylene",
    "Acétyler **seulement l'OH primaire** d'un 1,2-diol ?",
    "Passer par l'**acétal stannylène** : Bu₂SnO, toluène, 100 °C, puis AcCl, CH₂Cl₂, 0 °C\n\n" +
      img("stannylene-schema"),
    ["alcool", "ester", "ac", "selectivite"],
    source(4, "Rem 2 du fascicule (« stalynenes » : lire stannylènes). Greene : 84 %", 151),
  ),
  note(
    "esters:lipase",
    "Désymétriser un **diacétate méso** ?\n\n" + img("diacetate-meso"),
    "Une **enzyme** (acétylcholinestérase) n'hydrolyse qu'**un** des deux acétates énantiotopes : 94 %, 99 % ee — puis PCC donne l'énone chirale\n\n" +
      img("lipase-schema"),
    ["alcool", "ester", "ac", "enzyme"],
    source(4, "Rem 3 : monoacétate (1R,4S)"),
  ),
);

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
    greene: 201,
    protection: ["formaldéhyde, H₃O⁺", "CH₂Br₂, NaH, DMF"],
    deprotection: ["BCl₃, CH₂Cl₂", "HCl 2 N"],
    stabilite: ["le plus dur à cliver de **tous** les acétals"],
    pourquoi: { stabilite: "Greene : le plus stable des acétals à l'hydrolyse acide" },
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
    greene: 204,
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
    greene: 207,
    mecanisme: {
      image: "meca-acetal",
      schema: "1.6",
      page: 5,
    },
    selectivite: "**cycle à 5** (1,3-dioxolane, sur un 1,2-diol) **> cycle à 6**",
    protection: [
      "CH₃C(OCH₃)=CH₂ (2-méthoxypropène), H⁺ anhydre, CH₂Cl₂",
      "Me₂C(OMe)₂ (2,2-diméthoxypropane), APTS ou PPTS, DMF",
      "acétone, H⁺",
    ],
    deprotection: ["H₃O⁺", "HCl, MeOH", "BCl₃"],
    pourquoi: {
      deprotection: "Greene : un 1,3-dioxane s'hydrolyse plus vite qu'un 1,3-dioxolane",
      selectivite:
        "Une cétone donne un cycle à 5 : le substituant axial du carbone acétalique déstabiliserait le 1,3-dioxane (Kocienski, Protecting Groups, p. 101). Le fascicule inverse ici les noms dioxane/dioxolane",
    },
  }),
  note(
    "acetonide:reactifs",
    "Les **trois réactifs** qui posent un acétonide (avec H⁺) ?",
    img("acetonide-reactifs") + "\n\nacétone · 2,2-diméthoxypropane · 2-méthoxypropène",
    ["diol", "acetal-cyclique", "acetonide", "protection"],
    source(
      5,
      "Le 2,2-diméthoxypropane libère du MeOH et non de l'eau : pas besoin de desséchant ; le 2-méthoxypropène pousse l'échange à son terme (Kocienski, Protecting Groups, p. 104-105)",
    ),
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
      "Le 2-méthoxypropène dans le DMF permet une acétalisation cinétique sans réarrangement (Kocienski, Protecting Groups, p. 106)",
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
    greene: 217,
    selectivite: "**cycle à 6** (1,3-dioxane, sur un 1,3-diol) **> cycle à 5**",
    protection: ["PhCHO, H⁺ anhydre, DMSO", "PhCHO, ZnCl₂"],
    deprotection: ["H₂, Pd/C, AcOH", "H₃O⁺", "Na, NH₃"],
    pourquoi: {
      selectivite:
        "Un aldéhyde donne plutôt un cycle à 6 ; dans le 1,3-dioxane, le phényle occupe de préférence la position équatoriale (Kocienski, Protecting Groups, p. 101). Le fascicule inverse ici les noms dioxane/dioxolane",
    },
  }),
  note(
    "benzylidene:reduction-primaire",
    "Ouvrir un benzylidène pour mettre le **Bn sur l'O primaire** (OH secondaire libre) ?\n\n" +
      img("benzylidene-13"),
    liste([
      "**Et₃SiH, TFA** (95 % si R = Ac, 80 % si R = Bn)",
      "**NaBH₃CN, HCl**, THF (82 %)",
      "BH₃·NMe₃, AlCl₃ (72 %) — dans le THF",
    ]) + "\n\n" + img("benzylidene-reduction"),
    ["diol", "acetal-cyclique", "benzylidene", "reduction"],
    source(
      7,
      "Sur un 4,6-O-benzylidène glucoside : régio-isomère A, 6-OBn et 4-OH. Greene : avec BH₃·NMe₃, le solvant décide — THF → 6-OBn, toluène ou CH₂Cl₂ → 4-OBn",
      221,
    ),
  ),
  note(
    "benzylidene:reduction-secondaire",
    "Ouvrir un benzylidène pour mettre le **Bn sur l'O secondaire** (OH primaire libre) ?\n\n" +
      img("benzylidene-13"),
    liste(["**Bu₂BOTf, BH₃·THF** (87 %)"]) + "\n\n" + img("benzylidene-reduction"),
    ["diol", "acetal-cyclique", "benzylidene", "reduction"],
    source(7, "Sur un 4,6-O-benzylidène glucoside : régio-isomère B, 4-OBn et 6-OH", 221),
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
    greene: 241,
    protection: [
      "Cl₂CO (phosgène — à proscrire) → **diphosgène** CCl₃OC(O)Cl ou **triphosgène** (CCl₃O)₂CO, pyridine",
      "Im₂CO (CDI), PhH, reflux",
    ],
    deprotection: ["OH⁻"],
    stabilite: ["H₃O⁺"],
    schemaPose: "carbonate-schema",
    pourquoi: {
      stabilite:
        "Greene : très stable à l'hydrolyse acide (AcOH, HBr, H₂SO₄/MeOH) et plus résistant à la base qu'un ester simple — l'inverse d'un acétal",
    },
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
    greene: 231,
    protection: ["MeC(OMe)₃, H⁺ anhydre"],
    deprotection: ["AcOH — plus sensible à H₃O⁺ qu'un acétonide"],
    stabilite: ["bases (B⁻)", "hydrures (H⁻)", "RLi", "R₂CuLi"],
    instable: ["H⁺, plus encore qu'un acétal ou un cétal"],
    schemaPose: "orthoester-schema",
    pourquoi: {
      deprotection:
        "Greene : l'hydrolyse acide douce donne d'abord un monoester du diol (mélange de régio-isomères)",
      stabilite: "« Méthoxyéthylène » dans le fascicule ; Greene l'appelle 1-méthoxyéthylidène",
    },
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
    source(
      8,
      "Au reflux du toluène, l'eau est chassée par un Dean-Stark (Kocienski, Protecting Groups, p. 158) ; avec le diol bis-silylé, le sous-produit est (TMS)₂O et non l'eau (Kocienski, Protecting Groups, p. 160)",
    ),
  ),
  note(
    "cetal:stabilite",
    "Cétals et dithiocétals : ils **résistent** à… ?",
    liste([
      "bases aqueuses et non aqueuses",
      "nucléophiles, **organométalliques** compris",
      "hydrures",
    ]) + "\n\n**Mais pas :** l'acide (cétals) · Hg²⁺, Ag⁺, MeI (dithiocétals)",
    ["cetone", "cetal", "dithiocetal", "stabilite"],
    source(null, "Stabilité : d'après Greene, le fascicule ne la donne pas", 296),
  ),
  note(
    "cetal:deprotection",
    "**Retirer** un cétal cyclique ?\n\n" + img("dioxolane"),
    "**H₃O⁺**" + mecanisme("meca-acetal", "1.6", 5),
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
    ]) + mecanisme("meca-dithiane", "1.7", 6),
    ["cetone", "dithiocetal", "deprotection"],
    source(
      8,
      "Le soufre est moins basique (Brønsted) que l'oxygène (Kocienski, Protecting Groups, p. 171) ; on accélère par interaction mou–mou avec Hg²⁺ ou Ag⁺ (Kocienski, Protecting Groups, p. 5), ou en alkylant le soufre, par exemple avec MeI (Kocienski, Protecting Groups, p. 173)",
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
      "Un acétal cyclique se clive plus lentement que son analogue ouvert ; un dithioacétal est pratiquement indestructible par les acides protiques (Kocienski, Protecting Groups, p. 5)",
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
    greene: 579,
    selectivite:
      "**dibenzylation** R–NBn₂ par BnX + base ; **monobenzylation** R–NHBn par amination réductrice (PhCHO puis réduction)",
    protection: [
      "BnCl, K₂CO₃, H₂O → R–NBn₂",
      "BnBr, Et₃N, MeCN → R–NBn₂",
      "PhCHO, CH₂Cl₂, puis NaBH₄ ou H₂–Pd/C → R–NHBn",
    ],
    deprotection: ["Na, NH₃", "Pd/C, HCOOH, MeOH"],
    pourquoi: {
      deprotection:
        "L'acide formique sert de source d'hydrogène : hydrogénation par transfert (Kocienski, Protecting Groups, p. 8). Greene : sous H₂/Pd-C, une benzylamine se coupe souvent très lentement",
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
    greene: 551,
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
    greene: 552,
    protection: ["Ac₂O ou AcCl, avec ou sans base"],
    deprotection: ["HCl aq., reflux", "NH₂NH₂, H₂O"],
    pourquoi: { deprotection: "L'hydrolyse d'un amide demande en général des conditions assez dures (Kocienski, Protecting Groups, p. 3)" },
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
    greene: 556,
    protection: ["(CF₃CO)₂O, pyridine, CH₂Cl₂"],
    deprotection: [
      "K₂CO₃ ou Na₂CO₃, MeOH, H₂O — **ne clive pas les esters méthyliques**",
      "NaBH₄, EtOH",
    ],
    pourquoi: {
      deprotection:
        "Exception parmi les amides : si labile que K₂CO₃/MeOH le retire en préservant des esters méthyliques (Kocienski, Protecting Groups, p. 3). Ne pas confondre avec TFA, l'acide trifluoroacétique",
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
    greene: 518,
    mecanisme: {
      image: "meca-tbu",
      schema: "1.3",
      page: 4,
      precision: "dessiné sur un ester ; même rupture pour les carbamates, dont l'acide carbamique perd ensuite CO₂ (Kocienski p. 186)",
    },
    protection: ["Boc₂O, NaOH, H₂O"],
    deprotection: ["HCl 3 M, EtOAc", "**TFA** pur ou dans CH₂Cl₂", "Δ ≥ 150 °C"],
    stabilite: ["nucléophiles", "bases (B⁻)"],
    pourquoi: {
      deprotection:
        "Rupture hétérolytique donnant le carbocation tert-butyle (Kocienski, Protecting Groups, p. 4) ; l'acide carbamique libéré, instable, perd CO₂ et rend l'amine (Kocienski, Protecting Groups, p. 186). Greene : TBS et TBDPS survivent au TFA qui retire le Boc",
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
    greene: 526,
    mecanisme: {
      image: "meca-pd",
      schema: "4.57",
      page: 141,
      precision: "dessiné sur un ester d'allyle ; la méthode s'étend aux carbamates d'allyle",
    },
    protection: ["AllocCl (AllOCOCl), pyridine"],
    deprotection: ["**Pd(PPh₃)₄**, Bu₃SnH, AcOH"],
    pourquoi: {
      deprotection:
        "Le Pd(0) forme un complexe π-allyle, que capte un nucléophile (Kocienski, Protecting Groups, p. 10, 141) ; l'acide carbamique libéré perd CO₂ (Kocienski, Protecting Groups, p. 186)",
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
    greene: 531,
    protection: ["BnOCOCl (CbzCl), Na₂CO₃, H₂O", "(BnOCO)₂O, dioxane, H₂O, NaOH ou Et₃N"],
    deprotection: [
      "**H₂** (ou un donneur d'H₂), **Pd/C**, EtOH",
      "BBr₃, CH₂Cl₂",
      "H₃O⁺ fort",
      "Na, NH₃",
    ],
    pourquoi: {
      deprotection: "Hydrogénolyse de la liaison benzylique (Kocienski, Protecting Groups, p. 8) ; l'acide carbamique libéré perd CO₂ (Kocienski, Protecting Groups, p. 186)",
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
    greene: 510,
    mecanisme: {
      image: "meca-tce",
      schema: "1.11",
      page: 7,
      precision: "dessiné sur un ester trichloroéthylique ; même principe pour le Troc",
    },
    protection: ["Cl₃CCH₂OCOCl (TrocCl), pyridine ou NaOH"],
    deprotection: ["**Zn**, THF, H₂O — ne touche ni Boc, ni Bn, ni TFA"],
    stabilite: ["aux conditions qui retirent un **Boc** (acide) ou un **trifluoroacétamide** (base douce)"],
    instable: ["H₂, Pd/C en milieu acide (TsOH, DMF)"],
    pourquoi: {
      stabilite: "Stabilité : d'après Greene — il supporte en revanche H₂ sur Ru-C ou Pt-C",
      protection: "Le fascicule écrit « Cl₃CH₂OCOCl » : il manque un C",
      deprotection:
        "Élimination réductrice par le zinc, proche d'une β-élimination : départ de 1,1-dichloroéthylène (Kocienski, Protecting Groups, p. 7) ; l'acide carbamique perd CO₂ (Kocienski, Protecting Groups, p. 186)",
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
    greene: 604,
    protection: ["TsCl, pyridine ou Et₃N, CH₂Cl₂"],
    deprotection: ["Li ou Na, NH₃", "HBr, AcOH, 70 °C"],
    pourquoi: {
      deprotection:
        "Parmi les protections d'azote les plus stables ; le retrait exige des conditions dures, souvent réductrices (Kocienski, Protecting Groups, p. 209, 212)",
    },
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
    "Surtout les éthers, esters, carbamates et amines benzyliques (Kocienski, Protecting Groups, p. 8). L'allyle n'y survit pas non plus, ni le Troc en milieu acide (Greene)",
  ),
  reflexe(
    "fluorure",
    "Qu'est-ce qui tombe sous **F⁻** (TBAF, HF, CsF) ?",
    "**TMS · TES · TBS · TIPS · TBDPS** et le **SEM**",
    "Tout ce qui porte un silicium : haute affinité du silicium pour le fluor (Kocienski, Protecting Groups, p. 6)",
  ),
  reflexe(
    "birch",
    "Qu'est-ce qui tombe sous **Na, NH₃** ?",
    "**Alcools :** Bn · Tr · BOM\n\n**Diols :** benzylidène\n\n**Amines :** Bn · Cbz · **Ts**",
    "Coupe éthers et esters benzyliques (Kocienski, Protecting Groups, p. 10) et même les sulfonamides (Kocienski, Protecting Groups, p. 212)",
  ),
  reflexe(
    "tfa-acide",
    "Qu'est-ce qui tombe sous **TFA** (acide trifluoroacétique) ?",
    "**t-Bu** (éther) · **PMB** · **Boc** · **Tr** (déjà en acide faible) · **SEM** (TFA, CH₂Cl₂)",
    "Ceux qui libèrent un carbocation stabilisé (Kocienski, Protecting Groups, p. 4). Le fascicule cite aussi TFA, CH₂Cl₂ pour un TBS ; Greene précise que TBS et TBDPS survivent au TFA qui retire un Boc : tout dépend de l'eau et du temps",
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
    "Réactif peu sélectif : Greene note qu'il attaque aussi la plupart des éthers, esters, cétals et carbamates, et les éthers silylés n'y survivent pas",
  ),
  reflexe(
    "bcl3",
    "Qu'est-ce qui tombe sous **BCl₃** ?",
    "**Bn** · **méthylène** · **acétonide**",
    "Greene : il coupe aussi le benzylidène et d'autres cétals",
  ),
  reflexe(
    "pmb-bn",
    "Retirer un **PMB** en gardant un **Bn** ?",
    "**DDQ** (ou CAN), CH₂Cl₂, H₂O",
    "Le PMB cède facilement un électron à la DDQ (Kocienski, Protecting Groups, p. 9) ; Greene : la DDQ ne coupe normalement pas un Bn",
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
    "Retirer un **Alloc** sans acide fort ni base ?",
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
    "**Acide doux** : AcOH 80 % (ou AcOH, H₂O, THF) — le TBDPS y résiste, 100 à 250 fois plus stable en acide (Greene ≈ 100 ; Kocienski, Protecting Groups, p. 38 : 100–250)",
    "Greene : AcOH 80 % retire TBS, Tr et THP mais laisse le TBDPS",
    "paire-tbs-tbdps",
  ),
  reflexe(
    "tbdps-tbs",
    "Et l'inverse : retirer un **TBDPS** en gardant un **TBS** ?",
    "**Base forte** : NaOH 5 N, EtOH — le TBS y résiste",
    "Greene & Wuts, 3ᵉ éd., p. 142 : le TBDPS est un peu moins stable en base que le TBS. Le fascicule cite NaOH 5 N, EtOH ou KOH 10 %, MeOH pour retirer un TBDPS",
    "paire-tbs-tbdps",
  ),
  reflexe(
    "boc-tbs",
    "Retirer un **Boc** en gardant un **TBS** ?",
    "**TFA** (anhydre), CH₂Cl₂ — TBS et TBDPS y survivent",
    "Greene & Wuts, 3ᵉ éd., p. 520",
    "paire-boc-tbs",
  ),
  reflexe(
    "sem-thp",
    "Retirer un **THP** ou un **TBS** en gardant un **SEM** ?",
    "**AcOH, H₂O, THF**, 45 °C — le SEM y résiste",
    "Greene & Wuts, 3ᵉ éd., p. 45",
  ),
  reflexe(
    "tertiaire",
    "Quels groupes **ne se posent pas** (ou mal) sur un alcool **tertiaire** ?",
    "**Tr** (primaire ≫ secondaire) · **Piv** (jamais sur un tertiaire) · **TBS**-Cl (primaire ≫ secondaire ⋙ tertiaire) · **Ac₂O, pyridine** sans DMAP",
    "Pour un tertiaire : TBSOTf, 2,6-lutidine, ou Ac₂O avec DMAP (Greene)",
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
    "Cétone : le substituant axial déstabiliserait le cycle à 6. Aldéhyde : dans le cycle à 6, le phényle se met en équatorial (Kocienski, Protecting Groups, p. 101)",
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
