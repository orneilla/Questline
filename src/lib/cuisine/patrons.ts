import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { cuisinePatrons, type Patron } from "@/db/cuisine";
import { CATEGORIES, categorieValide } from "./categories";
import { cuissonValide } from "./nutrition";
import { convient } from "./moteur";
import { chargerInventaireDispo } from "./suggestions";

/**
 * Les patrons de plat — lecture et écriture.
 *
 * Un patron est une structure de repas : « un féculent, une protéine, un
 * légume, à la poêle, sans fromage ». Il ne nomme aucun aliment ; c'est
 * l'inventaire qui remplit ses places. Huit sont posés à l'installation, mais
 * ils décrivent une cuisine générique — celle de personne. Ils doivent donc se
 * modifier depuis l'application, pas depuis la base.
 *
 * Ce module reste dans le module Cuisine : aucune table extérieure n'est lue
 * ni écrite.
 */

/** Le patron, plus ce que l'inventaire d'aujourd'hui en dit. */
export type EtatPatron = {
  patron: Patron;
  /** Ses catégories qu'aucun article disponible ne pourvoit : il ne tient pas. */
  categoriesVides: string[];
  /** Articles de ses catégories écartés par une exclusion. */
  nbEcartes: number;
};

/**
 * Charge les patrons et les confronte au placard.
 *
 * Le même `convient` que le moteur, appelé sur les mêmes données : ce que cet
 * écran annonce est donc exactement ce que les suggestions feront. Un
 * diagnostic calculé autrement finirait par diverger, et par mentir.
 */
export async function chargerEtatPatrons(): Promise<EtatPatron[]> {
  const [lignes, inventaire] = await Promise.all([
    db.select().from(cuisinePatrons).orderBy(asc(cuisinePatrons.ordre), asc(cuisinePatrons.id)),
    chargerInventaireDispo(),
  ]);

  const connues = CATEGORIES.map((c) => c.cle);

  return lignes.map((patron) => {
    const categoriesVides: string[] = [];
    let nbEcartes = 0;

    for (const categorie of patron.categories) {
      const memeCategorie = inventaire.filter(
        (a) => a.disponible && a.categorie === categorie,
      );
      const retenus = memeCategorie.filter((a) =>
        convient(a, categorie, patron.exclut, connues),
      );
      if (retenus.length === 0) categoriesVides.push(categorie);
      nbEcartes += memeCategorie.length - retenus.length;
    }

    return { patron, categoriesVides, nbEcartes };
  });
}

/* ────────────────────── Écriture ────────────────────── */

export type ChampsPatron = {
  nom: string;
  categories: string[];
  profil: string;
  modeCuisson: string;
  exclut: string[];
};

/**
 * Met les champs en état d'être écrits, ou rend null si le patron ne tient pas.
 *
 * Les doublons de catégorie sautent : deux places « légume » ne produiraient
 * pas deux légumes différents mais deux fois le même article, le moteur
 * choisissant par rang dans une liste identique.
 */
function nettoyer(champs: ChampsPatron): ChampsPatron | null {
  const nom = champs.nom.trim();
  if (nom.length === 0) return null;

  const categories = [...new Set(champs.categories)].filter(categorieValide);
  if (categories.length === 0) return null;

  if (!cuissonValide(champs.modeCuisson)) return null;

  const exclut = [
    ...new Set(champs.exclut.map((mot) => mot.trim()).filter((mot) => mot.length > 0)),
  ];

  return {
    nom: nom.slice(0, 60),
    categories,
    profil: champs.profil.trim().slice(0, 40),
    modeCuisson: champs.modeCuisson,
    exclut: exclut.map((mot) => mot.slice(0, 40)),
  };
}

export async function creerPatron(champs: ChampsPatron): Promise<number | null> {
  const propre = nettoyer(champs);
  if (!propre) return null;

  const [dernier] = await db
    .select({ max: sql<number | null>`max(${cuisinePatrons.ordre})` })
    .from(cuisinePatrons);

  const [cree] = await db
    .insert(cuisinePatrons)
    .values({ ...propre, ordre: (dernier?.max ?? 0) + 1 })
    .returning({ id: cuisinePatrons.id });

  return cree?.id ?? null;
}

export async function modifierPatron(id: number, champs: ChampsPatron): Promise<boolean> {
  const propre = nettoyer(champs);
  if (!propre) return false;

  const modifies = await db
    .update(cuisinePatrons)
    .set(propre)
    .where(eq(cuisinePatrons.id, id))
    .returning({ id: cuisinePatrons.id });

  return modifies.length > 0;
}

/** Mettre un patron en sommeil plutôt que le supprimer : c'est réversible. */
export async function basculerPatron(id: number, actif: boolean): Promise<void> {
  await db.update(cuisinePatrons).set({ actif }).where(eq(cuisinePatrons.id, id));
}

export async function reordonnerPatrons(ids: number[]): Promise<void> {
  for (const [rang, id] of ids.entries()) {
    await db
      .update(cuisinePatrons)
      .set({ ordre: rang + 1 })
      .where(eq(cuisinePatrons.id, id));
  }
}

/**
 * Supprime un patron.
 *
 * Rien ne dépend de lui : les recettes qu'il a servi à créer sont autonomes
 * depuis leur conversion, et le journal des suggestions ne garde qu'un texte.
 * La suppression est donc sans conséquence ailleurs — mais sans retour non
 * plus, d'où la confirmation à l'écran.
 */
export async function supprimerPatron(id: number): Promise<boolean> {
  const partis = await db
    .delete(cuisinePatrons)
    .where(eq(cuisinePatrons.id, id))
    .returning({ id: cuisinePatrons.id });

  return partis.length > 0;
}
