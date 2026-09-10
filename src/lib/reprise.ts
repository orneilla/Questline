import "server-only";

import { count, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  arcs,
  cartes,
  espaces,
  evenements,
  journees,
  marquePages,
  medias,
  messagesEnvoyes,
  momentum,
  paquets,
  positionLecture,
  positionsSourate,
  quetes,
  quetesRaresFaites,
  revisions,
  saisons,
  seancesLecture,
  sessionsRevision,
  seuilsArcs,
  taches,
  validations,
} from "@/db/schema";
import {
  cuisineCourses,
  cuisineInventaire,
  cuisineJournal,
  cuisineRecetteIngredients,
  cuisineRecettes,
  cuisinePatrons,
  cuisineSuggestions,
} from "@/db/cuisine";
import { aujourdhui } from "@/lib/dates";
import { poserOrigineSaisons } from "@/lib/saisons";

/**
 * Repartir de zéro : rouvrir un cycle, pas réparer une panne.
 *
 * La remise à zéro qui existait déjà porte sur la vie courante — l'élan, les
 * quêtes validées, les tâches faites — et s'arrête là, volontairement. Celle-ci
 * va plus loin : elle remet le compteur des saisons à un et efface, au choix,
 * ce qui a été accumulé ailleurs.
 *
 * Trois principes la gouvernent.
 *
 * Rien de ce qui a été importé une fois n'est touché : le texte du Coran, ses
 * traductions, son mot à mot, la table Ciqual. Ce sont des références, pas une
 * progression, et elles se rechargeraient au prix de manipulations longues.
 *
 * Rien de ce qui a été construit ne part sans être demandé : les piliers, les
 * arcs, les quêtes, les créneaux et les réglages restent. Un arc devenu inutile
 * se supprime à l'unité, avec l'aperçu de ce qu'il emporte ; c'est plus juste
 * que de tout raser pour en refaire trois.
 *
 * Et rien ne s'efface sans avoir été compté d'abord. L'aperçu donne des nombres
 * réels, pas une formule vague — « ce qui sera effacé » doit être une mesure.
 */

export type ChoixReprise = {
  /** Les jours du journal, leurs phrases du soir, et les saisons archivées. */
  journal: boolean;
  /** Espaces, paquets, cartes, images, et tout l'historique de révision. */
  cartes: boolean;
  /** Position de lecture, séances, marque-pages. Le texte ne bouge pas. */
  coran: boolean;
  /** Recettes, patrons, inventaire, courses, journal des repas. Ciqual reste. */
  cuisine: boolean;
};

export type ApercuReprise = {
  /** Toujours effacé : c'est le cœur de « recommencer ». */
  validations: number;
  quetesRares: number;
  seuils: number;
  taches: number;
  piliers: number;

  jours: number;
  phrases: number;
  saisons: number;

  cartes: number;
  paquets: number;
  revisions: number;
  images: number;

  versetsLus: number;
  seances: number;
  marquePages: number;

  recettes: number;
  articles: number;
  repas: number;

  /** Ce qui reste debout, pour que l'écran puisse le dire aussi. */
  arcs: number;
  quetes: number;
};

/** Compte une table entière. */
function total(table: Parameters<typeof db.$count>[0]): Promise<number> {
  return db.$count(table).then((n) => Number(n));
}

export async function apercuReprise(): Promise<ApercuReprise> {
  const [
    nbValidations,
    nbRares,
    nbSeuils,
    nbTaches,
    nbPiliers,
    nbJours,
    nbPhrases,
    nbSaisons,
    nbCartes,
    nbPaquets,
    nbRevisions,
    nbImages,
    lecture,
    nbSeances,
    nbMarques,
    nbRecettes,
    nbArticles,
    nbRepas,
    nbArcs,
    nbQuetes,
  ] = await Promise.all([
    total(validations),
    total(quetesRaresFaites),
    total(seuilsArcs),
    total(taches),
    total(momentum),
    total(journees),
    db
      .select({ n: count() })
      .from(journees)
      .where(sql`coalesce(${journees.phrase}, '') <> ''`)
      .then((r) => Number(r[0]?.n ?? 0)),
    total(saisons),
    total(cartes),
    total(paquets),
    total(revisions),
    total(medias),
    db
      .select({ n: sql<number>`coalesce(count(distinct n), 0)` })
      .from(sql`${seancesLecture} s, unnest(s.numeros) as n`)
      .then((r) => Number(r[0]?.n ?? 0)),
    total(seancesLecture),
    total(marquePages),
    total(cuisineRecettes),
    total(cuisineInventaire),
    total(cuisineJournal),
    total(arcs),
    total(quetes),
  ]);

  return {
    validations: nbValidations,
    quetesRares: nbRares,
    seuils: nbSeuils,
    taches: nbTaches,
    piliers: nbPiliers,
    jours: nbJours,
    phrases: nbPhrases,
    saisons: nbSaisons,
    cartes: nbCartes,
    paquets: nbPaquets,
    revisions: nbRevisions,
    images: nbImages,
    versetsLus: lecture,
    seances: nbSeances,
    marquePages: nbMarques,
    recettes: nbRecettes,
    articles: nbArticles,
    repas: nbRepas,
    arcs: nbArcs,
    quetes: nbQuetes,
  };
}

export type BilanReprise = {
  /** Le nombre de lignes réellement effacées, table par table. */
  efface: Record<string, number>;
  /** La date posée comme nouveau départ : aujourd'hui. */
  origine: string;
  /** Où l'on se retrouve aussitôt après. */
  jourDansLaSaison: number;
};

/**
 * Efface, dans l'ordre des dépendances.
 *
 * Le pilote neon-http ne connaît pas les transactions : la suite de
 * suppressions n'est donc pas atomique. Elle est en revanche rejouable — tout
 * effacement l'est — et ordonnée de sorte qu'une interruption laisse une base
 * cohérente : on retire toujours ce qui référence avant ce qui est référencé.
 */
export async function repartirDeZero(
  choix: ChoixReprise,
  date = aujourdhui(),
): Promise<BilanReprise> {
  const efface: Record<string, number> = {};

  const vider = async (nom: string, table: Parameters<typeof db.delete>[0]) => {
    const partis = await db.delete(table).returning({ un: sql<number>`1` });
    efface[nom] = partis.length;
  };

  // ── Le cœur : ce que « recommencer » veut dire dans tous les cas.
  await vider("validations", validations);
  await vider("quêtes rares", quetesRaresFaites);
  await vider("seuils d'arcs", seuilsArcs);
  await vider("tâches", taches);
  await vider("messages envoyés", messagesEnvoyes);

  const elan = await db
    .update(momentum)
    .set({ valeur: 0, majLe: date })
    .returning({ pilier: momentum.pilier });
  efface["élan des piliers"] = elan.length;

  // ── Le journal et les saisons.
  if (choix.journal) {
    await vider("jours du journal", journees);
    await vider("saisons", saisons);
  }

  // ── Les cartes, de la feuille vers la racine.
  if (choix.cartes) {
    await vider("révisions", revisions);
    await vider("sessions de révision", sessionsRevision);
    await vider("images", medias);
    await vider("cartes", cartes);
    await vider("paquets", paquets);
    await vider("espaces", espaces);
  }

  // ── La lecture du Coran. Le texte, lui, ne bouge pas.
  if (choix.coran) {
    await vider("séances de lecture", seancesLecture);
    await vider("marque-pages", marquePages);
    await vider("positions de sourate", positionsSourate);
    await vider("position de lecture", positionLecture);
  }

  // ── La cuisine, sauf le catalogue Ciqual.
  if (choix.cuisine) {
    await vider("repas notés", cuisineJournal);
    await vider("suggestions", cuisineSuggestions);
    await vider("ingrédients de recettes", cuisineRecetteIngredients);
    await vider("recettes", cuisineRecettes);
    await vider("patrons de plat", cuisinePatrons);
    await vider("articles d'inventaire", cuisineInventaire);
    await vider("liste de courses", cuisineCourses);
  }

  // ── Et le compteur des saisons repart d'aujourd'hui.
  //
  // Le jour même, pas le lundi de la semaine. J'avais d'abord calé l'origine
  // sur le lundi en croyant qu'une saison devait couvrir quatre semaines
  // pleines — vérification faite, rien ne le demande : ni le bilan de la
  // semaine ni celui de la saison ne consultent l'autre découpage. Le seul
  // effet du calage était de faire afficher « jour 4 » à qui vient de tout
  // remettre à zéro.
  await poserOrigineSaisons(date);

  return { efface, origine: date, jourDansLaSaison: 1 };
}

/**
 * Recale le départ des saisons sans rien effacer.
 *
 * Sert quand l'origine a été posée un autre jour et qu'on veut simplement que
 * le compte reparte d'ici. Aucune donnée n'est touchée : ce n'est qu'une date.
 */
export async function calerSaisonAujourdhui(date = aujourdhui()): Promise<void> {
  await poserOrigineSaisons(date);
}

/** Les événements passés du calendrier, qu'on peut vouloir nettoyer à part. */
export async function compterEvenements(): Promise<number> {
  return db
    .select({ n: count() })
    .from(evenements)
    .where(isNotNull(evenements.date))
    .then((r) => Number(r[0]?.n ?? 0));
}
