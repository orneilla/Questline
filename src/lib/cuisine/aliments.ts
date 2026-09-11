import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { cuisineAliments } from "@/db/cuisine";
import { aujourdhui } from "@/lib/dates";
import { categorieValide, CATEGORIE_PAR_DEFAUT } from "./categories";

/**
 * Les aliments saisis à la main, depuis un emballage.
 *
 * ── Pourquoi ils existent
 *
 * Le catalogue venait entièrement de la table Ciqual : des produits bruts, une
 * pomme, de la farine, du blanc de poulet. Une barre chocolatée achetée en
 * boulangerie n'y est pas et n'y sera jamais — ce n'est pas le rôle de cette
 * table. Sans saisie manuelle, ces produits-là n'avaient aucune façon d'être
 * notés, et le journal devenait faux par omission plutôt que par erreur.
 *
 * ── Ce qui est recopié, et ce qui ne l'est pas
 *
 * Uniquement ce qui est imprimé sur l'emballage. Rien n'est deviné, rien n'est
 * complété par ressemblance avec un produit voisin, rien n'est calculé à partir
 * d'un autre chiffre. Une valeur absente reste nulle : un zéro serait un
 * mensonge, et la couverture par nutriment du journal sait déjà dire qu'une
 * valeur manque.
 *
 * ── La fiabilité, qui doit se voir
 *
 * Ces lignes portent `source = "manuel"`. C'est la source la moins sûre des
 * trois — elle dépend d'une recopie — et les écrans le disent. Ce n'est pas une
 * réserve de principe : un chiffre mal recopié se propage ensuite dans chaque
 * repas noté.
 */

export type ChampsAlimentManuel = {
  nom: string;
  marque: string;
  categorie: string;
  /** Par 100 g. Chaîne vide ou absente = valeur non imprimée sur l'emballage. */
  kcal100g: number | null;
  proteines100g: number | null;
  glucides100g: number | null;
  sucres100g: number | null;
  lipides100g: number | null;
  ags100g: number | null;
  fibres100g: number | null;
  sel100g: number | null;
  /** Poids d'une portion, si l'emballage le donne. */
  poidsPortionG: number | null;
  nomPortion: string;
};

export type AlimentManuel = {
  id: number;
  nom: string;
  marque: string;
  categorie: string;
  kcal100g: number | null;
  proteines100g: number | null;
  glucides100g: number | null;
  sucres100g: number | null;
  lipides100g: number | null;
  ags100g: number | null;
  fibres100g: number | null;
  sel100g: number | null;
  poidsPortionG: number | null;
  nomPortion: string;
  dateVerification: string;
};

/** Au-delà, ce n'est plus une valeur pour 100 g mais une faute de frappe. */
const PLAFONDS: Record<string, number> = {
  kcal100g: 1000,
  proteines100g: 100,
  glucides100g: 100,
  sucres100g: 100,
  lipides100g: 100,
  ags100g: 100,
  fibres100g: 100,
  sel100g: 100,
};

export type Anomalie = { champ: string; message: string };

/**
 * Ce qui ne tient pas debout dans une saisie.
 *
 * Rendu comme une liste de remarques, pas comme un refus : c'est un contrôle de
 * recopie, et la seule chose qu'il sait vraiment, c'est qu'un chiffre dépasse
 * ce qu'un aliment peut contenir. Les incohérences plus fines — des sucres
 * au-dessus des glucides — sont signalées mais n'empêchent rien : certains
 * emballages arrondissent de telle façon que ça arrive pour de vrai.
 */
export function verifier(champs: ChampsAlimentManuel): Anomalie[] {
  const anomalies: Anomalie[] = [];

  if (champs.nom.trim().length === 0) {
    anomalies.push({ champ: "nom", message: "Il faut un nom." });
  }

  for (const [cle, plafond] of Object.entries(PLAFONDS)) {
    const valeur = champs[cle as keyof ChampsAlimentManuel];
    if (typeof valeur !== "number") continue;
    if (valeur < 0) {
      anomalies.push({ champ: cle, message: "Une valeur négative n'existe pas." });
    } else if (valeur > plafond) {
      anomalies.push({
        champ: cle,
        message: `Au-dessus de ${plafond} pour 100 g : vérifie la recopie.`,
      });
    }
  }

  const { sucres100g, glucides100g, ags100g, lipides100g } = champs;
  if (sucres100g !== null && glucides100g !== null && sucres100g > glucides100g + 0.5) {
    anomalies.push({
      champ: "sucres100g",
      message: "Les sucres dépassent les glucides. C'est possible avec des arrondis, mais rare.",
    });
  }
  if (ags100g !== null && lipides100g !== null && ags100g > lipides100g + 0.5) {
    anomalies.push({
      champ: "ags100g",
      message: "Les acides gras saturés dépassent les lipides. À revérifier.",
    });
  }

  if (
    champs.poidsPortionG !== null &&
    (champs.poidsPortionG <= 0 || champs.poidsPortionG > 5000)
  ) {
    anomalies.push({ champ: "poidsPortionG", message: "Poids de portion invraisemblable." });
  }

  return anomalies;
}

/** Ne garde que ce qui bloque réellement l'enregistrement. */
export function bloquantes(anomalies: Anomalie[]): Anomalie[] {
  return anomalies.filter(
    (a) => a.champ === "nom" || a.message.includes("négative") || a.message.includes("invraisemblable"),
  );
}

function propre(champs: ChampsAlimentManuel) {
  return {
    nom: champs.nom.trim().slice(0, 120),
    marque: champs.marque.trim().slice(0, 60),
    categorie: categorieValide(champs.categorie) ? champs.categorie : CATEGORIE_PAR_DEFAUT,
    kcal100g: champs.kcal100g,
    proteines100g: champs.proteines100g,
    glucides100g: champs.glucides100g,
    sucres100g: champs.sucres100g,
    lipides100g: champs.lipides100g,
    ags100g: champs.ags100g,
    fibres100g: champs.fibres100g,
    sel100g: champs.sel100g,
    poidsPortionG: champs.poidsPortionG,
    nomPortion: champs.nomPortion.trim().slice(0, 24),
  };
}

export async function creerAlimentManuel(
  champs: ChampsAlimentManuel,
): Promise<{ id: number } | null> {
  if (bloquantes(verifier(champs)).length > 0) return null;

  const [cree] = await db
    .insert(cuisineAliments)
    .values({
      ...propre(champs),
      // Un produit emballé est vendu prêt : le distinguer cru/cuit n'a pas de
      // sens, et « cru » est le défaut du schéma.
      etat: "cru",
      source: "manuel",
      codeSource: null,
      dateVerification: aujourdhui(),
    })
    .returning({ id: cuisineAliments.id });

  return cree ? { id: cree.id } : null;
}

/** Ne touche qu'un aliment saisi à la main : le catalogue Ciqual est en lecture. */
export async function modifierAlimentManuel(
  id: number,
  champs: ChampsAlimentManuel,
): Promise<boolean> {
  if (bloquantes(verifier(champs)).length > 0) return false;

  const modifies = await db
    .update(cuisineAliments)
    .set({ ...propre(champs), dateVerification: aujourdhui() })
    .where(and(eq(cuisineAliments.id, id), eq(cuisineAliments.source, "manuel")))
    .returning({ id: cuisineAliments.id });

  return modifies.length > 0;
}

/**
 * Supprime un aliment saisi à la main.
 *
 * Sans danger pour l'historique : les entrées du journal portent leur propre
 * instantané — le nom et les valeurs figés au moment où le repas a été noté —
 * et les références retombent simplement à nul. Un repas déjà noté reste donc
 * lisible et calculable après la suppression de l'aliment qui l'a servi.
 */
export async function supprimerAlimentManuel(id: number): Promise<boolean> {
  const partis = await db
    .delete(cuisineAliments)
    .where(and(eq(cuisineAliments.id, id), eq(cuisineAliments.source, "manuel")))
    .returning({ id: cuisineAliments.id });

  return partis.length > 0;
}

export async function listerAlimentsManuels(): Promise<AlimentManuel[]> {
  try {
    return await db
      .select({
        id: cuisineAliments.id,
        nom: cuisineAliments.nom,
        marque: cuisineAliments.marque,
        categorie: cuisineAliments.categorie,
        kcal100g: cuisineAliments.kcal100g,
        proteines100g: cuisineAliments.proteines100g,
        glucides100g: cuisineAliments.glucides100g,
        sucres100g: cuisineAliments.sucres100g,
        lipides100g: cuisineAliments.lipides100g,
        ags100g: cuisineAliments.ags100g,
        fibres100g: cuisineAliments.fibres100g,
        sel100g: cuisineAliments.sel100g,
        poidsPortionG: cuisineAliments.poidsPortionG,
        nomPortion: cuisineAliments.nomPortion,
        dateVerification: cuisineAliments.dateVerification,
      })
      .from(cuisineAliments)
      .where(eq(cuisineAliments.source, "manuel"))
      .orderBy(asc(sql`lower(${cuisineAliments.nom})`));
  } catch {
    return [];
  }
}

/** Combien de produits emballés sont déjà saisis. */
export async function compterAlimentsManuels(): Promise<number> {
  try {
    const [ligne] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(cuisineAliments)
      .where(eq(cuisineAliments.source, "manuel"));
    return Number(ligne?.n ?? 0);
  } catch {
    return 0;
  }
}
