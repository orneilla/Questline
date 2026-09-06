import type { NutrimentCle } from "./ciqual";
import type { RoleIngredient, SourceAliment } from "@/db/cuisine";

/**
 * Calcul nutritionnel — logique pure, sans base ni réseau.
 *
 * Deux règles gouvernent ce fichier.
 *
 * La première : tout est en poids cru. Les grammages saisis sont crus, les
 * fiches retenues sont crues, et la somme l'est aussi. Additionner 100 g de riz
 * cru et 100 g de riz cuit donnerait un chiffre parfaitement faux qui ne se
 * verrait jamais.
 *
 * La seconde : ce qui manque se dit. Un ingrédient sans fiche, ou une fiche
 * sans valeur pour un nutriment, ne compte pas comme zéro — il rend le total
 * incomplet, et le total le déclare. Un compteur qui arrondit ses trous vers
 * le bas ment doucement, tous les jours.
 */

export const NUTRIMENTS: NutrimentCle[] = [
  "kcal100g",
  "proteines100g",
  "glucides100g",
  "sucres100g",
  "lipides100g",
  "ags100g",
  "fibres100g",
  "sel100g",
];

export const LIBELLES: Record<NutrimentCle, string> = {
  kcal100g: "Énergie",
  proteines100g: "Protéines",
  glucides100g: "Glucides",
  sucres100g: "dont sucres",
  lipides100g: "Lipides",
  ags100g: "dont saturés",
  fibres100g: "Fibres",
  sel100g: "Sel",
};

export const UNITES: Record<NutrimentCle, string> = {
  kcal100g: "kcal",
  proteines100g: "g",
  glucides100g: "g",
  sucres100g: "g",
  lipides100g: "g",
  ags100g: "g",
  fibres100g: "g",
  sel100g: "g",
};

/** Ce qu'il faut d'un aliment pour calculer : ses teneurs, et d'où elles viennent. */
export type FicheAliment = {
  id: number;
  nom: string;
  etat: "cru" | "cuit";
  source: SourceAliment;
  valeurs: Partial<Record<NutrimentCle, number | null>>;
};

export type IngredientCalcul = {
  id: number;
  nomLibre: string;
  quantiteG: number;
  role: RoleIngredient;
  categorieSubstitution: string | null;
  /** Absente quand l'ingrédient n'est relié à aucune fiche. */
  fiche: FicheAliment | null;
};

export type Totaux = Partial<Record<NutrimentCle, number>>;

export type BilanNutrition = {
  /** Pour la recette entière, en poids cru. */
  total: Totaux;
  /** Le même, divisé par le nombre de portions. */
  parPortion: Totaux;
  poidsCruTotalG: number;
  /** Ingrédients sans fiche : leur poids ne compte dans aucun nutriment. */
  sansFiche: string[];
  /** Nutriments qu'au moins un ingrédient reliés ne renseigne pas. */
  incomplets: NutrimentCle[];
  /** Fiches en `manuel` : à signaler, elles ne sont vérifiées par personne. */
  aVerifier: string[];
  /** Vrai si une fiche cuite s'est glissée dans un calcul en cru. */
  melangeCruCuit: boolean;
};

/**
 * Somme les ingrédients.
 *
 * La part d'un ingrédient vaut `teneur pour 100 g × quantité ÷ 100`. Un
 * ingrédient sans fiche est ignoré du calcul mais nommé dans `sansFiche` : son
 * poids ne peut pas être converti, et l'inventer serait pire que l'admettre.
 */
export function calculer(
  ingredients: IngredientCalcul[],
  nbPortions: number,
): BilanNutrition {
  const total: Totaux = {};
  const incomplets = new Set<NutrimentCle>();
  const sansFiche: string[] = [];
  const aVerifier: string[] = [];
  let poidsCruTotalG = 0;
  let melangeCruCuit = false;

  for (const ingredient of ingredients) {
    poidsCruTotalG += ingredient.quantiteG;

    if (!ingredient.fiche) {
      if (ingredient.quantiteG > 0) sansFiche.push(ingredient.nomLibre);
      continue;
    }
    if (ingredient.fiche.etat === "cuit") melangeCruCuit = true;
    if (ingredient.fiche.source === "manuel") aVerifier.push(ingredient.fiche.nom);

    const facteur = ingredient.quantiteG / 100;
    for (const cle of NUTRIMENTS) {
      const pour100 = ingredient.fiche.valeurs[cle];
      if (pour100 === null || pour100 === undefined) {
        if (ingredient.quantiteG > 0) incomplets.add(cle);
        continue;
      }
      total[cle] = (total[cle] ?? 0) + pour100 * facteur;
    }
  }

  const portions = Math.max(1, nbPortions);
  const parPortion: Totaux = {};
  for (const cle of NUTRIMENTS) {
    if (total[cle] !== undefined) parPortion[cle] = total[cle]! / portions;
  }

  return {
    total,
    parPortion,
    poidsCruTotalG,
    sansFiche,
    incomplets: NUTRIMENTS.filter((c) => incomplets.has(c)),
    aVerifier: [...new Set(aVerifier)],
    melangeCruCuit,
  };
}

/**
 * Ce que vaut une assiette réellement pesée.
 *
 * Le plat perd ou prend du poids à la cuisson : le riz gonfle, la viande rend
 * de l'eau. Une portion « théorique » — le total divisé par le nombre de parts
 * — ne dit donc rien de ce qu'il y a dans l'assiette. Quand le plat fini a été
 * pesé une fois, le rapport entre l'assiette et ce poids total donne la part
 * réelle, et le calcul redevient juste.
 *
 * Rend `null` quand le poids total cuit est inconnu : il n'y a alors aucun
 * ratio à appliquer, et deviner reviendrait à inventer.
 */
export function portionPesee(
  total: Totaux,
  poidsTotalCuitG: number | null,
  poidsAssietteG: number,
): { part: number; valeurs: Totaux } | null {
  if (!poidsTotalCuitG || poidsTotalCuitG <= 0) return null;
  if (!Number.isFinite(poidsAssietteG) || poidsAssietteG <= 0) return null;

  const part = poidsAssietteG / poidsTotalCuitG;
  const valeurs: Totaux = {};
  for (const cle of NUTRIMENTS) {
    if (total[cle] !== undefined) valeurs[cle] = total[cle]! * part;
  }
  return { part, valeurs };
}

/** Un nutriment affiché : jamais plus de précision que la donnée n'en a. */
export function formater(cle: NutrimentCle, valeur: number | undefined): string {
  if (valeur === undefined) return "—";
  if (cle === "kcal100g") return `${Math.round(valeur)} kcal`;
  if (valeur < 10) return `${valeur.toFixed(1).replace(".", ",")} g`;
  return `${Math.round(valeur)} g`;
}

/* ─────────────────────────── Modes de cuisson ─────────────────────────── */

/**
 * Les modes retenus. Texte en base plutôt qu'énuméré : la phase 3 croisera
 * ces valeurs avec des patrons de plat, et en ajouter un ne doit pas demander
 * de migration.
 */
export const MODES_CUISSON: { cle: string; nom: string }[] = [
  { cle: "poele", nom: "Poêle" },
  { cle: "four", nom: "Four" },
  { cle: "vapeur", nom: "Vapeur" },
  { cle: "bouilli", nom: "Eau bouillante" },
  { cle: "mijote", nom: "Mijoté" },
  { cle: "grill", nom: "Gril" },
  { cle: "friture", nom: "Friture" },
  { cle: "cru", nom: "Sans cuisson" },
];

export function nomCuisson(cle: string): string {
  return MODES_CUISSON.find((m) => m.cle === cle)?.nom ?? "Poêle";
}

export function cuissonValide(cle: string): boolean {
  return MODES_CUISSON.some((m) => m.cle === cle);
}

/* ─────────────────────────── Rôles ─────────────────────────── */

export const LIBELLES_ROLE: Record<RoleIngredient, string> = {
  essentiel: "Essentiel",
  optionnel: "Optionnel",
  substituable: "Substituable",
};

export const AIDES_ROLE: Record<RoleIngredient, string> = {
  essentiel: "Sans lui, la recette n'est pas proposée.",
  optionnel: "S'il manque, la recette reste proposée.",
  substituable: "Remplaçable par autre chose de sa catégorie.",
};
