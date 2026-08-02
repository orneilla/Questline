"use server";

import { revalidatePath } from "next/cache";

import { definirModeBas, enregistrerPhrase, validerQuete } from "@/lib/jour";

export async function actionValider(queteId: number): Promise<void> {
  await validerQuete(queteId);
  revalidatePath("/jour");
}

export async function actionModeBas(actif: boolean): Promise<void> {
  await definirModeBas(actif);
  revalidatePath("/jour");
}

/** Volontairement sans revalidation : la frappe ne doit jamais être interrompue. */
export async function actionPhrase(texte: string): Promise<void> {
  await enregistrerPhrase(texte);
}
