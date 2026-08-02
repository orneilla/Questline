/**
 * Données réelles : arcs, quêtes et créneaux.
 *
 *   npm run db:seed
 *
 * Le script refuse de tourner si le catalogue existe déjà, pour ne pas
 * effacer un historique de validations (les quêtes sont supprimées en
 * cascade). Pour le remplacer volontairement :
 *
 *   FORCE=1 npm run db:seed
 *
 * Le momentum n'est jamais écrasé : les lignes manquantes sont créées à zéro,
 * les existantes sont laissées telles quelles.
 */
import { db } from "../src/db";
import {
  arcs,
  creneauxRecurrents,
  momentum,
  quetes,
  validations,
} from "../src/db/schema";
import type { Pilier } from "../src/db/schema";
import { PILIERS } from "../src/lib/constantes";
import { aujourdhui } from "../src/lib/dates";

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

const CATALOGUE: DefinitionArc[] = [
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
const CRENEAUX = [
  { titre: "Shift", type: "travail" as const, jourSemaine: 2, debut: "18:30", fin: "21:30" },
  { titre: "Shift", type: "travail" as const, jourSemaine: 6, debut: "19:00", fin: "01:00" },
  { titre: "Shift", type: "travail" as const, jourSemaine: 0, debut: "18:00", fin: "00:00" },
];

async function seed() {
  const dejaPresent = (await db.select({ id: arcs.id }).from(arcs).limit(1)).length > 0;

  if (dejaPresent && process.env.FORCE !== "1") {
    console.error(
      "Le catalogue existe déjà. Relancer avec FORCE=1 pour le remplacer\n" +
        "(les validations rattachées aux quêtes actuelles seront supprimées).",
    );
    process.exit(1);
  }

  if (dejaPresent) {
    const historique = await db.select({ id: validations.id }).from(validations).limit(1);
    if (historique.length > 0) {
      console.warn("FORCE=1 : l'historique de validations est supprimé.");
    }
    await db.delete(validations);
    await db.delete(quetes);
    await db.delete(arcs);
  }

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

  console.log(
    `${CATALOGUE.length} arcs, ${nombreQuetes} quêtes, ${CRENEAUX.length} créneaux.`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  });
