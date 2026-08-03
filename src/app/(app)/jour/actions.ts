"use server";

import { revalidatePath } from "next/cache";

import {
  definirModeBas,
  enregistrerPhrase,
  validerQuete,
  validerQueteRare,
} from "@/lib/jour";
import { cloreSaison } from "@/lib/saisons";
import { marquerSeuilVu } from "@/lib/seuils";

export async function actionValider(queteId: number): Promise<void> {
  await validerQuete(queteId);
  revalidatePath("/jour");
}

export async function actionModeBas(actif: boolean): Promise<void> {
  await definirModeBas(actif);
  revalidatePath("/jour");
}

export async function actionValiderRare(): Promise<void> {
  await validerQueteRare();
  revalidatePath("/jour");
}

export async function actionSeuilVu(id: number): Promise<void> {
  await marquerSeuilVu(id);
  revalidatePath("/jour");
  revalidatePath("/parcours");
}

export async function actionCloreSaison(numero: number, reponse: string): Promise<void> {
  await cloreSaison(numero, reponse);
  revalidatePath("/jour");
  revalidatePath("/parcours");
}

/** Volontairement sans revalidation : la frappe ne doit jamais être interrompue. */
export async function actionPhrase(texte: string): Promise<void> {
  await enregistrerPhrase(texte);
}
