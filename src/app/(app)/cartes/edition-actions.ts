"use server";

import { revalidatePath } from "next/cache";

import {
  archiverRevisions,
  chercherCartes,
  creerEspace,
  creerNote,
  creerPaquet,
  deplacerCartes,
  enregistrerMedia,
  enregistrerReglages,
  importerCartes,
  modifierEspace,
  modifierNote,
  modifierPaquet,
  purgerImagesOrphelines,
  supprimerEspace,
  supprimerNote,
  supprimerPaquet,
  suspendreCarte,
  type Filtres,
  type ResultatCarte,
  type SaisieNote,
} from "@/lib/cartes/edition";
import { lireCartesCsv } from "@/lib/cartes/csv";
import type { TypeCarte } from "@/db/schema";

/**
 * Actions de l'éditeur.
 *
 * Toutes renvoient un message plutôt que de lever : sur une tablette, une
 * erreur non rattrapée coûte la saisie en cours. Ce qui échoue le dit, et le
 * texte reste dans le champ.
 */

export type Retour = { erreur?: string; message?: string };

const TYPES: TypeCarte[] = ["recto_verso", "inversee", "trous"];

function type(valeur: FormDataEntryValue | null): TypeCarte {
  const brut = String(valeur ?? "");
  return (TYPES as string[]).includes(brut) ? (brut as TypeCarte) : "recto_verso";
}

function entier(valeur: FormDataEntryValue | null, min: number, max: number): number | null {
  const nombre = Number(valeur);
  if (!Number.isInteger(nombre) || nombre < min || nombre > max) return null;
  return nombre;
}

function decimal(valeur: FormDataEntryValue | null, min: number, max: number): number | null {
  const nombre = Number(String(valeur ?? "").replace(",", "."));
  if (!Number.isFinite(nombre) || nombre < min || nombre > max) return null;
  return nombre;
}

function tags(valeur: FormDataEntryValue | null): string[] {
  return String(valeur ?? "")
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function couleur(valeur: FormDataEntryValue | null, defaut: string): string {
  const brut = String(valeur ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(brut) ? brut : defaut;
}

function message(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : "Quelque chose n'a pas abouti.";
}

function rafraichirCartes() {
  revalidatePath("/cartes");
  revalidatePath("/cartes/organiser");
  revalidatePath("/cartes/recherche");
  revalidatePath("/jardin");
}

function saisie(donnees: FormData, paquetId: number): SaisieNote {
  return {
    paquetId,
    recto: String(donnees.get("recto") ?? ""),
    verso: String(donnees.get("verso") ?? ""),
    type: type(donnees.get("type")),
    notes: String(donnees.get("notes") ?? ""),
    tags: tags(donnees.get("tags")),
  };
}

/* ─────────────────────────────── Cartes ─────────────────────────────── */

export async function creerCarte(_precedent: Retour, donnees: FormData): Promise<Retour> {
  const paquetId = entier(donnees.get("paquetId"), 1, Number.MAX_SAFE_INTEGER);
  if (paquetId === null) return { erreur: "Choisis un paquet." };

  const entree = saisie(donnees, paquetId);
  if (!entree.recto.trim()) return { erreur: "Le recto est vide." };
  if (entree.type !== "trous" && !entree.verso.trim()) {
    return { erreur: "Le verso est vide." };
  }

  try {
    const { creees } = await creerNote(entree);
    rafraichirCartes();
    return {
      message:
        creees === 1 ? "Carte créée." : `${creees} cartes créées à partir de la note.`,
    };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function enregistrerCarte(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const carteId = entier(donnees.get("carteId"), 1, Number.MAX_SAFE_INTEGER);
  const paquetId = entier(donnees.get("paquetId"), 1, Number.MAX_SAFE_INTEGER);
  if (carteId === null || paquetId === null) return { erreur: "Carte introuvable." };

  const entree = saisie(donnees, paquetId);
  if (!entree.recto.trim()) return { erreur: "Le recto est vide." };

  try {
    const bilan = await modifierNote(carteId, entree);
    rafraichirCartes();
    revalidatePath(`/cartes/carte/${carteId}`);

    const parts = [`${bilan.misesAJour} mise${bilan.misesAJour > 1 ? "s" : ""} à jour`];
    if (bilan.ajoutees > 0) parts.push(`${bilan.ajoutees} ajoutée(s)`);
    if (bilan.retirees > 0) parts.push(`${bilan.retirees} retirée(s)`);
    return { message: `Enregistré : ${parts.join(", ")}.` };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function effacerCarte(carteId: number, toutLeGroupe: boolean): Promise<void> {
  await supprimerNote(carteId, toutLeGroupe);
  rafraichirCartes();
}

export async function basculerSuspension(
  carteId: number,
  suspendue: boolean,
): Promise<void> {
  await suspendreCarte(carteId, suspendue);
  rafraichirCartes();
  revalidatePath(`/cartes/carte/${carteId}`);
}

export async function deplacerVersPaquet(ids: number[], paquetId: number): Promise<void> {
  await deplacerCartes(
    ids.filter((id) => Number.isInteger(id)),
    paquetId,
  );
  rafraichirCartes();
}

export type ResultatsRecherche = { cartes: ResultatCarte[]; erreur?: string };

export async function rechercher(filtres: Filtres): Promise<ResultatsRecherche> {
  try {
    return { cartes: await chercherCartes(filtres) };
  } catch (erreur) {
    return { cartes: [], erreur: message(erreur) };
  }
}

/* ───────────────────────── Espaces et paquets ───────────────────────── */

export async function ajouterEspace(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const nom = String(donnees.get("nom") ?? "").trim();
  if (!nom) return { erreur: "Il faut un nom." };

  try {
    await creerEspace(nom, couleur(donnees.get("couleur"), "#7e92b8"));
    rafraichirCartes();
    return { message: "Espace créé." };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function renommerEspace(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const id = entier(donnees.get("id"), 1, Number.MAX_SAFE_INTEGER);
  const nom = String(donnees.get("nom") ?? "").trim();
  if (id === null) return { erreur: "Espace introuvable." };
  if (!nom) return { erreur: "Il faut un nom." };

  try {
    await modifierEspace(id, nom, couleur(donnees.get("couleur"), "#7e92b8"));
    rafraichirCartes();
    return { message: "Espace modifié." };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function effacerEspace(id: number): Promise<void> {
  await supprimerEspace(id);
  rafraichirCartes();
}

export async function ajouterPaquet(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const espaceId = entier(donnees.get("espaceId"), 1, Number.MAX_SAFE_INTEGER);
  const nom = String(donnees.get("nom") ?? "").trim();
  const parentBrut = String(donnees.get("parentId") ?? "");
  const parentId = parentBrut === "" ? null : Number(parentBrut);

  if (espaceId === null) return { erreur: "Choisis un espace." };
  if (!nom) return { erreur: "Il faut un nom." };

  try {
    await creerPaquet({
      espaceId,
      parentId: parentId !== null && Number.isInteger(parentId) ? parentId : null,
      nom,
    });
    rafraichirCartes();
    return { message: "Paquet créé." };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function enregistrerPaquet(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const id = entier(donnees.get("id"), 1, Number.MAX_SAFE_INTEGER);
  const espaceId = entier(donnees.get("espaceId"), 1, Number.MAX_SAFE_INTEGER);
  const nom = String(donnees.get("nom") ?? "").trim();
  const parentBrut = String(donnees.get("parentId") ?? "");

  if (id === null || espaceId === null) return { erreur: "Paquet introuvable." };
  if (!nom) return { erreur: "Il faut un nom." };

  const parentId = parentBrut === "" ? null : Number(parentBrut);

  try {
    await modifierPaquet(id, {
      nom,
      espaceId,
      parentId: parentId !== null && Number.isInteger(parentId) ? parentId : null,
    });
    rafraichirCartes();
    return { message: "Paquet modifié." };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function effacerPaquet(id: number): Promise<void> {
  await supprimerPaquet(id);
  rafraichirCartes();
}

/* ────────────────────────────── Images ────────────────────────────── */

export type RetourImage =
  | { url: string; octets: number; erreur?: undefined }
  | { erreur: string; url?: undefined; octets?: undefined };

/**
 * Reçoit une image déjà compressée par le navigateur. Le serveur ne
 * retouche rien : il vérifie le poids, range, et rend l'adresse à coller.
 */
export async function televerserImage(entree: {
  nom: string;
  typeMime: string;
  base64: string;
  largeur: number;
  hauteur: number;
}): Promise<RetourImage> {
  if (entree.typeMime !== "image/png" && entree.typeMime !== "image/webp") {
    return { erreur: "Format non accepté : seuls le PNG et le WebP sont rangés." };
  }

  try {
    const { id, octets } = await enregistrerMedia(entree);
    // L'extension n'est pas décorative : elle porte la distinction entre un
    // schéma au trait (PNG, inversé sur fond sombre) et une photo (WebP).
    const extension = entree.typeMime === "image/png" ? "png" : "webp";
    return { url: `/api/cartes/media/${id}.${extension}`, octets };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function definirCouverture(
  paquetId: number,
  url: string | null,
): Promise<Retour> {
  try {
    await modifierPaquet(paquetId, { couverture: url });
    rafraichirCartes();
    return { message: url ? "Couverture posée." : "Couverture retirée." };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

/* ──────────────────────── Réglages, base, import ──────────────────────── */

export async function sauverReglages(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const delaiEncoreMin = decimal(donnees.get("delaiEncoreMin"), 0.5, 60);
  const delaiDifficileMin = decimal(donnees.get("delaiDifficileMin"), 0.5, 240);
  const retentionPourCent = decimal(donnees.get("retentionCible"), 70, 97);
  const nouvellesParJour = entier(donnees.get("nouvellesParJour"), 0, 500);
  const maximumParJour = entier(donnees.get("maximumParJour"), 1, 2000);

  if (delaiEncoreMin === null) return { erreur: "Délai « Encore » hors limites." };
  if (delaiDifficileMin === null) return { erreur: "Délai « Difficile » hors limites." };
  if (retentionPourCent === null) {
    return { erreur: "La rétention visée doit rester entre 70 et 97 %." };
  }
  if (nouvellesParJour === null) return { erreur: "Nombre de nouvelles invalide." };
  if (maximumParJour === null) return { erreur: "Maximum par jour invalide." };

  try {
    await enregistrerReglages({
      delaiEncoreMin,
      delaiDifficileMin,
      retentionCible: retentionPourCent / 100,
      nouvellesParJour,
      maximumParJour,
    });
    revalidatePath("/cartes/reglages");
    revalidatePath("/cartes");
    return { message: "Réglages enregistrés." };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function archiver(avant: string): Promise<Retour> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(avant)) return { erreur: "Date invalide." };

  try {
    const effacees = await archiverRevisions(avant);
    revalidatePath("/cartes/reglages");
    return {
      message:
        effacees === 0
          ? "Rien à archiver : tout l'historique est déjà récent."
          : `${effacees} révisions anciennes effacées. Les échéances n'ont pas bougé.`,
    };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function purgerImages(): Promise<Retour> {
  try {
    const effacees = await purgerImagesOrphelines();
    revalidatePath("/cartes/reglages");
    return {
      message:
        effacees === 0
          ? "Aucune image orpheline."
          : `${effacees} image(s) sans carte effacée(s).`,
    };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function importerCsv(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const paquetId = entier(donnees.get("paquetId"), 1, Number.MAX_SAFE_INTEGER);
  const texte = String(donnees.get("csv") ?? "");

  if (paquetId === null) return { erreur: "Choisis un paquet d'arrivée." };
  if (!texte.trim()) return { erreur: "Colle d'abord le contenu du fichier." };

  try {
    const lignes = lireCartesCsv(texte);
    if (lignes.length === 0) {
      return { erreur: "Aucune ligne exploitable : il faut au moins un recto par ligne." };
    }
    const creees = await importerCartes(paquetId, lignes);
    rafraichirCartes();
    return { message: `${creees} carte(s) importée(s), toutes à l'état neuf.` };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}
