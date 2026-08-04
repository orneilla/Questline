import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { espaces, paquets, sourates, textesVersets, versets } from "@/db/schema";
import { creerNote } from "@/lib/cartes/edition";
import { analyserMot, chargerReglagesCoran } from "./donnees";
import { face, masquerLaFin, type FormatHifz } from "./formats";

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

  // Toutes les faces portent l'arabe et sa translittération : c'est cette
  // dernière qui se lit quand on ne lit pas l'arabe couramment.
  const translittere = async (numero: number): Promise<string | null> => {
    if (!reglages.translitteration) return null;
    const [ligne] = await db
      .select({ texte: textesVersets.texte })
      .from(textesVersets)
      .where(
        and(
          eq(textesVersets.editionCle, reglages.translitteration),
          eq(textesVersets.versetNumero, numero),
        ),
      )
      .limit(1);
    return ligne?.texte ?? null;
  };

  const faceVerset = face(verset.texte, await translittere(verset.numero));

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
      recto: faceVerset,
      verso: face(suivant.texte, await translittere(verset.numero + 1)),
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

  if (demande.format === "reciter") {
    const [precedent] =
      verset.numero > verset.premierVerset
        ? await db
            .select({
              texte: versets.texte,
              numeroDansSourate: versets.numeroDansSourate,
            })
            .from(versets)
            .where(eq(versets.numero, verset.numero - 1))
            .limit(1)
        : [];

    const amorce = precedent
      ? face(precedent.texte, await translittere(verset.numero - 1))
      : "Début de la sourate.";

    const { creees } = await creerNote({
      paquetId,
      recto: `**${verset.nomSourate} ${repere}**\n\n${amorce}`,
      verso: faceVerset,
      type: "recto_verso",
      notes: `Coran ${repere} — à réciter`,
      tags,
    });
    return {
      cartes: creees,
      paquet: `${verset.sourate}. ${verset.nomSourate}`,
      message: `Carte de récitation créée pour ${repere}.`,
    };
  }

  // Le texte à trous porte les marques sur l'arabe ; la translittération suit,
  // entière, pour qu'on puisse toujours lire ce qu'on cherche à retrouver.
  const { creees } = await creerNote({
    paquetId,
    recto: face(masquerLaFin(verset.texte), await translittere(verset.numero)),
    // Le verso porte le verset entier, verbatim.
    verso: faceVerset,
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

/* ─────────────────────── Vocabulaire arabe ─────────────────────── */

const NOM_ESPACE_ARABE = "Arabe coranique";

async function espaceArabe(): Promise<number> {
  const [existant] = await db
    .select({ id: espaces.id })
    .from(espaces)
    .where(eq(espaces.nom, NOM_ESPACE_ARABE))
    .limit(1);
  if (existant) return existant.id;

  const [cree] = await db
    .insert(espaces)
    .values({ nom: NOM_ESPACE_ARABE, couleur: "#c0996a", ordre: 101 })
    .returning({ id: espaces.id });
  return cree.id;
}

async function paquetVocabulaire(nom: string, ordre: number): Promise<number> {
  const espaceId = await espaceArabe();
  const [existant] = await db
    .select({ id: paquets.id })
    .from(paquets)
    .where(and(eq(paquets.espaceId, espaceId), eq(paquets.nom, nom)))
    .limit(1);
  if (existant) return existant.id;

  const [cree] = await db
    .insert(paquets)
    .values({ espaceId, parentId: null, nom, ordre })
    .returning({ id: paquets.id });
  return cree.id;
}

/**
 * Range un mot dans le vocabulaire.
 *
 * La carte porte le mot au recto ; au verso, sa racine, son analyse et le
 * verset d'où il vient, qui sert de contexte — un mot appris hors de sa phrase
 * s'oublie. Les étiquettes `racine:<racine>` permettent ensuite de savoir quelle
 * racine est déjà travaillée sans que le module Coran tienne le moindre état.
 */
export async function apprendreMotDuCoran(
  versetNumero: number,
  position: number,
  parRacine: boolean,
): Promise<ResultatHifz> {
  const analyse = await analyserMot(versetNumero, position);
  if (!analyse) throw new Error("Ce mot n'a pas d'analyse importée.");

  const [verset] = await db
    .select({
      texte: versets.texte,
      sourate: versets.sourate,
      numeroDansSourate: versets.numeroDansSourate,
      nomSourate: sourates.nomTranslittere,
    })
    .from(versets)
    .innerJoin(sourates, eq(versets.sourate, sourates.numero))
    .where(eq(versets.numero, versetNumero))
    .limit(1);
  if (!verset) throw new Error("Verset introuvable.");

  const repere = `${verset.sourate}:${verset.numeroDansSourate}`;
  const nomPaquet =
    parRacine && analyse.racine
      ? `Racine ${analyse.racine}`
      : `${verset.sourate}. ${verset.nomSourate}`;

  const paquetId = await paquetVocabulaire(
    nomPaquet,
    parRacine ? 500 : verset.sourate,
  );

  const details = [
    analyse.racine ? `Racine : ${analyse.racine}` : null,
    analyse.lemme ? `Lemme : ${analyse.lemme}` : null,
    analyse.categorie ? `Grammaire : ${analyse.categorie}` : null,
    analyse.sens ? `Sens : ${analyse.sens}` : null,
    analyse.racine
      ? `${analyse.frequenceRacine} occurrence${analyse.frequenceRacine > 1 ? "s" : ""} de la racine`
      : null,
  ].filter((l): l is string => l !== null);

  const tags = ["coran", "vocabulaire", `coran:${repere}`];
  if (analyse.racine) tags.push(`racine:${analyse.racine}`);

  const { creees } = await creerNote({
    paquetId,
    recto: analyse.buckwalter
      ? `${analyse.arabe}\n\n*${analyse.buckwalter}*`
      : analyse.arabe,
    verso: `${details.join("\n\n")}\n\n---\n\n${verset.texte}`,
    type: "recto_verso",
    notes: `Coran ${repere}, mot ${position}`,
    tags,
  });

  return {
    cartes: creees,
    paquet: nomPaquet,
    message: `« ${analyse.arabe} » ajouté au vocabulaire.`,
  };
}
