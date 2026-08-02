/**
 * Jeu de données de test.
 *
 *   npm run db:seed
 *
 * Efface et réécrit le contenu : à n'utiliser que sur une base de test.
 */
import { db } from "../src/db";
import {
  arcs,
  creneaux,
  journees,
  momentum,
  quetes,
  validations,
} from "../src/db/schema";
import { decalerJours } from "../src/lib/dates";

const aujourdhui = new Date().toISOString().slice(0, 10);
const ilYA = (jours: number) => decalerJours(aujourdhui, -jours);

async function seed() {
  console.log("Nettoyage…");
  await db.delete(validations);
  await db.delete(quetes);
  await db.delete(arcs);
  await db.delete(creneaux);
  await db.delete(journees);
  await db.delete(momentum);

  console.log("Arcs…");
  const [corps, deen, academique, ornacre, nutrition] = await db
    .insert(arcs)
    .values([
      {
        nom: "Reprendre le corps",
        pilier: "corps",
        vision: "Un corps solide, entretenu sans à-coups.",
        progression: 20,
      },
      {
        nom: "Ancrer le deen",
        pilier: "deen",
        vision: "Une pratique régulière, tenue sans culpabilité.",
        progression: 35,
      },
      {
        nom: "Tenir le semestre",
        pilier: "academique",
        vision: "Finir chaque module sans rattrapage.",
        progression: 45,
      },
      {
        nom: "Faire exister Ornacre",
        pilier: "ornacre",
        vision: "Un projet qui avance un peu chaque semaine.",
        progression: 15,
      },
      {
        nom: "Manger juste",
        pilier: "nutrition",
        vision: "Des repas simples, préparés, réguliers.",
        progression: 25,
      },
    ])
    .returning();

  console.log("Quêtes…");
  const quetesInserees = await db
    .insert(quetes)
    .values([
      // Corps
      { arcId: corps.id, titre: "Séance complète", poids: 5, dureeMin: 45 },
      { arcId: corps.id, titre: "Marche au grand air", poids: 2, dureeMin: 20 },
      { arcId: corps.id, titre: "Dix pompes", poids: 1, dureeMin: 5, minimale: true },

      // Deen
      { arcId: deen.id, titre: "Lecture du Coran", poids: 3, dureeMin: 15 },
      { arcId: deen.id, titre: "Dhikr après Fajr", poids: 1, dureeMin: 5, minimale: true },
      {
        arcId: deen.id,
        titre: "Cours de fiqh",
        poids: 4,
        dureeMin: 40,
        recurrence: "hebdomadaire" as const,
      },

      // Académique
      { arcId: academique.id, titre: "Session d'étude", poids: 5, dureeMin: 50 },
      { arcId: academique.id, titre: "Relire les notes du jour", poids: 2, dureeMin: 20 },
      {
        arcId: academique.id,
        titre: "Cinq fiches de révision",
        poids: 1,
        dureeMin: 5,
        minimale: true,
      },

      // Ornacre
      { arcId: ornacre.id, titre: "Avancer la maquette", poids: 4, dureeMin: 40 },
      { arcId: ornacre.id, titre: "Écrire deux cents mots", poids: 2, dureeMin: 20 },
      {
        arcId: ornacre.id,
        titre: "Noter une idée",
        poids: 1,
        dureeMin: 5,
        minimale: true,
      },

      // Nutrition
      { arcId: nutrition.id, titre: "Préparer un vrai repas", poids: 3, dureeMin: 30 },
      { arcId: nutrition.id, titre: "Deux litres d'eau", poids: 1, dureeMin: 5, minimale: true },
      {
        arcId: nutrition.id,
        titre: "Courses de la semaine",
        poids: 3,
        dureeMin: 60,
        recurrence: "hebdomadaire" as const,
        joursExclus: [1, 2, 3, 4, 5],
      },
    ])
    .returning();

  console.log("Créneaux…");
  const prieres = [
    { debut: "06:15", fin: "06:30" },
    { debut: "13:30", fin: "13:45" },
    { debut: "16:45", fin: "17:00" },
    { debut: "20:50", fin: "21:05" },
    { debut: "22:30", fin: "22:45" },
  ];

  await db.insert(creneaux).values([
    // Shifts : samedi et dimanche après-midi.
    { type: "shift" as const, jourSemaine: 6, debut: "14:00", fin: "22:00" },
    { type: "shift" as const, jourSemaine: 0, debut: "14:00", fin: "22:00" },
    // Cours : lundi, mardi, jeudi matin.
    { type: "cours" as const, jourSemaine: 1, debut: "09:00", fin: "13:00" },
    { type: "cours" as const, jourSemaine: 2, debut: "09:00", fin: "13:00" },
    { type: "cours" as const, jourSemaine: 4, debut: "09:00", fin: "13:00" },
    // Prières : tous les jours.
    ...Array.from({ length: 7 }, (_, jour) =>
      prieres.map((p) => ({ type: "priere" as const, jourSemaine: jour, ...p })),
    ).flat(),
  ]);

  console.log("Momentum et historique…");
  const parTitre = (titre: string) => {
    const quete = quetesInserees.find((q) => q.titre === titre);
    if (!quete) throw new Error(`Quête introuvable : ${titre}`);
    return quete.id;
  };

  // Historique volontairement irrégulier : de quoi voir la décroissance
  // douce et le bonus de reprise dès le premier chargement.
  await db.insert(validations).values([
    { queteId: parTitre("Session d'étude"), date: ilYA(1) },
    { queteId: parTitre("Lecture du Coran"), date: ilYA(1) },
    { queteId: parTitre("Session d'étude"), date: ilYA(2) },
    { queteId: parTitre("Marche au grand air"), date: ilYA(4) },
    { queteId: parTitre("Préparer un vrai repas"), date: ilYA(3) },
    { queteId: parTitre("Noter une idée"), date: ilYA(6) },
  ]);

  await db.insert(momentum).values([
    { pilier: "corps", valeur: 18, majLe: ilYA(4) },
    { pilier: "deen", valeur: 42, majLe: ilYA(1) },
    { pilier: "academique", valeur: 61, majLe: ilYA(1) },
    { pilier: "ornacre", valeur: 8, majLe: ilYA(6) },
    { pilier: "nutrition", valeur: 30, majLe: ilYA(3) },
  ]);

  await db.insert(journees).values([
    { date: ilYA(1), typeJour: "cours", modeBas: false, phrase: "Journée dense, tenue." },
    { date: ilYA(2), typeJour: "libre", modeBas: true, phrase: "" },
  ]);

  console.log("Terminé.");
}

seed()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  });
