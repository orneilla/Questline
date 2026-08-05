"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  arcs,
  creneauxRecurrents,
  evenements,
  journees,
  momentum,
  quetes,
  validations,
  type CategorieCreneau,
} from "@/db/schema";
import {
  apercuRemise,
  lirePortee,
  remettreVieAZero,
  type Apercu,
  type Choix,
} from "@/lib/remise-a-zero";

export type Retour = { erreur?: string; message?: string };

const CATEGORIES: CategorieCreneau[] = ["cours", "travail", "priere", "autre"];

function categorie(valeur: FormDataEntryValue | null): CategorieCreneau {
  const brut = String(valeur ?? "");
  return (CATEGORIES as string[]).includes(brut) ? (brut as CategorieCreneau) : "autre";
}

function heure(valeur: FormDataEntryValue | null): string | null {
  const brut = String(valeur ?? "").slice(0, 5);
  return /^\d{2}:\d{2}$/.test(brut) ? brut : null;
}

function entier(valeur: FormDataEntryValue | null, min: number, max: number): number | null {
  const nombre = Number(valeur);
  if (!Number.isInteger(nombre) || nombre < min || nombre > max) return null;
  return nombre;
}

/** Les jours exclus arrivent comme autant de cases cochées. */
function joursExclus(donnees: FormData): number[] {
  return donnees
    .getAll("joursExclus")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

function rafraichir() {
  revalidatePath("/reglages");
  revalidatePath("/jour");
  revalidatePath("/semaine");
  revalidatePath("/arcs");
  revalidatePath("/bilan");
}

/* ------------------------------ Remise à zéro ------------------------------ */

/** Ce qui serait effacé, compté avant confirmation. Rien n'est touché ici. */
export async function compterRemise(portee: string): Promise<Apercu> {
  return apercuRemise(lirePortee(portee));
}

/**
 * Efface la trace de ce qui a été fait, dans la portée demandée.
 *
 * Ne touche ni les cartes, ni leur historique de révision, ni la lecture du
 * Coran : ce sont trois choses distinctes, chacune avec sa propre remise à zéro.
 */
export async function remettreAZeroVie(
  portee: string,
  choix: Choix,
): Promise<Retour> {
  if (!choix.elan && !choix.quetes && !choix.taches) {
    return { erreur: "Rien n'a été coché : rien n'a été effacé." };
  }

  try {
    const bilan = await remettreVieAZero(lirePortee(portee), choix);
    rafraichir();
    revalidatePath("/jardin");
    revalidatePath("/parcours");

    const parties = [
      choix.elan && `${bilan.piliers} pilier(s) remis à zéro`,
      choix.quetes &&
        `${bilan.validations} validation(s), ${bilan.quetesRares} quête(s) rare(s) et ${bilan.seuils} seuil(s) effacés`,
      choix.taches && `${bilan.taches} tâche(s) accomplie(s) effacée(s)`,
    ].filter((p): p is string => typeof p === "string");

    return {
      message: `${parties.join(" · ")}. Les cartes et le Coran n'ont pas bougé.`,
    };
  } catch (erreur) {
    return {
      erreur: `Remise à zéro interrompue : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    };
  }
}

/* --------------------------------- Créneaux -------------------------------- */

export async function ajouterCreneauRecurrent(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const titre = String(donnees.get("titre") ?? "").trim();
  const jourSemaine = entier(donnees.get("jourSemaine"), 0, 6);
  const debut = heure(donnees.get("debut"));
  const fin = heure(donnees.get("fin"));

  if (!titre) return { erreur: "Il faut un titre." };
  if (jourSemaine === null) return { erreur: "Jour invalide." };
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
  return { message: "Créneau ajouté." };
}

export async function modifierCreneauRecurrent(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const id = entier(donnees.get("id"), 1, Number.MAX_SAFE_INTEGER);
  const titre = String(donnees.get("titre") ?? "").trim();
  const jourSemaine = entier(donnees.get("jourSemaine"), 0, 6);
  const debut = heure(donnees.get("debut"));
  const fin = heure(donnees.get("fin"));

  if (id === null) return { erreur: "Créneau introuvable." };
  if (!titre) return { erreur: "Il faut un titre." };
  if (jourSemaine === null) return { erreur: "Jour invalide." };
  if (!debut || !fin) return { erreur: "Horaire invalide." };
  if (debut === fin) return { erreur: "Le créneau ne dure pas." };

  await db
    .update(creneauxRecurrents)
    .set({
      titre: titre.slice(0, 80),
      type: categorie(donnees.get("type")),
      jourSemaine,
      debut,
      fin,
    })
    .where(eq(creneauxRecurrents.id, id));

  rafraichir();
  return { message: "Créneau modifié." };
}

export async function supprimerCreneauRecurrent(id: number): Promise<void> {
  await db.delete(creneauxRecurrents).where(eq(creneauxRecurrents.id, id));
  rafraichir();
}

/* -------------------------------- Événements ------------------------------- */

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
  return { message: "Événement ajouté." };
}

export async function modifierEvenement(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const id = entier(donnees.get("id"), 1, Number.MAX_SAFE_INTEGER);
  const titre = String(donnees.get("titre") ?? "").trim();
  const date = String(donnees.get("date") ?? "");
  const debut = heure(donnees.get("debut"));
  const fin = heure(donnees.get("fin"));

  if (id === null) return { erreur: "Événement introuvable." };
  if (!titre) return { erreur: "Il faut un titre." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { erreur: "Date invalide." };
  if (!debut || !fin) return { erreur: "Horaire invalide." };

  await db
    .update(evenements)
    .set({
      titre: titre.slice(0, 80),
      type: categorie(donnees.get("type")),
      date,
      debut,
      fin,
      note: String(donnees.get("note") ?? "").slice(0, 500),
    })
    .where(eq(evenements.id, id));

  rafraichir();
  return { message: "Événement modifié." };
}

export async function supprimerEvenement(id: number): Promise<void> {
  await db.delete(evenements).where(eq(evenements.id, id));
  rafraichir();
}

/* ---------------------------------- Quêtes --------------------------------- */

export async function ajouterQuete(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const arcId = entier(donnees.get("arcId"), 1, Number.MAX_SAFE_INTEGER);
  const titre = String(donnees.get("titre") ?? "").trim();
  const poids = entier(donnees.get("poids"), 1, 10);
  const dureeMin = entier(donnees.get("dureeMin"), 0, 600);
  const frequenceSem = entier(donnees.get("frequenceSem"), 1, 7);

  if (arcId === null) return { erreur: "Arc introuvable." };
  if (!titre) return { erreur: "Il faut un titre." };
  if (poids === null) return { erreur: "Poids attendu entre 1 et 10." };
  if (dureeMin === null) return { erreur: "Durée attendue entre 0 et 600 minutes." };
  if (frequenceSem === null) return { erreur: "Fréquence attendue entre 1 et 7." };

  await db.insert(quetes).values({
    arcId,
    titre: titre.slice(0, 120),
    poids,
    dureeMin,
    frequenceSem,
    joursExclus: joursExclus(donnees),
    minimale: donnees.get("minimale") === "on",
  });

  rafraichir();
  return { message: "Quête ajoutée." };
}

export async function modifierQuete(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const id = entier(donnees.get("id"), 1, Number.MAX_SAFE_INTEGER);
  const titre = String(donnees.get("titre") ?? "").trim();
  const poids = entier(donnees.get("poids"), 1, 10);
  const dureeMin = entier(donnees.get("dureeMin"), 0, 600);
  const frequenceSem = entier(donnees.get("frequenceSem"), 1, 7);

  if (id === null) return { erreur: "Quête introuvable." };
  if (!titre) return { erreur: "Il faut un titre." };
  if (poids === null) return { erreur: "Poids attendu entre 1 et 10." };
  if (dureeMin === null) return { erreur: "Durée attendue entre 0 et 600 minutes." };
  if (frequenceSem === null) return { erreur: "Fréquence attendue entre 1 et 7." };

  await db
    .update(quetes)
    .set({
      titre: titre.slice(0, 120),
      poids,
      dureeMin,
      frequenceSem,
      joursExclus: joursExclus(donnees),
      minimale: donnees.get("minimale") === "on",
    })
    .where(eq(quetes.id, id));

  rafraichir();
  return { message: "Quête modifiée." };
}

export async function basculerQuete(id: number, actif: boolean): Promise<void> {
  await db.update(quetes).set({ actif }).where(eq(quetes.id, id));
  rafraichir();
}

/** Supprime la quête et, en cascade, les validations qui s'y rattachent. */
export async function supprimerQuete(id: number): Promise<void> {
  await db.delete(quetes).where(eq(quetes.id, id));
  rafraichir();
}

/* ----------------------------------- Arcs ---------------------------------- */

export async function modifierArc(
  _precedent: Retour,
  donnees: FormData,
): Promise<Retour> {
  const id = entier(donnees.get("id"), 1, Number.MAX_SAFE_INTEGER);
  const nom = String(donnees.get("nom") ?? "").trim();
  const vision = String(donnees.get("vision") ?? "").trim();

  if (id === null) return { erreur: "Arc introuvable." };
  if (!nom) return { erreur: "Il faut un nom." };

  await db
    .update(arcs)
    .set({ nom: nom.slice(0, 120), vision: vision.slice(0, 1000) })
    .where(eq(arcs.id, id));

  rafraichir();
  return { message: "Arc modifié." };
}

export async function basculerArc(id: number, actif: boolean): Promise<void> {
  await db.update(arcs).set({ actif }).where(eq(arcs.id, id));
  rafraichir();
}

/* --------------------------------- Données --------------------------------- */

export type Sauvegarde = {
  version: 1;
  exporteLe: string;
  arcs: (typeof arcs.$inferSelect)[];
  quetes: (typeof quetes.$inferSelect)[];
  creneauxRecurrents: (typeof creneauxRecurrents.$inferSelect)[];
  evenements: (typeof evenements.$inferSelect)[];
  journees: (typeof journees.$inferSelect)[];
  validations: (typeof validations.$inferSelect)[];
  momentum: (typeof momentum.$inferSelect)[];
};

export async function exporterTout(): Promise<Sauvegarde> {
  const [a, q, c, e, j, v, m] = await Promise.all([
    db.select().from(arcs).orderBy(arcs.id),
    db.select().from(quetes).orderBy(quetes.id),
    db.select().from(creneauxRecurrents).orderBy(creneauxRecurrents.id),
    db.select().from(evenements).orderBy(evenements.id),
    db.select().from(journees).orderBy(journees.date),
    db.select().from(validations).orderBy(validations.id),
    db.select().from(momentum),
  ]);

  return {
    version: 1,
    exporteLe: new Date().toISOString(),
    arcs: a,
    quetes: q,
    creneauxRecurrents: c,
    evenements: e,
    journees: j,
    validations: v,
    momentum: m,
  };
}

function tableau(valeur: unknown): unknown[] {
  return Array.isArray(valeur) ? valeur : [];
}

/**
 * Remplace tout le contenu par celui d'une sauvegarde.
 *
 * Les identifiants d'origine sont conservés pour que les liens entre quêtes,
 * arcs et validations tiennent. Les séquences sont ensuite recalées, sans quoi
 * la prochaine insertion entrerait en collision.
 */
export async function importerTout(json: string): Promise<Retour> {
  let sauvegarde: Sauvegarde;
  try {
    sauvegarde = JSON.parse(json);
  } catch {
    return { erreur: "Ce fichier n'est pas du JSON valide." };
  }

  if (!sauvegarde || typeof sauvegarde !== "object" || !Array.isArray(sauvegarde.arcs)) {
    return { erreur: "Ce fichier n'est pas une sauvegarde Questline." };
  }

  try {
    await db.delete(validations);
    await db.delete(quetes);
    await db.delete(arcs);
    await db.delete(creneauxRecurrents);
    await db.delete(evenements);
    await db.delete(journees);
    await db.delete(momentum);

    const lignesArcs = tableau(sauvegarde.arcs) as Sauvegarde["arcs"];
    const lignesQuetes = tableau(sauvegarde.quetes) as Sauvegarde["quetes"];
    const lignesCreneaux = tableau(
      sauvegarde.creneauxRecurrents,
    ) as Sauvegarde["creneauxRecurrents"];
    const lignesEvenements = tableau(sauvegarde.evenements) as Sauvegarde["evenements"];
    const lignesJournees = tableau(sauvegarde.journees) as Sauvegarde["journees"];
    const lignesValidations = tableau(sauvegarde.validations) as Sauvegarde["validations"];
    const lignesMomentum = tableau(sauvegarde.momentum) as Sauvegarde["momentum"];

    if (lignesArcs.length) await db.insert(arcs).values(lignesArcs);
    if (lignesQuetes.length) await db.insert(quetes).values(lignesQuetes);
    if (lignesCreneaux.length) await db.insert(creneauxRecurrents).values(lignesCreneaux);
    if (lignesEvenements.length) await db.insert(evenements).values(lignesEvenements);
    if (lignesJournees.length) await db.insert(journees).values(lignesJournees);
    if (lignesValidations.length) await db.insert(validations).values(lignesValidations);
    if (lignesMomentum.length) await db.insert(momentum).values(lignesMomentum);

    await recalerSequences();
  } catch (erreur) {
    return {
      erreur: `Import interrompu : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    };
  }

  rafraichir();
  return {
    message: `Import terminé : ${tableau(sauvegarde.arcs).length} arcs, ${tableau(sauvegarde.quetes).length} quêtes, ${tableau(sauvegarde.validations).length} validations.`,
  };
}

/** Remet les compteurs auto-incrémentés au-dessus des identifiants importés. */
async function recalerSequences(): Promise<void> {
  const tables = ["arcs", "quetes", "creneaux_recurrents", "evenements", "validations"];
  for (const table of tables) {
    await db.execute(
      sql.raw(
        `select setval(pg_get_serial_sequence('${table}', 'id'), coalesce((select max(id) from ${table}), 0) + 1, false)`,
      ),
    );
  }
}
