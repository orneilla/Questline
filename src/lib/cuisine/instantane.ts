import type { NutrimentCle } from "./ciqual";
import { NUTRIMENTS, type IngredientCalcul, type Totaux } from "./nutrition";
import type { Couverture, IngredientFige, PrecisionSaisie } from "@/db/cuisine";

/**
 * L'instantané d'une entrée de journal — logique pure, sans base ni réseau.
 *
 * Le principe : ce qui a été mangé ne bouge plus. Ni parce qu'on a corrigé un
 * grammage dans la recette, ni parce que la fiche d'un aliment a été mise à
 * jour. L'entrée emporte donc tout ce qu'il faut pour se recalculer seule —
 * chaque ingrédient avec son poids et ses teneurs d'alors.
 *
 * Ce qui reste modifiable, c'est la saisie : le poids de l'assiette, le
 * grammage, le repas, la date. Les corriger ne consulte rien d'extérieur ; ça
 * rejoue le même calcul sur le même instantané.
 */

export type Instantane = {
  origine: "recette" | "aliment";
  ingredients: IngredientFige[];
  /** Recette : le nombre de parts au moment de la saisie. */
  nbPortions: number;
  /** Recette : le poids total cuit connu alors. Null = aucun rapport possible. */
  poidsTotalCuitG: number | null;
};

/** Fige les ingrédients d'une recette : grammages et teneurs pour 100 g. */
export function figer(ingredients: IngredientCalcul[]): IngredientFige[] {
  return ingredients.map((ingredient) => {
    const valeurs: Record<string, number | null> = {};
    for (const cle of NUTRIMENTS) {
      const teneur = ingredient.fiche?.valeurs[cle];
      valeurs[cle] = teneur === undefined ? null : teneur;
    }

    return {
      alimentId: ingredient.fiche?.id ?? null,
      nom: ingredient.nomLibre,
      source: ingredient.fiche?.source ?? null,
      quantiteG: ingredient.quantiteG,
      valeurs,
    };
  });
}

/** Le total du plat entier, tel qu'il était. */
export function totalFige(ingredients: IngredientFige[]): Totaux {
  const total: Totaux = {};

  for (const ingredient of ingredients) {
    const facteur = ingredient.quantiteG / 100;
    for (const cle of NUTRIMENTS) {
      const pour100 = ingredient.valeurs[cle];
      if (pour100 === null || pour100 === undefined) continue;
      total[cle] = (total[cle] ?? 0) + pour100 * facteur;
    }
  }

  return total;
}

/**
 * Quelle part du poids du plat chaque nutriment couvre réellement.
 *
 * Deux trous très différents se cachaient jusqu'ici sous un seul drapeau.
 * L'ingrédient sans fiche du tout fait disparaître son poids de tous les
 * nutriments. L'ingrédient avec fiche mais dont Ciqual ne donne pas les fibres
 * — cas très fréquent — laisse l'énergie juste et les fibres fausses. Une
 * couverture par nutriment distingue les deux, et se lit en clair :
 * « fibres : 62 % du poids couvert ».
 *
 * Le dénominateur est le poids total, ingrédients sans fiche compris : c'est
 * précisément ce qu'on veut voir manquer.
 */
export function couvrir(ingredients: IngredientFige[]): Couverture {
  const poidsTotal = ingredients.reduce((somme, i) => somme + i.quantiteG, 0);
  const couverture: Couverture = {};

  if (poidsTotal <= 0) {
    for (const cle of CLES_COUVERTURE) couverture[cle] = 1;
    return couverture;
  }

  for (const cle of NUTRIMENTS) {
    const couvert = ingredients.reduce(
      (somme, i) =>
        i.valeurs[cle] === null || i.valeurs[cle] === undefined
          ? somme
          : somme + i.quantiteG,
      0,
    );
    couverture[cle] = couvert / poidsTotal;
  }

  // La part portée par des ingrédients qui ont au moins une fiche. C'est le
  // plafond que les nutriments peuvent atteindre : en dessous, la cause est
  // une valeur nulle dans la fiche ; à ce niveau exactement, c'est qu'un
  // ingrédient n'a pas de fiche du tout. Les confondre était le défaut du
  // drapeau unique qu'on vient de retirer.
  couverture[CLE_FICHE] =
    ingredients.reduce((s, i) => (i.alimentId === null ? s : s + i.quantiteG), 0) /
    poidsTotal;

  return couverture;
}

/** Les ingrédients qu'aucune fiche ne couvre : nommés, pas seulement comptés. */
export function sansFiche(ingredients: IngredientFige[]): string[] {
  return ingredients
    .filter((i) => i.alimentId === null && i.quantiteG > 0)
    .map((i) => i.nom);
}

export type Recalcul = {
  valeurs: Totaux;
  precision: PrecisionSaisie;
  /** La part du plat retenue. 1 pour un aliment seul. */
  part: number;
  /** Vrai quand la part est théorique : aucun rapport ne s'appliquait. */
  theorique: boolean;
  /** Grammes crus équivalents de ce qui est mangé. */
  poidsRetenuG: number;
  couverture: Couverture;
  sansFiche: string[];
};

/**
 * Rejoue le calcul d'une entrée à partir de son seul instantané.
 *
 * La règle du « pesé » ne vaut que pour une entrée dérivée d'une recette :
 * il y faut le poids de l'assiette et le poids total cuit, faute de quoi la
 * part reste théorique et l'entrée est estimée quoi qu'on ait demandé.
 *
 * Un aliment seul n'a ni assiette ni poids total cuit, et se pèse pourtant
 * directement à la balance : sa précision est celle qu'on déclare, sans
 * condition. Appliquer la règle des recettes ici rendrait impossible
 * d'enregistrer « 100 g de riz cru, pesés », ce qui est absurde.
 */
export function recalculer(
  instantane: Instantane,
  saisie: { poidsAssietteG: number | null; precision: PrecisionSaisie },
): Recalcul {
  const couverture = couvrir(instantane.ingredients);
  const manquants = sansFiche(instantane.ingredients);
  const poidsCru = instantane.ingredients.reduce((s, i) => s + i.quantiteG, 0);
  const total = totalFige(instantane.ingredients);

  if (instantane.origine === "aliment") {
    return {
      valeurs: total,
      precision: saisie.precision,
      part: 1,
      theorique: false,
      poidsRetenuG: poidsCru,
      couverture,
      sansFiche: manquants,
    };
  }

  const applicable =
    saisie.poidsAssietteG !== null &&
    saisie.poidsAssietteG > 0 &&
    instantane.poidsTotalCuitG !== null &&
    instantane.poidsTotalCuitG > 0;

  const part = applicable
    ? saisie.poidsAssietteG! / instantane.poidsTotalCuitG!
    : 1 / Math.max(1, instantane.nbPortions);

  const valeurs: Totaux = {};
  for (const cle of NUTRIMENTS) {
    if (total[cle] !== undefined) valeurs[cle] = total[cle]! * part;
  }

  return {
    valeurs,
    precision: applicable ? saisie.precision : "estime",
    part,
    theorique: !applicable,
    poidsRetenuG: poidsCru * part,
    couverture,
    sansFiche: manquants,
  };
}

/**
 * La couverture d'un ensemble d'entrées, pondérée par le poids.
 *
 * Une entrée de 30 g dont les fibres manquent ne pèse pas autant qu'une de
 * 400 g dans le même cas. Moyenner les pourcentages à parts égales gonflerait
 * ou minorerait le trou selon la taille des portions.
 */
export function couvertureCumulee(
  entrees: { couverture: Couverture; poidsRetenuG: number | null }[],
): Couverture {
  const cumul: Couverture = {};
  const poidsTotal = entrees.reduce((s, e) => s + (e.poidsRetenuG ?? 0), 0);

  if (poidsTotal <= 0) {
    for (const cle of CLES_COUVERTURE) cumul[cle] = 1;
    return cumul;
  }

  for (const cle of NUTRIMENTS) {
    const couvert = entrees.reduce(
      (s, e) => s + (e.poidsRetenuG ?? 0) * (e.couverture[cle] ?? 0),
      0,
    );
    cumul[cle] = couvert / poidsTotal;
  }

  cumul[CLE_FICHE] =
    entrees.reduce((s, e) => s + (e.poidsRetenuG ?? 0) * plafondFiche(e.couverture), 0) /
    poidsTotal;

  return cumul;
}

/** Sous ce seuil, la couverture mérite d'être dite. Au-dessus, c'est du bruit. */
export const COUVERTURE_ENTIERE = 0.999;

/** La clé qui porte la part couverte par une fiche, quelle qu'elle soit. */
export const CLE_FICHE = "fiche";

const CLES_COUVERTURE: string[] = [...NUTRIMENTS, CLE_FICHE];

/**
 * Le plafond que les nutriments peuvent atteindre : la part du poids reliée à
 * une fiche.
 *
 * À défaut de la clé — une entrée écrite avant qu'elle existe — on retient la
 * meilleure couverture observée. Un nutriment ne peut pas dépasser la part
 * reliée : le maximum la reconstitue exactement dès qu'un seul nutriment est
 * renseigné partout, ce qui est le cas ordinaire. Retomber sur 100 % ferait
 * passer tous les trous pour des fiches muettes.
 */
export function plafondFiche(couverture: Couverture): number {
  const stocke = couverture[CLE_FICHE];
  if (stocke !== undefined) return stocke;
  return Math.max(...NUTRIMENTS.map((cle) => couverture[cle] ?? 1));
}

/** Tout ce qui n'atteint pas 100 %, quelle qu'en soit la cause. */
export function couvertureIncomplete(couverture: Couverture): NutrimentCle[] {
  return NUTRIMENTS.filter((cle) => (couverture[cle] ?? 1) < COUVERTURE_ENTIERE);
}

/**
 * Les nutriments dont le trou vient d'une fiche muette, et non d'un ingrédient
 * sans fiche.
 *
 * C'est le cas fréquent dans Ciqual — les fibres, certains minéraux — et le
 * seul que la mention « des fiches existent mais ne donnent pas ces valeurs »
 * décrive honnêtement. Le reste du trou est déjà dit par la liste des
 * ingrédients sans fiche, et le répéter ici accuserait les fiches d'un manque
 * qui n'est pas le leur.
 */
export function nutrimentsSansValeur(couverture: Couverture): NutrimentCle[] {
  const plafond = plafondFiche(couverture);
  return NUTRIMENTS.filter((cle) => (couverture[cle] ?? 1) < plafond - 0.001);
}
