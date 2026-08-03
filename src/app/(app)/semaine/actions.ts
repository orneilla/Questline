"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { creneauxRecurrents, evenements } from "@/db/schema";

function rafraichir() {
  revalidatePath("/semaine");
  revalidatePath("/jour");
  revalidatePath("/reglages");
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
