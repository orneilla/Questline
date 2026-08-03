import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  cartes,
  espaces,
  medias,
  paquets,
  reglagesCartes,
  revisions,
  type EtatCarte,
  type TypeCarte,
} from "@/db/schema";
import { aujourdhui } from "@/lib/dates";
import { engendrer, type CarteEngendree } from "./generation";

/**
 * Écriture du module cartes : notes, paquets, espaces, images.
 *
 * Le principe qui gouverne ce fichier : modifier une note ne doit jamais coûter
 * la mémoire des cartes qu'elle a déjà engendrées. On retrouve donc chaque
 * carte existante par son couple (groupe, repère), on la met à jour en place,
 * et on ne supprime que ce qui a réellement disparu de la note.
 */

export type SaisieNote = {
  paquetId: number;
  recto: string;
  verso: string;
  type: TypeCarte;
  notes: string;
  tags: string[];
};

export type NoteChargee = {
  /** Identifiant de la carte par laquelle la note a été ouverte. */
  carteId: number;
  cle: string | null;
  paquetId: number;
  paquetNom: string;
  espaceNom: string;
  recto: string;
  verso: string;
  type: TypeCarte;
  notes: string;
  tags: string[];
  suspendue: boolean;
  etat: EtatCarte;
  prochaineDate: string | null;
  passages: number;
  /** Nombre de cartes engendrées par la même note. */
  fratrie: number;
  /** Vrai si la note d'origine n'a pas été conservée (cartes d'avant l'éditeur). */
  heritee: boolean;
};

function nettoyer(texte: string, maximum = 20_000): string {
  return texte.replace(/\r\n/g, "\n").trim().slice(0, maximum);
}

function nettoyerTags(bruts: string[]): string[] {
  const vus = new Set<string>();
  for (const brut of bruts) {
    const tag = brut.trim().replace(/\s+/g, "-").slice(0, 40);
    if (tag) vus.add(tag);
    if (vus.size >= 12) break;
  }
  return [...vus];
}

/** Une clé de groupe qui ne dépend d'aucun compteur partagé. */
function nouvelleCle(): string {
  return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function engendrerDepuis(saisie: SaisieNote, cle: string): CarteEngendree[] {
  return engendrer({
    cle,
    recto: nettoyer(saisie.recto),
    verso: nettoyer(saisie.verso),
    type: saisie.type,
    notes: nettoyer(saisie.notes, 4_000),
    tags: nettoyerTags(saisie.tags),
  });
}

/* ─────────────────────────────── Notes ─────────────────────────────── */

export async function creerNote(
  saisie: SaisieNote,
): Promise<{ cle: string; creees: number }> {
  const cle = nouvelleCle();
  const engendrees = engendrerDepuis(saisie, cle);
  if (engendrees.length === 0) throw new Error("La note ne produit aucune carte.");

  const jour = aujourdhui();
  const source = { recto: nettoyer(saisie.recto), verso: nettoyer(saisie.verso) };

  await db.insert(cartes).values(
    engendrees.map((c) => ({
      paquetId: saisie.paquetId,
      recto: c.recto,
      verso: c.verso,
      type: c.type,
      notes: c.notes,
      tags: c.tags,
      sourceCle: c.sourceCle,
      sourceRecto: source.recto,
      sourceVerso: source.verso,
      sourceIndex: c.index,
      creeLe: jour,
      modifieLe: jour,
    })),
  );

  return { cle, creees: engendrees.length };
}

export async function chargerNote(carteId: number): Promise<NoteChargee | null> {
  const [ligne] = await db
    .select({
      id: cartes.id,
      paquetId: cartes.paquetId,
      paquetNom: paquets.nom,
      espaceNom: espaces.nom,
      recto: cartes.recto,
      verso: cartes.verso,
      sourceRecto: cartes.sourceRecto,
      sourceVerso: cartes.sourceVerso,
      sourceCle: cartes.sourceCle,
      type: cartes.type,
      notes: cartes.notes,
      tags: cartes.tags,
      suspendue: cartes.suspendue,
      etat: cartes.etat,
      prochaineDate: cartes.prochaineDate,
    })
    .from(cartes)
    .innerJoin(paquets, eq(cartes.paquetId, paquets.id))
    .innerJoin(espaces, eq(paquets.espaceId, espaces.id))
    .where(eq(cartes.id, carteId))
    .limit(1);

  if (!ligne) return null;

  const [passages] = await db
    .select({ combien: count() })
    .from(revisions)
    .where(eq(revisions.carteId, carteId));

  const fratrie = ligne.sourceCle
    ? ((
        await db
          .select({ combien: count() })
          .from(cartes)
          .where(eq(cartes.sourceCle, ligne.sourceCle))
      )[0]?.combien ?? 1)
    : 1;

  const heritee = ligne.sourceRecto === null;

  return {
    carteId: ligne.id,
    cle: ligne.sourceCle,
    paquetId: ligne.paquetId,
    paquetNom: ligne.paquetNom,
    espaceNom: ligne.espaceNom,
    // Une carte d'avant l'éditeur n'a pas de note : on édite alors sa face,
    // ce qui est exactement ce qu'elle est.
    recto: ligne.sourceRecto ?? ligne.recto,
    verso: ligne.sourceVerso ?? ligne.verso,
    type: ligne.type,
    notes: ligne.notes,
    tags: ligne.tags,
    suspendue: ligne.suspendue,
    etat: ligne.etat,
    prochaineDate: ligne.prochaineDate,
    passages: passages?.combien ?? 0,
    fratrie,
    heritee,
  };
}

export type ResultatModification = {
  misesAJour: number;
  ajoutees: number;
  retirees: number;
};

/**
 * Réécrit une note et réaccorde ses cartes.
 *
 * Les cartes dont le repère subsiste sont modifiées sur place : leur échéance,
 * leur stabilité et leur historique sont intacts. Seuls les trous réellement
 * supprimés de la note perdent leur carte.
 */
export async function modifierNote(
  carteId: number,
  saisie: SaisieNote,
): Promise<ResultatModification> {
  const [existante] = await db
    .select({ sourceCle: cartes.sourceCle })
    .from(cartes)
    .where(eq(cartes.id, carteId))
    .limit(1);
  if (!existante) throw new Error("Carte introuvable.");

  const cle = existante.sourceCle ?? nouvelleCle();
  const engendrees = engendrerDepuis(saisie, cle);
  if (engendrees.length === 0) throw new Error("La note ne produit aucune carte.");

  const jour = aujourdhui();
  const source = { recto: nettoyer(saisie.recto), verso: nettoyer(saisie.verso) };

  const groupe = existante.sourceCle
    ? await db
        .select({ id: cartes.id, sourceIndex: cartes.sourceIndex })
        .from(cartes)
        .where(eq(cartes.sourceCle, existante.sourceCle))
        .orderBy(asc(cartes.sourceIndex), asc(cartes.id))
    : [{ id: carteId, sourceIndex: 0 }];

  const parRepere = new Map<number, number>();
  for (const carte of groupe) {
    if (!parRepere.has(carte.sourceIndex)) parRepere.set(carte.sourceIndex, carte.id);
  }
  // La carte ouverte reprend le premier repère si elle n'en avait pas encore un
  // qui corresponde : sans cela, modifier une carte héritée en créerait une autre.
  if (!engendrees.some((c) => parRepere.get(c.index) === carteId)) {
    const premier = engendrees[0];
    if (!parRepere.has(premier.index)) parRepere.set(premier.index, carteId);
  }

  let misesAJour = 0;
  let ajoutees = 0;
  const conserves = new Set<number>();

  for (const engendree of engendrees) {
    const id = parRepere.get(engendree.index);
    const valeurs = {
      paquetId: saisie.paquetId,
      recto: engendree.recto,
      verso: engendree.verso,
      type: engendree.type,
      notes: engendree.notes,
      tags: engendree.tags,
      sourceCle: cle,
      sourceRecto: source.recto,
      sourceVerso: source.verso,
      sourceIndex: engendree.index,
      modifieLe: jour,
    };

    if (id !== undefined) {
      await db.update(cartes).set(valeurs).where(eq(cartes.id, id));
      conserves.add(id);
      misesAJour += 1;
    } else {
      await db.insert(cartes).values({ ...valeurs, creeLe: jour });
      ajoutees += 1;
    }
  }

  const aRetirer = groupe.map((c) => c.id).filter((id) => !conserves.has(id));
  if (aRetirer.length > 0) {
    await db.delete(cartes).where(inArray(cartes.id, aRetirer));
  }

  return { misesAJour, ajoutees, retirees: aRetirer.length };
}

/** Supprime une carte, ou tout son groupe si la note en a engendré plusieurs. */
export async function supprimerNote(
  carteId: number,
  toutLeGroupe: boolean,
): Promise<number> {
  const [carte] = await db
    .select({ sourceCle: cartes.sourceCle })
    .from(cartes)
    .where(eq(cartes.id, carteId))
    .limit(1);
  if (!carte) return 0;

  if (toutLeGroupe && carte.sourceCle) {
    const groupe = await db
      .select({ id: cartes.id })
      .from(cartes)
      .where(eq(cartes.sourceCle, carte.sourceCle));
    await db.delete(cartes).where(eq(cartes.sourceCle, carte.sourceCle));
    return groupe.length;
  }

  await db.delete(cartes).where(eq(cartes.id, carteId));
  return 1;
}

export async function deplacerCartes(ids: number[], paquetId: number): Promise<number> {
  if (ids.length === 0) return 0;
  await db
    .update(cartes)
    .set({ paquetId, modifieLe: aujourdhui() })
    .where(inArray(cartes.id, ids));
  return ids.length;
}

export async function suspendreCarte(
  carteId: number,
  suspendue: boolean,
): Promise<void> {
  await db
    .update(cartes)
    .set({ suspendue, modifieLe: aujourdhui() })
    .where(eq(cartes.id, carteId));
}

/* ────────────────────────────── Recherche ────────────────────────────── */

export type ResultatCarte = {
  id: number;
  recto: string;
  verso: string;
  type: TypeCarte;
  etat: EtatCarte;
  suspendue: boolean;
  prochaineDate: string | null;
  paquetId: number;
  paquetNom: string;
  espaceNom: string;
  couleur: string;
  tags: string[];
};

export type Filtres = {
  texte?: string;
  paquetId?: number | null;
  etat?: EtatCarte | null;
  /** « seules » ne montre que les suspendues, « sans » les exclut. */
  suspendues?: "avec" | "sans" | "seules";
  limite?: number;
};

/** Recherche plein texte simple, insensible à la casse et aux accents absents. */
export async function chercherCartes(filtres: Filtres): Promise<ResultatCarte[]> {
  const conditions = [];
  const texte = (filtres.texte ?? "").trim();

  if (texte) {
    const motif = `%${texte.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${cartes.recto})`, motif),
        like(sql`lower(${cartes.verso})`, motif),
        like(sql`lower(${cartes.notes})`, motif),
        like(sql`lower(array_to_string(${cartes.tags}, ' '))`, motif),
      ),
    );
  }

  if (filtres.paquetId) conditions.push(eq(cartes.paquetId, filtres.paquetId));
  if (filtres.etat) conditions.push(eq(cartes.etat, filtres.etat));
  if (filtres.suspendues === "sans") conditions.push(eq(cartes.suspendue, false));
  if (filtres.suspendues === "seules") conditions.push(eq(cartes.suspendue, true));

  return db
    .select({
      id: cartes.id,
      recto: cartes.recto,
      verso: cartes.verso,
      type: cartes.type,
      etat: cartes.etat,
      suspendue: cartes.suspendue,
      prochaineDate: cartes.prochaineDate,
      paquetId: cartes.paquetId,
      paquetNom: paquets.nom,
      espaceNom: espaces.nom,
      couleur: espaces.couleur,
      tags: cartes.tags,
    })
    .from(cartes)
    .innerJoin(paquets, eq(cartes.paquetId, paquets.id))
    .innerJoin(espaces, eq(paquets.espaceId, espaces.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(cartes.modifieLe), desc(cartes.id))
    .limit(Math.min(filtres.limite ?? 60, 200));
}

/* ───────────────────────── Espaces et paquets ───────────────────────── */

export type PaquetListe = {
  id: number;
  nom: string;
  espaceId: number;
  parentId: number | null;
  ordre: number;
  couverture: string | null;
  cartes: number;
};

export type EspaceListe = {
  id: number;
  nom: string;
  couleur: string;
  ordre: number;
  paquets: PaquetListe[];
};

export async function chargerArborescence(): Promise<EspaceListe[]> {
  const [listeEspaces, listePaquets, comptes] = await Promise.all([
    db.select().from(espaces).orderBy(asc(espaces.ordre), asc(espaces.id)),
    db.select().from(paquets).orderBy(asc(paquets.ordre), asc(paquets.id)),
    db
      .select({ paquetId: cartes.paquetId, combien: count() })
      .from(cartes)
      .groupBy(cartes.paquetId),
  ]);

  const parPaquet = new Map(comptes.map((c) => [c.paquetId, c.combien]));

  return listeEspaces.map((espace) => ({
    id: espace.id,
    nom: espace.nom,
    couleur: espace.couleur,
    ordre: espace.ordre,
    paquets: listePaquets
      .filter((p) => p.espaceId === espace.id)
      .map((p) => ({
        id: p.id,
        nom: p.nom,
        espaceId: p.espaceId,
        parentId: p.parentId,
        ordre: p.ordre,
        couverture: p.couverture,
        cartes: parPaquet.get(p.id) ?? 0,
      })),
  }));
}

export async function creerEspace(nom: string, couleur: string): Promise<number> {
  const [dernier] = await db
    .select({ ordre: espaces.ordre })
    .from(espaces)
    .orderBy(desc(espaces.ordre))
    .limit(1);

  const [cree] = await db
    .insert(espaces)
    .values({ nom: nom.slice(0, 60), couleur, ordre: (dernier?.ordre ?? 0) + 1 })
    .returning({ id: espaces.id });

  return cree.id;
}

export async function modifierEspace(
  id: number,
  nom: string,
  couleur: string,
): Promise<void> {
  await db
    .update(espaces)
    .set({ nom: nom.slice(0, 60), couleur })
    .where(eq(espaces.id, id));
}

/** Nombre de cartes qu'une suppression d'espace emporterait. */
export async function poidsEspace(id: number): Promise<{ paquets: number; cartes: number }> {
  const liste = await db
    .select({ id: paquets.id })
    .from(paquets)
    .where(eq(paquets.espaceId, id));

  if (liste.length === 0) return { paquets: 0, cartes: 0 };

  const [ligne] = await db
    .select({ combien: count() })
    .from(cartes)
    .where(inArray(cartes.paquetId, liste.map((p) => p.id)));

  return { paquets: liste.length, cartes: ligne?.combien ?? 0 };
}

export async function supprimerEspace(id: number): Promise<void> {
  await db.delete(espaces).where(eq(espaces.id, id));
}

export async function creerPaquet(entree: {
  espaceId: number;
  parentId: number | null;
  nom: string;
}): Promise<number> {
  const [dernier] = await db
    .select({ ordre: paquets.ordre })
    .from(paquets)
    .where(eq(paquets.espaceId, entree.espaceId))
    .orderBy(desc(paquets.ordre))
    .limit(1);

  const [cree] = await db
    .insert(paquets)
    .values({
      espaceId: entree.espaceId,
      parentId: entree.parentId,
      nom: entree.nom.slice(0, 80),
      ordre: (dernier?.ordre ?? 0) + 1,
    })
    .returning({ id: paquets.id });

  return cree.id;
}

/**
 * Renomme, déplace, recouvre. Déplacer un paquet vers un autre espace y
 * emmène ses cartes : elles vivent dans le paquet, pas dans l'espace.
 */
export async function modifierPaquet(
  id: number,
  entree: {
    nom?: string;
    espaceId?: number;
    parentId?: number | null;
    couverture?: string | null;
  },
): Promise<void> {
  if (entree.parentId !== undefined && entree.parentId !== null) {
    if (entree.parentId === id) throw new Error("Un paquet ne peut pas se contenir.");
    if (await descendDe(entree.parentId, id)) {
      throw new Error("Ce déplacement créerait une boucle.");
    }
  }

  await db
    .update(paquets)
    .set({
      ...(entree.nom !== undefined ? { nom: entree.nom.slice(0, 80) } : {}),
      ...(entree.espaceId !== undefined ? { espaceId: entree.espaceId } : {}),
      ...(entree.parentId !== undefined ? { parentId: entree.parentId } : {}),
      ...(entree.couverture !== undefined ? { couverture: entree.couverture } : {}),
    })
    .where(eq(paquets.id, id));
}

/** Vrai si `candidat` se trouve quelque part sous `ancetre`. */
async function descendDe(candidat: number, ancetre: number): Promise<boolean> {
  const tous = await db.select({ id: paquets.id, parentId: paquets.parentId }).from(paquets);
  const parents = new Map(tous.map((p) => [p.id, p.parentId]));

  let courant: number | null = candidat;
  // Les paquets sont peu nombreux ; la garde protège d'une donnée déjà bouclée.
  for (let pas = 0; pas < 64 && courant !== null; pas += 1) {
    if (courant === ancetre) return true;
    courant = parents.get(courant) ?? null;
  }
  return false;
}

export async function poidsPaquet(id: number): Promise<number> {
  const [ligne] = await db
    .select({ combien: count() })
    .from(cartes)
    .where(eq(cartes.paquetId, id));
  return ligne?.combien ?? 0;
}

export async function supprimerPaquet(id: number): Promise<void> {
  // Les sous-paquets remontent d'un cran plutôt que de disparaître en silence.
  await db.update(paquets).set({ parentId: null }).where(eq(paquets.parentId, id));
  await db.delete(paquets).where(eq(paquets.id, id));
}

/* ──────────────────────────────- Images ──────────────────────────────- */

export const POIDS_MAX_IMAGE = 400 * 1024;

export async function enregistrerMedia(entree: {
  nom: string;
  typeMime: string;
  base64: string;
  largeur: number;
  hauteur: number;
}): Promise<{ id: number; octets: number }> {
  const octets = Math.round((entree.base64.length * 3) / 4);
  if (octets > POIDS_MAX_IMAGE) {
    throw new Error(
      `Image trop lourde : ${Math.round(octets / 1024)} Ko, la limite est de ${POIDS_MAX_IMAGE / 1024} Ko.`,
    );
  }

  const [cree] = await db
    .insert(medias)
    .values({
      nom: entree.nom.slice(0, 120),
      typeMime: entree.typeMime,
      octets,
      largeur: entree.largeur,
      hauteur: entree.hauteur,
      donnees: entree.base64,
      creeLe: aujourdhui(),
    })
    .returning({ id: medias.id });

  return { id: cree.id, octets };
}

export async function lireMedia(
  id: number,
): Promise<{ typeMime: string; donnees: string } | null> {
  const [ligne] = await db
    .select({ typeMime: medias.typeMime, donnees: medias.donnees })
    .from(medias)
    .where(eq(medias.id, id))
    .limit(1);
  return ligne ?? null;
}

/* ───────────────────────────── Réglages ───────────────────────────── */

export type ReglagesModifiables = {
  delaiEncoreMin: number;
  delaiDifficileMin: number;
  retentionCible: number;
  nouvellesParJour: number;
  maximumParJour: number;
};

export async function enregistrerReglages(valeurs: ReglagesModifiables): Promise<void> {
  const [existant] = await db.select({ id: reglagesCartes.id }).from(reglagesCartes).limit(1);

  if (existant) {
    await db.update(reglagesCartes).set(valeurs).where(eq(reglagesCartes.id, existant.id));
    return;
  }
  await db.insert(reglagesCartes).values({ id: 1, ...valeurs });
}

/* ──────────────────────── Place occupée, archivage ──────────────────────── */

export type EtatBase = {
  /** Taille de la base entière, en octets. Nulle si Postgres refuse de la dire. */
  octetsBase: number | null;
  cartes: number;
  revisions: number;
  medias: number;
  octetsMedias: number;
  imagesOrphelines: number;
  /** Date de la plus ancienne révision conservée. */
  plusAncienneRevision: string | null;
};

/** Palier gratuit de Neon : 512 Mo de stockage. */
export const QUOTA_NEON_OCTETS = 512 * 1024 * 1024;

export async function etatBase(): Promise<EtatBase> {
  const [taille, nbCartes, nbRevisions, mediasResume, plusAncienne, orphelines] =
    await Promise.all([
      db
        .execute(sql`select pg_database_size(current_database()) as octets`)
        .then((r) => {
          const lignes = (r as unknown as { rows?: { octets: unknown }[] }).rows ?? r;
          const premiere = Array.isArray(lignes) ? lignes[0] : undefined;
          const brut = (premiere as { octets?: unknown } | undefined)?.octets;
          return brut === undefined || brut === null ? null : Number(brut);
        })
        // Certains hébergeurs refusent cette fonction : l'écran s'en passe.
        .catch(() => null),
      db.select({ combien: count() }).from(cartes),
      db.select({ combien: count() }).from(revisions),
      db
        .select({
          combien: count(),
          octets: sql<number>`coalesce(sum(${medias.octets}), 0)`,
        })
        .from(medias),
      db
        .select({ jour: revisions.date })
        .from(revisions)
        .orderBy(asc(revisions.date))
        .limit(1),
      db
        .select({ combien: count() })
        .from(medias)
        .where(
          sql`not exists (select 1 from ${cartes} c where c.recto like '%/api/cartes/media/' || ${medias.id} || '.%' or c.verso like '%/api/cartes/media/' || ${medias.id} || '.%' or coalesce(c.source_recto, '') like '%/api/cartes/media/' || ${medias.id} || '.%' or coalesce(c.source_verso, '') like '%/api/cartes/media/' || ${medias.id} || '.%')`,
        ),
    ]);

  return {
    octetsBase: taille,
    cartes: nbCartes[0]?.combien ?? 0,
    revisions: nbRevisions[0]?.combien ?? 0,
    medias: mediasResume[0]?.combien ?? 0,
    octetsMedias: Number(mediasResume[0]?.octets ?? 0),
    imagesOrphelines: orphelines[0]?.combien ?? 0,
    plusAncienneRevision: plusAncienne[0]?.jour ?? null,
  };
}

/**
 * Allège l'historique sans toucher aux échéances.
 *
 * La dernière révision de chaque carte est toujours conservée : c'est elle qui
 * dit à FSRS combien de temps s'est écoulé. Ce qui se perd, ce sont les
 * révisions anciennes, utiles seulement pour réoptimiser les poids un jour.
 */
export async function archiverRevisions(avant: string): Promise<number> {
  const resultat = await db
    .delete(revisions)
    .where(
      and(
        sql`${revisions.date} < ${avant}`,
        sql`${revisions.id} <> (select r2.id from ${revisions} r2 where r2.carte_id = ${revisions.carteId} order by r2.vue_le desc limit 1)`,
      ),
    )
    .returning({ id: revisions.id });

  return resultat.length;
}

/** Efface les images qu'aucune carte ne cite plus. */
export async function purgerImagesOrphelines(): Promise<number> {
  const resultat = await db
    .delete(medias)
    .where(
      sql`not exists (select 1 from ${cartes} c where c.recto like '%/api/cartes/media/' || ${medias.id} || '.%' or c.verso like '%/api/cartes/media/' || ${medias.id} || '.%' or coalesce(c.source_recto, '') like '%/api/cartes/media/' || ${medias.id} || '.%' or coalesce(c.source_verso, '') like '%/api/cartes/media/' || ${medias.id} || '.%')`,
    )
    .returning({ id: medias.id });

  return resultat.length;
}

/* ─────────────────────────── Export, import ─────────────────────────── */

export type LigneExport = {
  id: number;
  espace: string;
  paquet: string;
  recto: string;
  verso: string;
  type: TypeCarte;
  notes: string;
  tags: string[];
  etat: EtatCarte;
  prochaineDate: string | null;
  stabilite: number;
  difficulte: number;
  rechutes: number;
  suspendue: boolean;
  creeLe: string;
};

export async function exporterCartes(): Promise<LigneExport[]> {
  return db
    .select({
      id: cartes.id,
      espace: espaces.nom,
      paquet: paquets.nom,
      recto: cartes.recto,
      verso: cartes.verso,
      type: cartes.type,
      notes: cartes.notes,
      tags: cartes.tags,
      etat: cartes.etat,
      prochaineDate: cartes.prochaineDate,
      stabilite: cartes.stabilite,
      difficulte: cartes.difficulte,
      rechutes: cartes.rechutes,
      suspendue: cartes.suspendue,
      creeLe: cartes.creeLe,
    })
    .from(cartes)
    .innerJoin(paquets, eq(cartes.paquetId, paquets.id))
    .innerJoin(espaces, eq(paquets.espaceId, espaces.id))
    .orderBy(asc(espaces.ordre), asc(paquets.ordre), asc(cartes.id));
}

/** Cartes jamais vues d'un paquet : ce qu'un import vient d'ajouter. */
export async function comptesPaquet(
  paquetId: number,
): Promise<{ total: number; nouvelles: number }> {
  const [total, nouvelles] = await Promise.all([
    db.select({ combien: count() }).from(cartes).where(eq(cartes.paquetId, paquetId)),
    db
      .select({ combien: count() })
      .from(cartes)
      .where(and(eq(cartes.paquetId, paquetId), isNull(cartes.prochaineDate))),
  ]);
  return { total: total[0]?.combien ?? 0, nouvelles: nouvelles[0]?.combien ?? 0 };
}

export async function importerCartes(
  paquetId: number,
  lignes: { recto: string; verso: string; tags?: string[] }[],
): Promise<number> {
  const jour = aujourdhui();
  const retenues = lignes
    .map((l) => ({
      recto: nettoyer(l.recto),
      verso: nettoyer(l.verso),
      tags: nettoyerTags(l.tags ?? []),
    }))
    .filter((l) => l.recto.length > 0);

  if (retenues.length === 0) return 0;

  // Par paquets de cent : une seule requête de mille lignes dépasse la limite
  // de taille d'une requête HTTP Neon.
  for (let debut = 0; debut < retenues.length; debut += 100) {
    const tranche = retenues.slice(debut, debut + 100);
    await db.insert(cartes).values(
      tranche.map((l) => {
        const cle = nouvelleCle();
        return {
          paquetId,
          recto: l.recto,
          verso: l.verso,
          type: "recto_verso" as const,
          notes: "",
          tags: l.tags,
          sourceCle: cle,
          sourceRecto: l.recto,
          sourceVerso: l.verso,
          sourceIndex: 0,
          creeLe: jour,
          modifieLe: jour,
        };
      }),
    );
  }

  return retenues.length;
}
