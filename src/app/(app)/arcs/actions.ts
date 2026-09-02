"use server";

import { revalidatePath } from "next/cache";

import {
  accomplirArc,
  ajouterEtape,
  archiverArc,
  creerArc,
  deplacerEtape,
  franchirEtape,
  modifierArc,
  modifierEtape,
  perteALaSuppression,
  supprimerArc,
  supprimerEtape,
  type PerteArc,
  type SaisieArc,
} from "@/lib/arcs";
import { clesPiliers } from "@/lib/piliers";
import type { Pilier } from "@/db/schema";

/**
 * Écriture des arcs.
 *
 * Chaque action revalide la liste et le détail : contrairement à l'écran du
 * jour, il n'y a ici aucune célébration à préserver, et l'on veut voir tout de
 * suite le résultat de ce qu'on vient de changer.
 */

export type Retour = { erreur?: string; message?: string };

/**
 * La liste des piliers n'est plus close : la validité d'une clé se demande à
 * la base, jamais à une constante.
 */
async function lireSaisie(donnees: FormData): Promise<SaisieArc | string> {
  const nom = String(donnees.get("nom") ?? "").trim();
  const pilier = String(donnees.get("pilier") ?? "");
  const vision = String(donnees.get("vision") ?? "");

  if (nom.length === 0) return "Un arc a besoin d'un nom.";
  if (!(await clesPiliers()).includes(pilier)) {
    return "Choisis un pilier de rattachement.";
  }

  return { nom, pilier: pilier as Pilier, vision };
}

export async function actionCreerArc(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const saisie = await lireSaisie(donnees);
  if (typeof saisie === "string") return { erreur: saisie };

  await creerArc(saisie);
  revalidatePath("/arcs");
  return { message: `« ${saisie.nom} » créé.` };
}

export async function actionModifierArc(
  id: number,
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const saisie = await lireSaisie(donnees);
  if (typeof saisie === "string") return { erreur: saisie };

  await modifierArc(id, saisie);
  revalidatePath("/arcs");
  revalidatePath(`/arcs/${id}`);
  return { message: "Enregistré." };
}

export async function actionArchiverArc(id: number, archive: boolean): Promise<void> {
  await archiverArc(id, archive);
  revalidatePath("/arcs");
  revalidatePath(`/arcs/${id}`);
}

export async function actionAccomplirArc(id: number, accompli: boolean): Promise<void> {
  await accomplirArc(id, accompli);
  revalidatePath("/arcs");
  revalidatePath("/arcs/accomplis");
  revalidatePath(`/arcs/${id}`);
}

/**
 * Ce qu'une suppression emporterait. Rien n'est touché ici.
 *
 * Rend l'échec plutôt que de lever : une exception dans une action serveur
 * remonte jusqu'à l'écran « Quelque chose a cédé », qui n'explique rien.
 */
export async function actionPerteArc(
  id: number,
): Promise<{ perte?: PerteArc; erreur?: string }> {
  if (!Number.isInteger(id)) return { erreur: "Arc introuvable." };

  try {
    const perte = await perteALaSuppression(id);
    if (!perte) return { erreur: "Cet arc n'existe plus." };
    return { perte };
  } catch (erreur) {
    return {
      erreur: `Interrompu : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    };
  }
}

/**
 * Supprime l'arc pour de bon.
 *
 * Volontairement sans redirection côté serveur : c'est l'écran qui décide où
 * aller après, et une redirection lancée depuis une action se propagerait mal
 * à travers la transition en cours.
 */
export async function actionSupprimerArc(id: number): Promise<Retour> {
  if (!Number.isInteger(id)) return { erreur: "Arc introuvable." };

  try {
    const parti = await supprimerArc(id);
    if (!parti) return { erreur: "Cet arc n'existe plus." };

    revalidatePath("/arcs");
    revalidatePath("/arcs/accomplis");
    revalidatePath("/jour");
    revalidatePath("/semaine");
    revalidatePath("/bilan");
    revalidatePath("/parcours");
    revalidatePath("/reglages");
    return { message: "Arc supprimé." };
  } catch (erreur) {
    return {
      erreur: `Suppression interrompue : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    };
  }
}

export async function actionAjouterEtape(arcId: number, titre: string): Promise<void> {
  await ajouterEtape(arcId, titre);
  revalidatePath(`/arcs/${arcId}`);
  revalidatePath("/arcs");
}

export async function actionModifierEtape(
  arcId: number,
  id: number,
  titre: string,
  detail: string,
): Promise<void> {
  await modifierEtape(id, titre, detail);
  revalidatePath(`/arcs/${arcId}`);
}

export async function actionSupprimerEtape(arcId: number, id: number): Promise<void> {
  await supprimerEtape(id);
  revalidatePath(`/arcs/${arcId}`);
  revalidatePath("/arcs");
}

export async function actionFranchirEtape(
  arcId: number,
  id: number,
  atteinte: boolean,
): Promise<void> {
  await franchirEtape(id, atteinte);
  revalidatePath(`/arcs/${arcId}`);
  revalidatePath("/arcs");
}

export async function actionDeplacerEtape(
  arcId: number,
  id: number,
  sens: -1 | 1,
): Promise<void> {
  await deplacerEtape(id, sens);
  revalidatePath(`/arcs/${arcId}`);
}
