/**
 * Les catégories d'aliments — logique pure, partagée serveur et écran.
 *
 * Elles ne sont pas un type énuméré en base : les groupes Ciqual sont bien plus
 * fins que ce dont la cuisine a besoin, et une liste figée dans le schéma
 * empêcherait d'en ajouter une sans migration. C'est du texte, avec une liste
 * canonique ici — la Phase 3 s'en servira pour croiser les patrons de plat.
 */

export type Categorie = {
  cle: string;
  nom: string;
  /** Teinte sourde, dans le registre du reste de l'application. */
  couleur: string;
};

export const CATEGORIES: Categorie[] = [
  { cle: "legume", nom: "Légume", couleur: "#8fa37e" },
  { cle: "fruit", nom: "Fruit", couleur: "#c0826c" },
  { cle: "feculent", nom: "Féculent", couleur: "#c2a567" },
  { cle: "proteine", nom: "Protéine", couleur: "#b58a93" },
  { cle: "laitage", nom: "Laitage", couleur: "#8a9ba8" },
  { cle: "matiere_grasse", nom: "Matière grasse", couleur: "#a8926f" },
  { cle: "epice", nom: "Épice", couleur: "#9c8fb4" },
  { cle: "condiment", nom: "Condiment", couleur: "#7f9c8a" },
  { cle: "boisson", nom: "Boisson", couleur: "#7e92b8" },
  { cle: "sucre", nom: "Sucré", couleur: "#6fa396" },
  { cle: "autre", nom: "Autre", couleur: "#8a8f98" },
];

export const CATEGORIE_PAR_DEFAUT = "autre";

export function nomCategorie(cle: string): string {
  return CATEGORIES.find((c) => c.cle === cle)?.nom ?? "Autre";
}

export function couleurCategorie(cle: string): string {
  return CATEGORIES.find((c) => c.cle === cle)?.couleur ?? "#8a8f98";
}

export function categorieValide(cle: string): boolean {
  return CATEGORIES.some((c) => c.cle === cle);
}

/** Plie une chaîne pour la comparer : minuscules, sans accent ni ponctuation. */
export function replier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Devine une catégorie à partir d'un libellé.
 *
 * Sert à deux endroits : ranger les groupes Ciqual à l'import, et proposer une
 * catégorie quand on tape un nom à la main. Ce n'est qu'une proposition —
 * elle se corrige d'un tap, et « autre » est une réponse acceptable.
 *
 * Les règles sont dans cet ordre : la première qui correspond gagne. Les plus
 * spécifiques passent donc devant.
 */
const INDICES: { categorie: string; mots: string[] }[] = [
  {
    categorie: "matiere_grasse",
    mots: ["huile", "beurre", "margarine", "saindoux", "graisse", "creme fraiche"],
  },
  {
    categorie: "epice",
    mots: [
      "epice", "aromate", "herbe", "cumin", "curcuma", "paprika", "cannelle",
      "poivre", "gingembre", "curry", "ras el hanout", "thym", "laurier",
      "origan", "basilic", "persil", "coriandre", "safran", "muscade",
    ],
  },
  {
    categorie: "condiment",
    mots: [
      "sauce", "vinaigre", "moutarde", "condiment", "bouillon", "concentre de tomate",
      "harissa", "sel", "ketchup", "mayonnaise", "olive", "cornichon", "citron confit",
    ],
  },
  {
    categorie: "laitage",
    mots: ["lait", "yaourt", "fromage", "yogourt", "skyr", "faisselle", "petit suisse"],
  },
  {
    categorie: "proteine",
    mots: [
      "viande", "boeuf", "veau", "agneau", "mouton", "poulet", "dinde", "volaille",
      "poisson", "saumon", "thon", "cabillaud", "sardine", "crevette", "fruits de mer",
      "oeuf", "tofu", "seitan", "lentille", "pois chiche", "haricot sec", "feve",
      "charcuterie", "jambon", "abat",
    ],
  },
  {
    categorie: "feculent",
    mots: [
      "riz", "pate", "semoule", "couscous", "boulgour", "quinoa", "ble", "pain",
      "pomme de terre", "patate douce", "farine", "avoine", "cereale", "maïs",
      "polenta", "vermicelle", "nouille",
    ],
  },
  {
    categorie: "fruit",
    mots: [
      "fruit", "pomme", "poire", "banane", "orange", "fraise", "raisin", "peche",
      "abricot", "datte", "figue", "mangue", "ananas", "melon", "pasteque",
      "framboise", "myrtille", "kiwi", "cerise", "prune", "citron",
    ],
  },
  {
    categorie: "legume",
    mots: [
      "legume", "courgette", "tomate", "carotte", "oignon", "ail", "poireau",
      "aubergine", "poivron", "epinard", "salade", "laitue", "brocoli", "chou",
      "haricot vert", "petit pois", "navet", "betterave", "concombre", "champignon",
      "courge", "potiron", "celeri", "radis", "artichaut", "fenouil",
    ],
  },
  {
    categorie: "sucre",
    mots: [
      "sucre", "miel", "confiture", "chocolat", "biscuit", "gateau", "patisserie",
      "bonbon", "sirop", "dessert", "glace", "viennoiserie",
    ],
  },
  {
    categorie: "boisson",
    mots: ["boisson", "eau", "jus", "the", "cafe", "infusion", "soda", "limonade"],
  },
];

export function deviner(libelle: string): string {
  const plie = replier(libelle);
  if (plie.length === 0) return CATEGORIE_PAR_DEFAUT;

  for (const indice of INDICES) {
    if (indice.mots.some((mot) => plie.includes(mot))) return indice.categorie;
  }
  return CATEGORIE_PAR_DEFAUT;
}
