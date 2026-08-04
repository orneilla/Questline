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
  supprimerEtape,
  type SaisieArc,
} from "@/lib/arcs";
import { PILIERS } from "@/lib/constantes";
import type { Pilier } from "@/db/schema";

/**
 * Écriture des arcs.
 *
 * Chaque action revalide la liste et le détail : contrairement à l'écran du
 * jour, il n'y a ici aucune célébration à préserver, et l'on veut voir tout de
 * suite le résultat de ce qu'on vient de changer.
 */

export type Retour = { erreur?: string; message?: string };

function pilierValide(valeur: unknown): valeur is Pilier {
  return typeof valeur === "string" && (PILIERS as readonly string[]).includes(valeur);
}

function lireSaisie(donnees: FormData): SaisieArc | string {
  const nom = String(donnees.get("nom") ?? "").trim();
  const pilier = donnees.get("pilier");
  const vision = String(donnees.get("vision") ?? "");

  if (nom.length === 0) return "Un arc a besoin d'un nom.";
  if (!pilierValide(pilier)) return "Choisis un pilier de rattachement.";

  return { nom, pilier, vision };
}

export async function actionCreerArc(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const saisie = lireSaisie(donnees);
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
  const saisie = lireSaisie(donnees);
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
