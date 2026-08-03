import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { espaces, paquets, sourates, textesVersets, versets } from "@/db/schema";
import { creerNote } from "@/lib/cartes/edition";
import { chargerReglagesCoran } from "./donnees";
import { masquerLaFin, type FormatHifz } from "./formats";

/**
 * Mémorisation : le module Coran ne réinvente rien.
 *
 * Un verset « à mémoriser » devient une note du module cartes, rangée dans un
 * espace « Coran » et un paquet portant le nom de la sourate. Elle passe donc
 * par FSRS et par la file d'apprentissage comme n'importe quelle autre carte,
 * et le module Coran ne tient aucun état de mémorisation : il se contente de
 * lire les étiquettes `coran:<sourate>:<verset>` quand il veut compter.
 *
 * ── Sur le format à trous
 *
 * Le texte arabe n'est jamais réécrit. Le découpage se fait sur les blancs, en
 * conservant chaque séparateur tel quel, et les marques `{{c1::…}}` sont posées
 * *autour* d'une portion sans qu'aucun caractère du verset ne soit ajouté,
 * retiré ou normalisé — la concaténation des morceaux redonne le verset à
 * l'octet près. Ce sont les derniers mots qui sont masqués, mécaniquement :
 * décider quels mots seraient « clés » demanderait un jugement sur le sens, et
 * ce module n'en porte aucun. Le verso montre toujours le verset entier.
 */


/** Espace où atterrissent les cartes du Coran. Créé à la première demande. */
const NOM_ESPACE = "Coran";
const COULEUR_ESPACE = "#6fa396";

async function espaceCoran(): Promise<number> {
  const [existant] = await db
    .select({ id: espaces.id })
    .from(espaces)
    .where(eq(espaces.nom, NOM_ESPACE))
    .limit(1);
  if (existant) return existant.id;

  const [cree] = await db
    .insert(espaces)
    .values({ nom: NOM_ESPACE, couleur: COULEUR_ESPACE, ordre: 100 })
    .returning({ id: espaces.id });
  return cree.id;
}

async function paquetSourate(numero: number, nom: string): Promise<number> {
  const espaceId = await espaceCoran();
  const titre = `${numero}. ${nom}`;

  const [existant] = await db
    .select({ id: paquets.id })
    .from(paquets)
    .where(and(eq(paquets.espaceId, espaceId), eq(paquets.nom, titre)))
    .limit(1);
  if (existant) return existant.id;

  const [cree] = await db
    .insert(paquets)
    .values({ espaceId, parentId: null, nom: titre, ordre: numero })
    .returning({ id: paquets.id });
  return cree.id;
}


export type DemandeHifz = {
  versetNumero: number;
  format: FormatHifz;
};

export type ResultatHifz = {
  cartes: number;
  paquet: string;
  message: string;
};

export async function memoriserVerset(demande: DemandeHifz): Promise<ResultatHifz> {
  const [verset] = await db
    .select({
      numero: versets.numero,
      sourate: versets.sourate,
      numeroDansSourate: versets.numeroDansSourate,
      texte: versets.texte,
      nomSourate: sourates.nomTranslittere,
      versetsSourate: sourates.versets,
      premierVerset: sourates.premierVerset,
    })
    .from(versets)
    .innerJoin(sourates, eq(versets.sourate, sourates.numero))
    .where(eq(versets.numero, demande.versetNumero))
    .limit(1);

  if (!verset) throw new Error("Verset introuvable.");

  const reglages = await chargerReglagesCoran();
  const paquetId = await paquetSourate(verset.sourate, verset.nomSourate);
  const repere = `${verset.sourate}:${verset.numeroDansSourate}`;
  const tags = ["coran", `coran:${verset.sourate}:${verset.numeroDansSourate}`];

  if (demande.format === "traduction") {
    if (!reglages.traduction) {
      throw new Error(
        "Aucune traduction installée : ce format a besoin d'un texte au recto.",
      );
    }
    const [traduction] = await db
      .select({ texte: textesVersets.texte })
      .from(textesVersets)
      .where(
        and(
          eq(textesVersets.editionCle, reglages.traduction),
          eq(textesVersets.versetNumero, verset.numero),
        ),
      )
      .limit(1);

    if (!traduction) throw new Error("Ce verset n'a pas de traduction importée.");

    const { creees } = await creerNote({
      paquetId,
      recto: traduction.texte,
      verso: verset.texte,
      type: "recto_verso",
      notes: `Coran ${repere}`,
      tags,
    });
    return {
      cartes: creees,
      paquet: `${verset.sourate}. ${verset.nomSourate}`,
      message: `Carte créée depuis la traduction de ${repere}.`,
    };
  }

  if (demande.format === "enchainement") {
    const dernier = verset.premierVerset + verset.versetsSourate - 1;
    if (verset.numero >= dernier) {
      throw new Error(
        "Ce verset clôt sa sourate : il n'a pas de suivant à enchaîner.",
      );
    }
    const [suivant] = await db
      .select({ texte: versets.texte, numeroDansSourate: versets.numeroDansSourate })
      .from(versets)
      .where(eq(versets.numero, verset.numero + 1))
      .limit(1);
    if (!suivant) throw new Error("Le verset suivant n'est pas importé.");

    const { creees } = await creerNote({
      paquetId,
      recto: verset.texte,
      verso: suivant.texte,
      type: "recto_verso",
      notes: `Coran ${repere} → ${verset.sourate}:${suivant.numeroDansSourate}`,
      tags,
    });
    return {
      cartes: creees,
      paquet: `${verset.sourate}. ${verset.nomSourate}`,
      message: `Enchaînement ${repere} → ${verset.sourate}:${suivant.numeroDansSourate} créé.`,
    };
  }

  const { creees } = await creerNote({
    paquetId,
    recto: masquerLaFin(verset.texte),
    // Le verso porte le verset entier, verbatim.
    verso: verset.texte,
    type: "trous",
    notes: `Coran ${repere}`,
    tags,
  });

  return {
    cartes: creees,
    paquet: `${verset.sourate}. ${verset.nomSourate}`,
    message: `Carte à trous créée pour ${repere}.`,
  };
}

/** Les paquets du Coran, pour la page hifz. */
export async function paquetsCoran() {
  const [espace] = await db
    .select({ id: espaces.id })
    .from(espaces)
    .where(eq(espaces.nom, NOM_ESPACE))
    .limit(1);
  if (!espace) return [];

  return db
    .select({ id: paquets.id, nom: paquets.nom })
    .from(paquets)
    .where(eq(paquets.espaceId, espace.id))
    .orderBy(asc(paquets.ordre));
}

export { FORMATS, masquerLaFin, type FormatHifz } from "./formats";
