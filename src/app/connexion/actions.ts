"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { NOM_COOKIE, creerJeton, motDePasseCorrect, optionsCookie } from "@/lib/auth";

export type EtatConnexion = { erreur?: string };

export async function connecter(
  _precedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const saisi = String(donnees.get("motDePasse") ?? "");

  if (!process.env.APP_PASSWORD) {
    return { erreur: "APP_PASSWORD n'est pas configurée sur le serveur." };
  }

  if (!(await motDePasseCorrect(saisi))) {
    // Petite temporisation : suffisant pour une app à un seul utilisateur.
    await new Promise((r) => setTimeout(r, 400));
    return { erreur: "Mot de passe incorrect." };
  }

  const boite = await cookies();
  boite.set(NOM_COOKIE, await creerJeton(), optionsCookie);

  redirect("/jour");
}
