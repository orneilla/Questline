import "server-only";

import { and, asc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  calendriersAbonnes,
  evenementsImportes,
  type CalendrierAbonne,
  type EvenementImporte,
} from "@/db/schema";
import { FUSEAU, aujourdhui, decalerJours } from "@/lib/dates";
import { chargerRegles } from "@/lib/categories";
import { classer } from "@/lib/categories-partage";
import { derouler_calendrier } from "./ics";

/**
 * Les calendriers extérieurs : abonnement, relecture, stockage.
 *
 * Le flux est relu périodiquement, jamais à l'affichage : une page qui irait
 * chercher un fichier chez Apple à chaque ouverture serait lente et dépendrait
 * d'un service qu'on ne maîtrise pas. On garde donc le déroulé en base, et
 * l'écran du jour lit une ligne comme il lirait un créneau.
 *
 * La lecture est à sens unique. Rien n'est jamais écrit dans le calendrier
 * d'origine, et aucun identifiant Apple n'est demandé : un flux publié suffit,
 * ce qui évite d'avoir à garder un mot de passe sur le serveur.
 */

/** Ce qu'on déroule : un mois en arrière, six devant. */
const AVANT_JOURS = 31;
const APRES_JOURS = 190;

export type FicheCalendrier = CalendrierAbonne & { fenetre: { debut: string; fin: string } };

function fenetre(date = aujourdhui()) {
  return { debut: decalerJours(date, -AVANT_JOURS), fin: decalerJours(date, APRES_JOURS) };
}

export async function listerCalendriers(): Promise<FicheCalendrier[]> {
  const lignes = await db
    .select()
    .from(calendriersAbonnes)
    .orderBy(asc(calendriersAbonnes.id));

  const bornes = fenetre();
  return lignes.map((l) => ({ ...l, fenetre: bornes }));
}

/**
 * Normalise l'adresse donnée.
 *
 * Apple propose ses calendriers publiés en `webcal://`, que rien ne sait aller
 * chercher côté serveur : c'est du HTTPS déguisé, et le remplacer évite de
 * renvoyer une erreur incompréhensible à qui a simplement collé ce qu'on lui
 * avait donné.
 */
export function normaliserUrl(brut: string): string | null {
  const propre = brut.trim();
  if (propre.length === 0) return null;

  const sansWebcal = propre.replace(/^webcal:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(sansWebcal);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.toString();
}

export type Ajout =
  | { issue: "fait"; id: number }
  | { issue: "adresse-invalide" }
  | { issue: "deja-la" };

export async function ajouterCalendrier(urlBrute: string): Promise<Ajout> {
  const url = normaliserUrl(urlBrute);
  if (!url) return { issue: "adresse-invalide" };

  const [deja] = await db
    .select({ id: calendriersAbonnes.id })
    .from(calendriersAbonnes)
    .where(eq(calendriersAbonnes.url, url))
    .limit(1);
  if (deja) return { issue: "deja-la" };

  const [cree] = await db
    .insert(calendriersAbonnes)
    .values({ url, ajouteLe: aujourdhui() })
    .returning({ id: calendriersAbonnes.id });

  if (!cree) return { issue: "adresse-invalide" };
  return { issue: "fait", id: cree.id };
}

export async function retirerCalendrier(id: number): Promise<boolean> {
  const partis = await db
    .delete(calendriersAbonnes)
    .where(eq(calendriersAbonnes.id, id))
    .returning({ id: calendriersAbonnes.id });
  return partis.length > 0;
}

export async function basculerCalendrier(id: number, actif: boolean): Promise<void> {
  await db.update(calendriersAbonnes).set({ actif }).where(eq(calendriersAbonnes.id, id));
}

/* ────────────────────── Relecture ────────────────────── */

export type Relecture = {
  id: number;
  nom: string;
  occurrences: number;
  reglesIgnorees: number;
  erreur: string | null;
};

const TAILLE_MAX = 12 * 1024 * 1024;
const LOT = 400;

/**
 * Relit un calendrier et remplace ses occurrences.
 *
 * L'écriture est un remplacement complet de la fenêtre, pas une fusion : un
 * cours supprimé chez Apple doit disparaître ici, et rapprocher ligne à ligne
 * deux déroulés coûterait plus cher que de tout réécrire.
 *
 * Aucune erreur n'est levée : elle est consignée sur la ligne du calendrier et
 * rendue à l'appelant. Un flux injoignable ne doit pas empêcher les autres
 * d'être relus, ni faire échouer le cron.
 */
export async function relireCalendrier(
  calendrier: CalendrierAbonne,
  date = aujourdhui(),
): Promise<Relecture> {
  const bornes = fenetre(date);
  const maintenant = new Date().toISOString();

  const echouer = async (erreur: string): Promise<Relecture> => {
    await db
      .update(calendriersAbonnes)
      .set({ derniereMaj: maintenant, dernierResultat: erreur.slice(0, 300) })
      .where(eq(calendriersAbonnes.id, calendrier.id));
    return {
      id: calendrier.id,
      nom: calendrier.nom,
      occurrences: 0,
      reglesIgnorees: 0,
      erreur,
    };
  };

  let contenu: string;
  try {
    const reponse = await fetch(calendrier.url, {
      redirect: "follow",
      headers: { accept: "text/calendar, text/plain, */*" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!reponse.ok) {
      return echouer(`Le serveur répond ${reponse.status} ${reponse.statusText}.`);
    }
    contenu = await reponse.text();
  } catch (erreur) {
    return echouer(
      `Impossible d'aller chercher le calendrier : ${
        erreur instanceof Error ? erreur.message : String(erreur)
      }`,
    );
  }

  if (contenu.length > TAILLE_MAX) {
    return echouer("Le fichier dépasse 12 Mo : il ne ressemble pas à un calendrier.");
  }
  if (!contenu.includes("BEGIN:VCALENDAR")) {
    return echouer(
      "Ce n'est pas un calendrier iCalendar. Vérifie que l'adresse est bien celle d'un calendrier publié.",
    );
  }

  let deroule: ReturnType<typeof derouler_calendrier>;
  try {
    deroule = derouler_calendrier(contenu, FUSEAU, bornes);
  } catch (erreur) {
    return echouer(
      `Lecture impossible : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    );
  }

  // Le classement se fait à l'écriture, pas à l'affichage : ainsi la couleur
  // d'un bloc ne change pas sous les yeux quand on modifie une règle, et le
  // bouton « relire » suffit à tout reclasser d'un coup.
  const regles = await chargerRegles();

  await db
    .delete(evenementsImportes)
    .where(eq(evenementsImportes.calendrierId, calendrier.id));

  for (let i = 0; i < deroule.occurrences.length; i += LOT) {
    await db.insert(evenementsImportes).values(
      deroule.occurrences.slice(i, i + LOT).map((o) => ({
        calendrierId: calendrier.id,
        uid: o.uid.slice(0, 200),
        titre: o.titre.slice(0, 200),
        date: o.date,
        debut: `${o.debut}:00`,
        fin: `${o.fin}:00`,
        journeeEntiere: o.journeeEntiere,
        categorie: classer(o.titre, regles),
      })),
    );
  }

  await db
    .update(calendriersAbonnes)
    .set({
      nom: calendrier.nom || deroule.nomCalendrier.slice(0, 120) || "Calendrier",
      derniereMaj: maintenant,
      dernierResultat: "",
      nbOccurrences: deroule.occurrences.length,
      reglesIgnorees: deroule.reglesIgnorees,
    })
    .where(eq(calendriersAbonnes.id, calendrier.id));

  return {
    id: calendrier.id,
    nom: deroule.nomCalendrier,
    occurrences: deroule.occurrences.length,
    reglesIgnorees: deroule.reglesIgnorees,
    erreur: null,
  };
}

/**
 * La relecture est-elle due ?
 *
 * Le déclencheur planifié peut désormais passer très souvent — les rappels de
 * prière le demandent — et aller rechercher tous les flux à chaque passage
 * serait du gaspillage pur : un emploi du temps ne bouge pas toutes les quinze
 * minutes. La dernière relecture est déjà consignée sur la ligne du calendrier,
 * il suffit de la lire.
 */
export async function relectureDue(heures = 6, maintenant = Date.now()): Promise<boolean> {
  const lignes = await db
    .select({ derniereMaj: calendriersAbonnes.derniereMaj })
    .from(calendriersAbonnes)
    .where(eq(calendriersAbonnes.actif, true));

  if (lignes.length === 0) return false;

  return lignes.some((l) => {
    if (!l.derniereMaj) return true;
    const quand = Date.parse(l.derniereMaj);
    if (Number.isNaN(quand)) return true;
    return maintenant - quand >= heures * 3600_000;
  });
}

/** Relit tous les calendriers actifs. Appelé par le cron et par l'écran. */
export async function relireTout(date = aujourdhui()): Promise<Relecture[]> {
  const actifs = await db
    .select()
    .from(calendriersAbonnes)
    .where(eq(calendriersAbonnes.actif, true));

  const sorties: Relecture[] = [];
  for (const calendrier of actifs) {
    sorties.push(await relireCalendrier(calendrier, date));
  }
  return sorties;
}

/* ────────────────────── Lecture ────────────────────── */

/** Les occurrences importées d'une plage de dates, calendriers actifs seuls. */
export async function importesEntre(
  debut: string,
  fin: string,
): Promise<EvenementImporte[]> {
  return db
    .select({
      id: evenementsImportes.id,
      calendrierId: evenementsImportes.calendrierId,
      uid: evenementsImportes.uid,
      titre: evenementsImportes.titre,
      categorie: evenementsImportes.categorie,
      date: evenementsImportes.date,
      debut: evenementsImportes.debut,
      fin: evenementsImportes.fin,
      journeeEntiere: evenementsImportes.journeeEntiere,
    })
    .from(evenementsImportes)
    .innerJoin(
      calendriersAbonnes,
      eq(evenementsImportes.calendrierId, calendriersAbonnes.id),
    )
    .where(
      and(
        eq(calendriersAbonnes.actif, true),
        gte(evenementsImportes.date, debut),
        lte(evenementsImportes.date, fin),
      ),
    )
    .orderBy(asc(evenementsImportes.date), asc(evenementsImportes.debut));
}
