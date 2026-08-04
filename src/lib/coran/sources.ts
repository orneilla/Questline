/**
 * D'où vient le texte, et sous quelles conditions.
 *
 * Ce fichier ne contient aucun texte coranique : uniquement l'identité des
 * éditions et ce que leurs détenteurs de droits en disent. Il existe parce
 * qu'une règle du module l'exige — aucune édition n'entre en base sans que sa
 * licence ait été lue et recopiée ici, et chaque écran qui affiche une édition
 * cite ce qui est écrit ci-dessous.
 *
 * ── Pourquoi alquran.cloud plutôt que l'API de la Quran Foundation
 *
 * Trois raisons, dans l'ordre où elles pèsent :
 *
 * 1. Aucune identification. L'API de la Quran Foundation (api.quran.foundation)
 *    demande depuis sa v4 un client_id et un client_secret obtenus après
 *    inscription. Questline s'installe depuis un navigateur, sans terminal :
 *    chaque secret supplémentaire est une manipulation de plus qui peut échouer
 *    sans moyen de la déboguer.
 * 2. Un appel par sourate, toutes éditions à la fois. `/v1/surah/{n}/editions/
 *    a,b,c` rend les trois textes alignés verset par verset, ce qui rend
 *    l'import découpable en 114 lots naturels et reprenable sans état.
 * 3. L'audio est servi par le même projet, en fichiers par verset, sans clé et
 *    sans quota déclaré.
 *
 * ── Ce qui n'a pas pu être vérifié
 *
 * Les licences ci-dessous ont été lues dans la documentation des projets, pas
 * obtenues en appelant les serveurs : l'environnement de développement de cette
 * session n'a pas d'accès sortant vers ces domaines. La route d'import vérifie
 * donc la forme de ce qu'elle reçoit avant d'écrire quoi que ce soit, et dit
 * précisément ce qu'elle a reçu si cela ne correspond pas.
 */

/**
 * Base de l'API. Surchargeable par `CORAN_API_BASE` : c'est ce qui permet de
 * pointer vers un miroir si l'adresse change, et d'éprouver l'import contre un
 * serveur de test sans jamais toucher au texte réel.
 */
export const API_BASE = process.env.CORAN_API_BASE ?? "https://api.alquran.cloud/v1";

/** L'audio n'est jamais stocké : il est lu depuis ce CDN, verset par verset. */
export const CDN_AUDIO = "https://cdn.islamic.network/quran/audio";

/**
 * Le texte arabe. Une seule édition possible, et elle n'est pas un choix :
 * Hafs 'an 'Asim en graphie uthmanienne, distribué par le projet Tanzil.
 */
export const EDITION_ARABE = {
  cle: "quran-uthmani",
  riwaya: "Hafs 'an 'Asim",
  graphie: "Uthmani",
  source: "Projet Tanzil (tanzil.net), servi par alquran.cloud",
  licence:
    "Creative Commons Attribution 3.0. Copie et distribution verbatim autorisées ; " +
    "toute modification est interdite. La mention de la source et le lien vers " +
    "tanzil.net doivent accompagner le texte.",
  lien: "https://tanzil.net/docs/text_license",
} as const;

export type Disponibilite = "claire" | "a_lire";

export type EditionProposee = {
  cle: string;
  langue: string;
  nom: string;
  auteur: string;
  type: "traduction" | "translitteration";
  source: string;
  /** Les conditions telles que la source les énonce, sans reformulation. */
  licence: string;
  lien: string;
  /**
   * « claire » : les conditions sont publiées par le détenteur des droits et
   * ne demandent rien de plus qu'une attribution.
   * « a_lire » : les conditions existent mais viennent d'un redistributeur qui
   * n'est pas l'ayant droit, ou restreignent l'usage. Rien n'est importé sans
   * que ces conditions aient été affichées et acceptées.
   */
  disponibilite: Disponibilite;
  /** Ce qu'il faut savoir avant de décider, en une phrase. */
  avertissement?: string;
};

/**
 * Ce que l'on peut ajouter au texte arabe.
 *
 * Aucune de ces éditions n'est importée d'office. Chacune se choisit dans les
 * réglages, après avoir lu ses conditions — c'est la seule façon de ne rien
 * présumer d'une licence que ce projet n'a pas le pouvoir d'accorder.
 */
export const EDITIONS_PROPOSEES: EditionProposee[] = [
  {
    cle: "fr.hamidullah",
    langue: "fr",
    nom: "Le Noble Coran et la traduction en langue française de ses sens",
    auteur: "Muhammad Hamidullah",
    type: "traduction",
    source: "Projet Tanzil, servi par alquran.cloud",
    licence:
      "Tanzil : « Les traductions fournies ici le sont pour un usage non " +
      "commercial uniquement. Pour tout autre usage, vous devez obtenir " +
      "l'autorisation nécessaire auprès du traducteur ou de l'éditeur. »",
    lien: "https://tanzil.net/trans/",
    disponibilite: "a_lire",
    avertissement:
      "Tanzil redistribue cette traduction mais n'en détient pas les droits : " +
      "Muhammad Hamidullah est mort en 2002, son texte reste protégé, et la " +
      "révision du Complexe du Roi Fahd l'est séparément. La permission " +
      "affichée couvre un usage personnel non commercial — ce qui est le cas " +
      "de Questline — mais elle n'est pas une licence accordée par l'ayant " +
      "droit. Importe-la pour ta lecture, ne la republie pas.",
  },
  {
    cle: "en.transliteration",
    langue: "la",
    nom: "Translittération latine",
    auteur: "Projet Tanzil",
    type: "translitteration",
    source: "Projet Tanzil, servi par alquran.cloud",
    licence:
      "Tanzil : usage non commercial. La translittération est un travail du " +
      "projet Tanzil lui-même, distribué avec le reste de ses ressources.",
    lien: "https://tanzil.net/trans/",
    disponibilite: "a_lire",
  },
];

/**
 * Le corpus morphologique — analyse mot à mot.
 *
 * Licence claire, et c'est assez rare pour être dit : le Quranic Arabic Corpus
 * de Kais Dukes (université de Leeds) est publié sous GNU General Public
 * License. Copie verbatim autorisée, modification interdite, usage libre dans
 * une application à condition d'indiquer clairement la source avec un lien vers
 * corpus.quran.com. C'est exactement ce que fait le panneau mot à mot.
 *
 * Ce que le corpus apporte : la racine trilitère, le lemme, la catégorie
 * grammaticale et la translittération Buckwalter de chaque mot. Ce qu'il
 * n'apporte pas : le sens. La forme arabe non plus n'est pas reprise du corpus
 * — elle est découpée du verset déjà en base, verbatim, pour qu'aucun caractère
 * arabe affiché ne vienne d'ailleurs que de Tanzil.
 */
export const CORPUS_MORPHOLOGIE = {
  cle: "corpus-morphologie-0.4",
  nom: "Quranic Arabic Corpus — morphologie v0.4",
  auteur: "Kais Dukes, université de Leeds",
  source:
    "corpus.quran.com, via le fork mustafa0x/quran-morphology — le fichier " +
    "officiel n'est servi que derrière un formulaire, inatteignable par requête",
  licence:
    "GNU General Public License. Copie et distribution verbatim autorisées ; " +
    "toute modification est interdite. L'annotation peut être utilisée dans " +
    "n'importe quelle application à condition que sa source soit clairement " +
    "indiquée, avec un lien vers corpus.quran.com.",
  lien: "https://corpus.quran.com/license.jsp",
} as const;

/**
 * Adresse du fichier de morphologie.
 *
 * corpus.quran.com ne sert le fichier officiel que derrière un formulaire de
 * courriel : aucune requête ne l'atteint. Le miroir retenu est le fork de
 * Mustafa, même lignée v0.4 sous GPL, dont la forme diffère du 0.4 documenté —
 * c'est cette forme-là qu'analyse `morphologie.ts`.
 *
 * Surchargeable par `CORAN_MORPHOLOGIE_URL` : les miroirs bougent, et une
 * adresse morte ne doit pas demander un redéploiement. L'adresse réellement
 * servie est retenue en base et affichée dans les réglages.
 */
export const URL_MORPHOLOGIE =
  process.env.CORAN_MORPHOLOGIE_URL ??
  "https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt";

/**
 * Le sens des mots.
 *
 * Aucune source n'a été retenue, et c'est délibéré. Les gloses mot à mot qui
 * circulent — y compris dans des dépôts qui s'annoncent en CC BY — dérivent du
 * corpus ou de Quran.com sans que la chaîne de droits soit vérifiable, et un
 * dépôt qui se déclare libre ne rend pas libre ce qu'il redistribue. Le panneau
 * mot à mot fonctionne sans : il donne la racine, le lemme, la grammaire et la
 * fréquence, ce qui est précisément ce qui s'apprend. Le champ `sens` existe en
 * base, prêt à recevoir une glose dont la licence serait claire.
 */
export const GLOSE_ABSENTE =
  "Aucune glose mot à mot n'a de licence vérifiable : le panneau montre la racine, " +
  "le lemme et la grammaire, qui viennent du corpus sous GPL.";

export function editionProposee(cle: string): EditionProposee | undefined {
  return EDITIONS_PROPOSEES.find((e) => e.cle === cle);
}

/** Récitateurs proposés. L'audio est diffusé, jamais copié en base. */
export const RECITEURS = [
  { cle: "ar.alafasy", nom: "Mishary Rashid Alafasy" },
  { cle: "ar.abdulbasitmurattal", nom: "Abdul Basit ‘Abd us-Samad — murattal" },
  { cle: "ar.husary", nom: "Mahmoud Khalil Al-Husary" },
  { cle: "ar.minshawi", nom: "Mohamed Siddiq El-Minshawi" },
  { cle: "ar.shaatree", nom: "Abu Bakr Ash-Shaatree" },
  { cle: "ar.hudhaify", nom: "Ali Al-Hudhaify" },
] as const;

export function nomReciteur(cle: string): string {
  return RECITEURS.find((r) => r.cle === cle)?.nom ?? cle;
}

/** Adresse du fichier audio d'un verset. Rien n'est téléchargé côté serveur. */
export function urlAudio(reciteur: string, versetGlobal: number, debit = 128): string {
  return `${CDN_AUDIO}/${debit}/${reciteur}/${versetGlobal}.mp3`;
}

/** Les polices proposées pour le texte arabe. */
export const POLICES = [
  {
    cle: "amiri",
    nom: "Amiri Quran",
    pile: '"Amiri Quran", "Amiri", "Scheherazade New", "KFGQPC Uthman Taha Naskh", "Noto Naskh Arabic", serif',
  },
  {
    cle: "naskh",
    nom: "Noto Naskh",
    pile: '"Noto Naskh Arabic", "Amiri", "Geeza Pro", serif',
  },
  {
    cle: "systeme",
    nom: "Police du système",
    pile: '"Geeza Pro", "Al Bayan", "Traditional Arabic", serif',
  },
] as const;

export function pilePolice(cle: string): string {
  return POLICES.find((p) => p.cle === cle)?.pile ?? POLICES[0].pile;
}
