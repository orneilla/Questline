import { sql } from "drizzle-orm";

import { db } from "./index";
import { cuisineAliments } from "./cuisine";
import { aujourdhui } from "@/lib/dates";
import {
  lireCiqual,
  type AlimentLu,
  type DiagnosticCiqual,
} from "@/lib/cuisine/ciqual";

/**
 * Écriture du catalogue Ciqual.
 *
 * Dans `src/db` et non dans `src/lib` : comme les autres semeurs de catalogue,
 * ce module doit rester importable par un script en ligne de commande, ce que
 * la garde `server-only` interdirait. Rien ici n'est appelé depuis un composant
 * client — seules la route de dépôt et le script y touchent.
 *
 * Rejouable sans dommage : la clé (source, code_source) est unique, et un
 * second passage met à jour au lieu d'insérer. Relancer l'import après une
 * nouvelle édition Ciqual rafraîchit donc les teneurs sans créer de doublon,
 * et sans toucher aux aliments saisis à la main.
 */

export type BilanImport = {
  diagnostic: DiagnosticCiqual;
  ecrits: number;
  /** Aliments déjà présents dont les teneurs ont été rafraîchies. */
  misAJour: number;
  nouveaux: number;
};

/** Par lots : six mille aliments en une requête dépasseraient les limites. */
const LOT = 400;

export async function importerCiqual(contenu: string): Promise<BilanImport> {
  const { diagnostic, aliments } = lireCiqual(contenu);

  if (aliments.length === 0) {
    throw new Error("Le fichier a été lu, mais il ne contient aucun aliment.");
  }

  const avant = await compterCiqual();
  let ecrits = 0;

  for (let i = 0; i < aliments.length; i += LOT) {
    ecrits += await ecrireAliments(aliments.slice(i, i + LOT));
  }

  const apres = await compterCiqual();
  const nouveaux = apres - avant;

  return { diagnostic, ecrits, nouveaux, misAJour: ecrits - nouveaux };
}

/**
 * Écrit un lot d'aliments lus.
 *
 * Exposée séparément parce que le fichier Ciqual pèse des dizaines de
 * mégaoctets : depuis un navigateur, il est lu et découpé sur place, puis
 * envoyé par tranches. Un seul envoi dépasserait la limite de corps de
 * requête, et le script comme la page passent ainsi par le même chemin
 * d'écriture.
 */
export async function ecrireAliments(aliments: AlimentLu[]): Promise<number> {
  if (aliments.length === 0) return 0;
  const date = aujourdhui();

  await db
    .insert(cuisineAliments)
    .values(aliments.map((a) => ligne(a, date)))
    .onConflictDoUpdate({
      target: [cuisineAliments.source, cuisineAliments.codeSource],
      set: {
        nom: sql`excluded.nom`,
        categorie: sql`excluded.categorie`,
        kcal100g: sql`excluded.kcal_100g`,
        proteines100g: sql`excluded.proteines_100g`,
        glucides100g: sql`excluded.glucides_100g`,
        sucres100g: sql`excluded.sucres_100g`,
        lipides100g: sql`excluded.lipides_100g`,
        ags100g: sql`excluded.ags_100g`,
        fibres100g: sql`excluded.fibres_100g`,
        sel100g: sql`excluded.sel_100g`,
        etat: sql`excluded.etat`,
        dateVerification: sql`excluded.date_verification`,
      },
    });

  return aliments.length;
}

function ligne(aliment: AlimentLu, date: string) {
  return {
    nom: aliment.nom.slice(0, 300),
    categorie: aliment.categorie,
    kcal100g: aliment.valeurs.kcal100g ?? null,
    proteines100g: aliment.valeurs.proteines100g ?? null,
    glucides100g: aliment.valeurs.glucides100g ?? null,
    sucres100g: aliment.valeurs.sucres100g ?? null,
    lipides100g: aliment.valeurs.lipides100g ?? null,
    ags100g: aliment.valeurs.ags100g ?? null,
    fibres100g: aliment.valeurs.fibres100g ?? null,
    sel100g: aliment.valeurs.sel100g ?? null,
    etat: aliment.etat,
    source: "ciqual" as const,
    codeSource: aliment.code,
    dateVerification: date,
    densiteGParMl: null,
  };
}

export async function compterCiqual(): Promise<number> {
  const [ligne] = await db
    .select({ combien: sql<number>`count(*)::int` })
    .from(cuisineAliments)
    .where(sql`${cuisineAliments.source} = 'ciqual'`);
  return Number(ligne?.combien ?? 0);
}
