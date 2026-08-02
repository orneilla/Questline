"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { creneauxRecurrents, evenements, type CategorieCreneau } from "@/db/schema";

const CATEGORIES: CategorieCreneau[] = ["cours", "travail", "priere", "autre"];

function categorie(valeur: FormDataEntryValue | null): CategorieCreneau {
  const brut = String(valeur ?? "");
  return (CATEGORIES as string[]).includes(brut) ? (brut as CategorieCreneau) : "autre";
}

function heure(valeur: FormDataEntryValue | null): string | null {
  const brut = String(valeur ?? "");
  return /^\d{2}:\d{2}$/.test(brut) ? brut : null;
}

function rafraichir() {
  revalidatePath("/semaine");
  revalidatePath("/jour");
}

export type Retour = { erreur?: string };

export async function ajouterCreneauRecurrent(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const titre = String(donnees.get("titre") ?? "").trim();
  const jourSemaine = Number(donnees.get("jourSemaine"));
  const debut = heure(donnees.get("debut"));
  const fin = heure(donnees.get("fin"));

  if (!titre) return { erreur: "Il faut un titre." };
  if (!Number.isInteger(jourSemaine) || jourSemaine < 0 || jourSemaine > 6) {
    return { erreur: "Jour invalide." };
  }
  if (!debut || !fin) return { erreur: "Horaire invalide." };
  if (debut === fin) return { erreur: "Le créneau ne dure pas." };

  await db.insert(creneauxRecurrents).values({
    titre: titre.slice(0, 80),
    type: categorie(donnees.get("type")),
    jourSemaine,
    debut,
    fin,
  });

  rafraichir();
  return {};
}

export async function ajouterEvenement(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const titre = String(donnees.get("titre") ?? "").trim();
  const date = String(donnees.get("date") ?? "");
  const debut = heure(donnees.get("debut"));
  const fin = heure(donnees.get("fin"));

  if (!titre) return { erreur: "Il faut un titre." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { erreur: "Date invalide." };
  if (!debut || !fin) return { erreur: "Horaire invalide." };
  if (debut === fin) return { erreur: "L'événement ne dure pas." };

  await db.insert(evenements).values({
    titre: titre.slice(0, 80),
    type: categorie(donnees.get("type")),
    date,
    debut,
    fin,
    note: String(donnees.get("note") ?? "").slice(0, 500),
  });

  rafraichir();
  return {};
}

/**
 * Annule un récurrent pour une date : un événement réduit à un instant, posé
 * au début du créneau. Il l'écrase sans rien occuper.
 */
export async function annulerCreneau(
  recurrentId: number,
  date: string,
): Promise<void> {
  const [cible] = await db
    .select()
    .from(creneauxRecurrents)
    .where(eq(creneauxRecurrents.id, recurrentId))
    .limit(1);
  if (!cible) return;

  await db.insert(evenements).values({
    titre: `${cible.titre} — annulé`,
    type: cible.type,
    date,
    debut: cible.debut,
    fin: cible.debut,
    note: "",
  });

  rafraichir();
}

/** Retire une annulation : le récurrent reprend sa place ce jour-là. */
export async function retablirCreneau(
  recurrentId: number,
  date: string,
): Promise<void> {
  const [cible] = await db
    .select()
    .from(creneauxRecurrents)
    .where(eq(creneauxRecurrents.id, recurrentId))
    .limit(1);
  if (!cible) return;

  await db
    .delete(evenements)
    .where(
      and(
        eq(evenements.date, date),
        eq(evenements.debut, cible.debut),
        eq(evenements.fin, cible.debut),
      ),
    );

  rafraichir();
}
