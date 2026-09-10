"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { calendriersAbonnes } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ajouterCalendrier,
  basculerCalendrier,
  relireCalendrier,
  relireTout,
  retirerCalendrier,
} from "@/lib/calendrier/abonnements";
import { diagnostiquer } from "@/lib/erreurs";

/** Abonnements aux calendriers extérieurs. Aucune action ne laisse filer d'erreur. */

export type Retour = { erreur?: string; message?: string };

const INSTALLATION =
  "La base n'est pas à jour : la table des calendriers n'existe pas encore. " +
  "Ouvre l'adresse d'installation une fois, puis reviens ici.";

function expliquer(erreur: unknown): Retour {
  if (diagnostiquer(erreur) !== null) return { erreur: INSTALLATION };
  return {
    erreur: `Interrompu : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
  };
}

function rafraichir() {
  for (const route of ["/reglages/calendrier", "/jour", "/semaine"]) {
    revalidatePath(route);
  }
}

/**
 * Ajoute un abonnement, puis le relit aussitôt.
 *
 * La relecture immédiate n'est pas un raffinement : c'est elle qui dit si
 * l'adresse collée mène bien à un calendrier. Sans elle, on croirait avoir
 * réussi et on ne verrait rien apparaître, sans savoir pourquoi.
 */
export async function actionAjouterCalendrier(url: string): Promise<Retour> {
  let id: number;
  try {
    const issue = await ajouterCalendrier(url);
    if (issue.issue === "adresse-invalide") {
      return {
        erreur:
          "Cette adresse n'est pas utilisable. Elle doit commencer par https:// ou webcal://.",
      };
    }
    if (issue.issue === "deja-la") return { erreur: "Ce calendrier est déjà abonné." };
    id = issue.id;
  } catch (erreur) {
    return expliquer(erreur);
  }

  try {
    const [ligne] = await db
      .select()
      .from(calendriersAbonnes)
      .where(eq(calendriersAbonnes.id, id))
      .limit(1);
    if (!ligne) return { erreur: "L'abonnement n'a pas été retrouvé." };

    const lu = await relireCalendrier(ligne);
    rafraichir();

    if (lu.erreur) {
      return {
        erreur: `Abonnement enregistré, mais la première lecture a échoué. ${lu.erreur}`,
      };
    }
    return {
      message:
        `${lu.occurrences} créneau${lu.occurrences > 1 ? "x" : ""} importé` +
        `${lu.occurrences > 1 ? "s" : ""}` +
        (lu.reglesIgnorees > 0
          ? ` — ${lu.reglesIgnorees} répétition${lu.reglesIgnorees > 1 ? "s" : ""} trop complexe${lu.reglesIgnorees > 1 ? "s" : ""}, posée${lu.reglesIgnorees > 1 ? "s" : ""} à leur seule date de départ.`
          : "."),
    };
  } catch (erreur) {
    return expliquer(erreur);
  }
}

export async function actionRelireCalendriers(): Promise<Retour> {
  let lectures: Awaited<ReturnType<typeof relireTout>>;
  try {
    lectures = await relireTout();
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();

  if (lectures.length === 0) return { message: "Aucun calendrier actif à relire." };

  const echecs = lectures.filter((l) => l.erreur !== null);
  if (echecs.length > 0) {
    return { erreur: echecs.map((e) => e.erreur).join(" — ") };
  }

  const total = lectures.reduce((n, l) => n + l.occurrences, 0);
  return { message: `À jour : ${total} créneau${total > 1 ? "x" : ""} au total.` };
}

export async function actionRetirerCalendrier(id: number): Promise<Retour> {
  if (!Number.isInteger(id)) return { erreur: "Abonnement introuvable." };

  try {
    if (!(await retirerCalendrier(id))) return { erreur: "Cet abonnement n'existe plus." };
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: "Abonnement retiré. Ses créneaux sont partis avec." };
}

export async function actionBasculerCalendrier(
  id: number,
  actif: boolean,
): Promise<Retour> {
  if (!Number.isInteger(id)) return { erreur: "Abonnement introuvable." };

  try {
    await basculerCalendrier(id, actif);
  } catch (erreur) {
    return expliquer(erreur);
  }

  rafraichir();
  return { message: actif ? "Pris en compte." : "Mis de côté." };
}
