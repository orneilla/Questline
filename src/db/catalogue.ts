import { db } from "./index";
import {
  arcs,
  creneauxRecurrents,
  momentum,
  quetes,
  validations,
  type Pilier,
} from "./schema";
import { PILIERS } from "@/lib/constantes";
import { aujourdhui } from "@/lib/dates";

/**
 * Le catalogue réel : arcs, quêtes et trame de la semaine.
 *
 * Partagé par le script `npm run db:seed` et par la route d'installation
 * `/api/setup`, pour qu'il n'existe qu'une seule version de ces données.
 */

type DefinitionQuete = {
  titre: string;
  poids: number;
  dureeMin: number;
  /** Nombre de fois par semaine. */
  frequenceSem: number;
  minimale?: boolean;
};

type DefinitionArc = {
  nom: string;
  pilier: Pilier;
  vision: string;
  quetes: DefinitionQuete[];
};

export const CATALOGUE: DefinitionArc[] = [
  {
    nom: "Le Coran",
    pilier: "deen",
    vision:
      "Une relation quotidienne au Livre, et l'arabe assez solide pour ne plus dépendre des traductions.",
    quetes: [
      {
        titre: "Une page de Coran après une prière",
        poids: 3,
        dureeMin: 10,
        frequenceSem: 7,
        minimale: true,
      },
      { titre: "Dhikr du matin", poids: 2, dureeMin: 5, frequenceSem: 7, minimale: true },
      { titre: "15 min d'arabe", poids: 4, dureeMin: 15, frequenceSem: 5 },
      { titre: "Un cours Maison des Saléhates", poids: 5, dureeMin: 30, frequenceSem: 2 },
    ],
  },
  {
    nom: "Top 5 de promo",
    pilier: "savoir",
    vision:
      "Finir le M2 CDMB dans les cinq premiers. Combler l'inorganique avant septembre.",
    quetes: [
      { titre: "45 min de chimie inorganique", poids: 6, dureeMin: 45, frequenceSem: 5 },
      { titre: "Avancer un dossier UE", poids: 6, dureeMin: 60, frequenceSem: 3 },
      { titre: "Exercices de rétrosynthèse", poids: 4, dureeMin: 20, frequenceSem: 3 },
      { titre: "Lire un article scientifique", poids: 5, dureeMin: 30, frequenceSem: 2 },
      { titre: "Révision flash", poids: 2, dureeMin: 10, frequenceSem: 7, minimale: true },
    ],
  },
  {
    nom: "La thèse",
    pilier: "savoir",
    vision:
      "Décrocher un stage M2 en synthèse organique/catalyse, puis un financement de doctorat. Horizon : diriger un laboratoire.",
    quetes: [
      { titre: "Envoyer une candidature de stage", poids: 8, dureeMin: 45, frequenceSem: 2 },
      { titre: "Relancer un contact", poids: 5, dureeMin: 15, frequenceSem: 1 },
      { titre: "Repérer un labo et son sujet", poids: 5, dureeMin: 30, frequenceSem: 1 },
    ],
  },
  {
    nom: "ORNACRĒ existe",
    pilier: "oeuvre",
    vision: "Passer de la marque sur papier à la première capsule hijab vendue.",
    quetes: [
      { titre: "Publier un contenu", poids: 6, dureeMin: 30, frequenceSem: 2 },
      { titre: "Avancer la capsule hijab", poids: 6, dureeMin: 30, frequenceSem: 3 },
      { titre: "Écrire un texte de marque", poids: 5, dureeMin: 30, frequenceSem: 1 },
    ],
  },
  {
    nom: "Le corps que je veux",
    pilier: "corps",
    vision:
      "Un corps tonique et endurant, construit par la régularité et non par l'intensité.",
    quetes: [
      { titre: "Séance de salle", poids: 8, dureeMin: 60, frequenceSem: 3 },
      {
        titre: "Mobilité et étirements",
        poids: 3,
        dureeMin: 15,
        frequenceSem: 7,
        minimale: true,
      },
      { titre: "Marcher 8000 pas", poids: 3, dureeMin: 0, frequenceSem: 7 },
    ],
  },
  {
    nom: "Le tennis",
    pilier: "corps",
    vision: "Partir de zéro et jouer un vrai match.",
    quetes: [
      { titre: "Séance de tennis", poids: 8, dureeMin: 90, frequenceSem: 1 },
      { titre: "Travail au mur", poids: 4, dureeMin: 20, frequenceSem: 1 },
    ],
  },
  {
    nom: "Manger vrai",
    pilier: "table",
    vision:
      "Sortir progressivement des produits ultra-transformés, sans interdits ni comptage.",
    quetes: [
      { titre: "Un repas cuisiné maison", poids: 4, dureeMin: 30, frequenceSem: 7 },
      { titre: "Journée sans ultra-transformé", poids: 5, dureeMin: 0, frequenceSem: 7 },
      { titre: "Batch cooking", poids: 5, dureeMin: 90, frequenceSem: 1 },
      {
        titre: "Boire assez d'eau",
        poids: 2,
        dureeMin: 0,
        frequenceSem: 7,
        minimale: true,
      },
    ],
  },
  {
    nom: "Rester vivante",
    pilier: "seve",
    vision:
      "Lire, écrire, faire pousser, marcher dehors. Ce qui n'a pas de rendement et qui compte quand même.",
    quetes: [
      {
        titre: "20 min de lecture libre",
        poids: 4,
        dureeMin: 20,
        frequenceSem: 7,
        minimale: true,
      },
      { titre: "Écrire", poids: 4, dureeMin: 20, frequenceSem: 3 },
      { titre: "S'occuper des plantes", poids: 2, dureeMin: 10, frequenceSem: 2 },
      { titre: "Sortir en nature", poids: 6, dureeMin: 90, frequenceSem: 1 },
    ],
  },
];

/**
 * Shifts de travail. Celui du samedi se termine à 1 h du matin : il déborde
 * sur le dimanche, qui devient de ce fait un jour de récupération. Celui du
 * dimanche s'arrête pile à minuit et ne déborde donc pas sur le lundi.
 */
export const CRENEAUX = [
  { titre: "Shift", type: "travail" as const, jourSemaine: 2, debut: "18:30", fin: "21:30" },
  { titre: "Shift", type: "travail" as const, jourSemaine: 6, debut: "19:00", fin: "01:00" },
  { titre: "Shift", type: "travail" as const, jourSemaine: 0, debut: "18:00", fin: "00:00" },
];

export type Comptes = { arcs: number; quetes: number; creneaux: number };

export async function catalogueExiste(): Promise<boolean> {
  return (await db.select({ id: arcs.id }).from(arcs).limit(1)).length > 0;
}

export async function historiqueExiste(): Promise<boolean> {
  return (await db.select({ id: validations.id }).from(validations).limit(1)).length > 0;
}

/** Supprime le catalogue — et, en cascade, les validations qui s'y rattachent. */
export async function effacerCatalogue(): Promise<void> {
  await db.delete(validations);
  await db.delete(quetes);
  await db.delete(arcs);
}

/** Écrit le catalogue et met les piliers à zéro. N'écrase jamais un momentum existant. */
export async function installerCatalogue(): Promise<Comptes> {
  await db.delete(creneauxRecurrents);

  let nombreQuetes = 0;

  for (const definition of CATALOGUE) {
    const [arc] = await db
      .insert(arcs)
      .values({
        nom: definition.nom,
        pilier: definition.pilier,
        vision: definition.vision,
      })
      .returning();

    await db.insert(quetes).values(
      definition.quetes.map((q) => ({
        arcId: arc.id,
        titre: q.titre,
        poids: q.poids,
        dureeMin: q.dureeMin,
        frequenceSem: q.frequenceSem,
        minimale: q.minimale ?? false,
      })),
    );

    nombreQuetes += definition.quetes.length;
  }

  await db.insert(creneauxRecurrents).values(CRENEAUX);

  // Départ à zéro sur chaque pilier : aucun historique inventé.
  await db
    .insert(momentum)
    .values(PILIERS.map((pilier) => ({ pilier, valeur: 0, majLe: aujourdhui() })))
    .onConflictDoNothing();

  return { arcs: CATALOGUE.length, quetes: nombreQuetes, creneaux: CRENEAUX.length };
}
