import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { cartes, espaces, paquets, sourates, textesVersets, versets } from "@/db/schema";
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

/**
 * Ce qu'une carte contiendra, avant qu'elle n'existe.
 *
 * La composition est séparée de l'écriture : le même code produit l'aperçu
 * qu'on regarde et la carte qu'on crée. Deux chemins distincts finiraient par
 * diverger, et l'aperçu mentirait le jour où ça compte.
 */
export type ApercuCarte = {
  recto: string;
  verso: string;
  type: "recto_verso" | "trous";
  notes: string;
  tags: string[];
  repere: string;
  paquetParDefaut: { id: number; nom: string };
  /** Une carte de ce verset et de ce format existe déjà. */
  doublon: boolean;
};

/** Étiquette du format, pour reconnaître un doublon sans deviner. */
function etiquetteFormat(format: FormatHifz): string {
  return `format:${format}`;
}

async function composer(demande: DemandeHifz): Promise<ApercuCarte> {
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
  const repere = `${verset.nomSourate} ${verset.sourate}:${verset.numeroDansSourate}`;
  const tags = [
    "coran",
    `coran:${verset.sourate}:${verset.numeroDansSourate}`,
    etiquetteFormat(demande.format),
  ];

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
  const commun = {
    repere,
    tags,
    paquetParDefaut: { id: paquetId, nom: `${verset.sourate}. ${verset.nomSourate}` },
    doublon: await existeDeja(verset.sourate, verset.numeroDansSourate, demande.format),
  };

  if (demande.format === "enchainement") {
    const dernier = verset.premierVerset + verset.versetsSourate - 1;
    if (verset.numero >= dernier) {
      throw new Error("Ce verset clôt sa sourate : il n'a pas de suivant à enchaîner.");
    }
    const [suivant] = await db
      .select({ texte: versets.texte, numeroDansSourate: versets.numeroDansSourate })
      .from(versets)
      .where(eq(versets.numero, verset.numero + 1))
      .limit(1);
    if (!suivant) throw new Error("Le verset suivant n'est pas importé.");

    // Chaque verset affiché porte son propre numéro : sans cela on ne sait pas
    // lequel on regarde ni lequel on doit produire.
    return {
      ...commun,
      recto: [
        `*${verset.sourate}:${verset.numeroDansSourate}*`,
        faceVerset,
        "**Récite le verset suivant.**",
      ].join("\n\n"),
      verso: [
        `*${verset.sourate}:${suivant.numeroDansSourate}*`,
        face(suivant.texte, await translittere(verset.numero + 1)),
      ].join("\n\n"),
      type: "recto_verso",
      notes: `${repere} → verset ${suivant.numeroDansSourate}`,
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

    // Le recto doit dire deux choses sans ambiguïté : ce qu'on doit produire,
    // et ce qu'on est en train de lire. Annoncer la référence du verset à
    // réciter au-dessus du texte du *précédent* faisait croire que le texte
    // affiché était celui de la référence.
    const amorce = precedent
      ? [
          `*verset précédent — ${verset.sourate}:${precedent.numeroDansSourate}*`,
          face(precedent.texte, await translittere(verset.numero - 1)),
        ].join("\n\n")
      : "*Début de la sourate — rien avant.*";

    return {
      ...commun,
      recto: `**Réciter ${repere}**\n\n${amorce}`,
      verso: faceVerset,
      type: "recto_verso",
      notes: `${repere} — à réciter`,
    };
  }

  // Le texte à trous porte les marques sur l'arabe ; la translittération suit,
  // entière, pour qu'on puisse toujours lire ce qu'on cherche à retrouver.
  return {
    ...commun,
    recto: face(masquerLaFin(verset.texte), await translittere(verset.numero)),
    // Le verso porte le verset entier, verbatim.
    verso: faceVerset,
    type: "trous",
    notes: repere,
  };
}

/**
 * Une carte de ce verset et de ce format existe-t-elle déjà ?
 *
 * La question se pose sur les étiquettes, pas sur le contenu : deux cartes du
 * même verset et du même format sont un doublon même si un réglage
 * d'affichage a changé le texte entre-temps.
 */
async function existeDeja(
  sourate: number,
  versetDansSourate: number,
  format: FormatHifz,
): Promise<boolean> {
  const [ligne] = await db
    .select({ id: cartes.id })
    .from(cartes)
    .where(
      and(
        sql`${cartes.tags} @> ARRAY[${`coran:${sourate}:${versetDansSourate}`}]::text[]`,
        sql`${cartes.tags} @> ARRAY[${etiquetteFormat(format)}]::text[]`,
      ),
    )
    .limit(1);
  return Boolean(ligne);
}

/** L'aperçu d'une carte, sans rien écrire. */
export async function apercuCarte(demande: DemandeHifz): Promise<ApercuCarte> {
  return composer(demande);
}

/** Les paquets où une carte du Coran peut atterrir. */
export async function paquetsDisponibles(): Promise<{ id: number; nom: string }[]> {
  const espaceId = await espaceCoran();
  return db
    .select({ id: paquets.id, nom: paquets.nom })
    .from(paquets)
    .where(eq(paquets.espaceId, espaceId))
    .orderBy(asc(paquets.ordre), asc(paquets.id));
}

/** Crée la carte, une fois l'aperçu confirmé. */
export async function memoriserVerset(
  demande: DemandeHifz & { paquetId?: number },
): Promise<ResultatHifz> {
  const apercu = await composer(demande);
  const paquetId = demande.paquetId ?? apercu.paquetParDefaut.id;

  const [paquet] = await db
    .select({ nom: paquets.nom })
    .from(paquets)
    .where(eq(paquets.id, paquetId))
    .limit(1);
  const nomPaquet = paquet?.nom ?? apercu.paquetParDefaut.nom;

  const { creees } = await creerNote({
    paquetId,
    recto: apercu.recto,
    verso: apercu.verso,
    type: apercu.type,
    notes: apercu.notes,
    tags: apercu.tags,
  });

  return {
    cartes: creees,
    paquet: nomPaquet,
    message: `Carte ajoutée au paquet ${nomPaquet}.`,
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
 * La carte est complète des deux côtés. Au recto, le mot arabe et sa
 * translittération : c'est cette dernière qui se lit quand on ne lit pas l'arabe
 * couramment, et elle n'est pas une note de bas de page. Au verso, le sens
 * français d'abord, puis la racine, puis le reste de l'analyse. En note de bas
 * de carte, le verset d'où le mot est tiré — un mot appris hors de sa phrase
 * s'oublie, et le contexte n'a pas à occuper la place de la réponse.
 *
 * Rien de tout cela n'est fabriqué ici : le sens vient d'une ressource déposée,
 * la racine du corpus, l'arabe et le verset du texte de Tanzil, la
 * translittération de son édition — et seulement quand son découpage tombe sur
 * le même compte de mots. Une carte peut donc n'avoir pas de sens au verso : la
 * ligne manque, elle n'est pas inventée.
 *
 * Les étiquettes `racine:<racine>` permettent ensuite de savoir quelle racine
 * est déjà travaillée sans que le module Coran tienne le moindre état.
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

  const repere = `${verset.nomSourate} ${verset.sourate}:${verset.numeroDansSourate}`;
  const nomPaquet =
    parRacine && analyse.racine
      ? `Racine ${analyse.racine}`
      : `${verset.sourate}. ${verset.nomSourate}`;

  const paquetId = await paquetVocabulaire(
    nomPaquet,
    parRacine ? 500 : verset.sourate,
  );

  // Le verso s'ouvre sur ce qu'on cherche à retrouver — le sens, puis la
  // racine. L'analyse détaillée vient après, en second plan.
  const details = [
    analyse.sens ? `**${analyse.sens}**` : null,
    analyse.racine ? `Racine : ${analyse.racine}` : null,
    analyse.lemme ? `Lemme : ${analyse.lemme}` : null,
    analyse.grammaire ? `Grammaire : ${analyse.grammaire}` : null,
    analyse.segments.length > 1 ? `Découpage : ${analyse.segments.join(" ‑ ")}` : null,
    analyse.racine
      ? `${analyse.frequenceRacine} occurrence${analyse.frequenceRacine > 1 ? "s" : ""} de la racine`
      : null,
  ].filter((l): l is string => l !== null);

  if (details.length === 0) {
    throw new Error(
      "Ce mot n'a ni sens ni analyse en base : la carte n'aurait rien au verso. " +
        "Installe l'analyse mot à mot, ou dépose une traduction mot à mot.",
    );
  }

  const tags = ["coran", "vocabulaire", `coran:${repere}`];
  if (analyse.racine) tags.push(`racine:${analyse.racine}`);

  const { creees } = await creerNote({
    paquetId,
    // Le recto porte le mot tel qu'il est dans le verset, et sa translittération.
    recto: face(analyse.arabe, analyse.translitteration),
    verso: details.join("\n\n"),
    type: "recto_verso",
    // Le verset d'origine tient en note de bas de carte : il donne le contexte
    // sans se mettre à la place de la réponse.
    notes: `${verset.texte}\n\n${repere}, mot ${position}`,
    tags,
  });

  return {
    cartes: creees,
    paquet: nomPaquet,
    message: `« ${analyse.arabe} » ajouté au vocabulaire.`,
  };
}
