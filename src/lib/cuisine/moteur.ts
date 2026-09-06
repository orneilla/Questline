import { replier } from "./categories";
import type { RoleIngredient } from "@/db/cuisine";

/**
 * Le moteur de suggestions — logique pure, sans base ni réseau.
 *
 * Entièrement déterministe : les mêmes entrées donnent toujours la même
 * sortie. Rien n'est tiré au sort, rien n'est demandé à un service extérieur.
 * C'est ce qui permet d'expliquer chaque proposition — et une proposition
 * qu'on ne peut pas expliquer n'est pas une proposition, c'est un oracle.
 */

export type ArticleDispo = {
  id: number;
  nom: string;
  categorie: string;
  /** Un article épuisé reste dans l'inventaire mais ne nourrit rien. */
  disponible: boolean;
  alimentId: number | null;
};

export type IngredientAttendu = {
  id: number;
  nomLibre: string;
  alimentId: number | null;
  role: RoleIngredient;
  categorieSubstitution: string | null;
  quantiteG: number;
};

/* ────────────────────── Correspondance ────────────────────── */

/**
 * Un ingrédient est-il couvert par un article de l'inventaire ?
 *
 * Deux façons : la fiche du catalogue est la même, ou les noms se recouvrent
 * une fois pliés. « Courgettes » couvre « courgette », « Riz blanc étuvé »
 * couvre « riz ». Le recouvrement dans les deux sens est voulu : on écrit
 * « riz » dans l'inventaire et « riz blanc étuvé » dans une recette, et
 * l'inverse arrive tout autant.
 */
export function correspond(ingredient: IngredientAttendu, article: ArticleDispo): boolean {
  if (
    ingredient.alimentId !== null &&
    article.alimentId !== null &&
    ingredient.alimentId === article.alimentId
  ) {
    return true;
  }

  const a = replier(ingredient.nomLibre);
  const b = replier(article.nom);
  if (a.length < 3 || b.length < 3) return a === b;
  return a.includes(b) || b.includes(a);
}

export type EtatIngredient = {
  ingredient: IngredientAttendu;
  /** Comment il est couvert, ou pourquoi il ne l'est pas. */
  statut: "present" | "remplace" | "manquant";
  /** L'article qui le couvre, quand il y en a un. */
  par: ArticleDispo | null;
};

/**
 * Confronte une recette à l'inventaire.
 *
 * Un ingrédient est `present` s'il est là. Il est `remplace` quand il manque
 * mais qu'un autre ingrédient de la recette, marqué `substituable` et rangé
 * dans la même catégorie de substitution, est lui présent — c'est exactement
 * le cas « je n'ai pas de poulet mais j'ai du tofu, et la recette dit que
 * l'un vaut l'autre ». Sinon il est `manquant`.
 */
export function confronter(
  ingredients: IngredientAttendu[],
  inventaire: ArticleDispo[],
): EtatIngredient[] {
  const dispo = inventaire.filter((a) => a.disponible);

  const trouve = (ingredient: IngredientAttendu) =>
    dispo.find((article) => correspond(ingredient, article)) ?? null;

  const presents = new Map<number, ArticleDispo | null>();
  for (const ingredient of ingredients) presents.set(ingredient.id, trouve(ingredient));

  return ingredients.map((ingredient) => {
    const par = presents.get(ingredient.id) ?? null;
    if (par) return { ingredient, statut: "present" as const, par };

    const categorie = ingredient.categorieSubstitution;
    if (categorie) {
      // Un autre ingrédient de la recette, substituable et de la même
      // catégorie, présent dans le placard : il prend la place.
      const remplacant = ingredients.find(
        (autre) =>
          autre.id !== ingredient.id &&
          autre.role === "substituable" &&
          autre.categorieSubstitution === categorie &&
          presents.get(autre.id),
      );
      if (remplacant) {
        return {
          ingredient,
          statut: "remplace" as const,
          par: presents.get(remplacant.id) ?? null,
        };
      }

      // À défaut, n'importe quoi de cette catégorie dans l'inventaire fait
      // l'affaire pour un ingrédient explicitement substituable.
      if (ingredient.role === "substituable") {
        const autreChose = dispo.find((article) => article.categorie === categorie);
        if (autreChose) {
          return { ingredient, statut: "remplace" as const, par: autreChose };
        }
      }
    }

    return { ingredient, statut: "manquant" as const, par: null };
  });
}

export type ScoreRecette = {
  /** Faux quand un essentiel manque sans remplaçant : la recette est écartée. */
  faisable: boolean;
  etats: EtatIngredient[];
  manquants: EtatIngredient[];
  /** Nombre d'ingrédients manquants, tous rôles confondus : le tri principal. */
  nbManquants: number;
  /** Départage deux recettes à égalité de manquants. Plus bas vaut mieux. */
  penalite: number;
};

/** Ce que coûte un manque, selon le rôle. Un optionnel pèse à peine. */
const COUT: Record<RoleIngredient, number> = {
  essentiel: 100,
  substituable: 10,
  optionnel: 1,
};

export function noter(
  ingredients: IngredientAttendu[],
  inventaire: ArticleDispo[],
): ScoreRecette {
  const etats = confronter(ingredients, inventaire);
  const manquants = etats.filter((e) => e.statut === "manquant");

  const essentielManquant = manquants.some((e) => e.ingredient.role === "essentiel");
  const penalite = manquants.reduce((somme, e) => somme + COUT[e.ingredient.role], 0);

  return {
    faisable: !essentielManquant,
    etats,
    manquants,
    nbManquants: manquants.length,
    penalite,
  };
}

/* ────────────────────── Patrons combinatoires ────────────────────── */

export type PatronSimple = {
  id: number;
  nom: string;
  categories: string[];
  profil: string;
  modeCuisson: string;
  exclut: string[];
};

export type Combinaison = {
  /** Ce qui identifie la combinaison, pour ne pas la reproposer. */
  cle: string;
  patron: PatronSimple;
  /** Un article par catégorie demandée, dans l'ordre du patron. */
  articles: ArticleDispo[];
};

/**
 * Un article peut-il pourvoir une place de ce patron ?
 *
 * La catégorie doit correspondre, et l'article ne doit être visé par aucune
 * exclusion du profil. C'est ainsi qu'une contrainte de compatibilité se dit
 * ici, en clair, plutôt qu'en table de correspondances qu'on ne saurait plus
 * relire dans six mois.
 *
 * Une exclusion vise deux choses à la fois : une catégorie entière quand elle
 * en nomme une — « ce profil ne va pas avec les laitages » — ou un mot cherché
 * dans le nom sinon — « pas de fromage ». Sans le premier cas, il faudrait
 * énumérer tous les fromages du monde pour écarter le parmesan.
 */
export function convient(
  article: ArticleDispo,
  categorie: string,
  exclut: string[],
  categoriesConnues: string[] = [],
): boolean {
  if (!article.disponible) return false;
  if (article.categorie !== categorie) return false;

  const nom = replier(article.nom);
  return !exclut.some((brut) => {
    const plie = replier(brut);
    if (plie.length === 0) return false;
    if (categoriesConnues.includes(brut)) return article.categorie === brut;
    return nom.includes(plie);
  });
}

/**
 * Croise les patrons avec l'inventaire réel.
 *
 * Un patron ne produit rien tant qu'une de ses catégories reste vide : mieux
 * vaut trois suggestions tenables que trente bancales. Pour chaque patron on
 * ne garde qu'un nombre borné de combinaisons — le produit cartésien d'un
 * placard bien rempli en donnerait des centaines, toutes identiques à un
 * légume près.
 */
export function combiner(
  patrons: PatronSimple[],
  inventaire: ArticleDispo[],
  categoriesConnues: string[] = [],
  maxParPatron = 2,
): Combinaison[] {
  const sorties: Combinaison[] = [];

  for (const patron of patrons) {
    const parPlace = patron.categories.map((categorie) =>
      inventaire.filter((a) => convient(a, categorie, patron.exclut, categoriesConnues)),
    );

    // Une catégorie sans candidat : le patron ne tient pas.
    if (parPlace.some((liste) => liste.length === 0)) continue;

    for (let rang = 0; rang < maxParPatron; rang += 1) {
      // Décalage circulaire : la deuxième combinaison d'un patron ne reprend
      // pas les mêmes articles que la première quand le placard le permet.
      const articles = parPlace.map((liste) => liste[rang % liste.length]);
      const cle = `patron:${patron.id}:${articles.map((a) => a.id).join("-")}`;
      if (sorties.some((s) => s.cle === cle)) continue;
      sorties.push({ cle, patron, articles });
    }
  }

  return sorties;
}

/* ────────────────────── Anti-répétition ────────────────────── */

/**
 * Écarte ce qui a déjà été proposé ou cuisiné récemment.
 *
 * « Sauf si je n'ai vraiment rien d'autre » : quand le filtre ne laisse rien,
 * on rend la liste entière plutôt qu'un écran vide. Une répétition assumée
 * vaut mieux qu'un silence.
 */
export function ecarterRecent<T extends { cle: string }>(
  propositions: T[],
  clesRecentes: Set<string>,
): { retenues: T[]; toutesRecentes: boolean } {
  const retenues = propositions.filter((p) => !clesRecentes.has(p.cle));
  if (retenues.length > 0) return { retenues, toutesRecentes: false };
  return { retenues: propositions, toutesRecentes: propositions.length > 0 };
}

export const FENETRE_ANTI_REPETITION_JOURS = 10;
