import "server-only";

import { and, asc, count, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  cartes,
  espaces,
  paquets,
  reglagesCartes,
  revisions,
  sessionsRevision,
  type EtatCarte,
} from "@/db/schema";
import { aujourdhui, decalerJours } from "@/lib/dates";
import { etatDepuisIntervalle, planifier, type Notation, type ReglagesFsrs } from "./fsrs";

/**
 * Accès aux données du module cartes.
 *
 * Deux exigences guident ce fichier : ne jamais tout charger — la table des
 * révisions grossira indéfiniment — et n'écrire une notation qu'en un seul
 * bloc, l'historique et l'état de la carte devant rester cohérents.
 */

/** Plafond de cartes chargées d'un coup pour une session. */
export const TAILLE_SESSION_MAX = 200;

export type ReglagesComplets = {
  delaiEncoreMin: number;
  delaiDifficileMin: number;
  retentionCible: number;
  poidsFsrs: number[];
  nouvellesParJour: number;
  maximumParJour: number;
};

const DEFAUTS: ReglagesComplets = {
  delaiEncoreMin: 1,
  delaiDifficileMin: 6,
  retentionCible: 0.9,
  poidsFsrs: [],
  nouvellesParJour: 20,
  maximumParJour: 200,
};

export async function chargerReglages(): Promise<ReglagesComplets> {
  const [ligne] = await db.select().from(reglagesCartes).limit(1);
  if (!ligne) return DEFAUTS;
  return {
    delaiEncoreMin: ligne.delaiEncoreMin,
    delaiDifficileMin: ligne.delaiDifficileMin,
    retentionCible: ligne.retentionCible,
    poidsFsrs: ligne.poidsFsrs,
    nouvellesParJour: ligne.nouvellesParJour,
    maximumParJour: ligne.maximumParJour,
  };
}

export type CarteSession = {
  id: number;
  recto: string;
  verso: string;
  type: string;
  notes: string;
  etat: EtatCarte;
  stabilite: number;
  difficulte: number;
  rechutes: number;
  derniereRevision: string | null;
  passages: number;
};

/** Tous les paquets descendant d'un paquet, lui compris. */
async function sousArbre(paquetId: number): Promise<number[]> {
  const tous = await db
    .select({ id: paquets.id, parentId: paquets.parentId })
    .from(paquets);

  const retenus = new Set<number>([paquetId]);
  let ajoute = true;
  while (ajoute) {
    ajoute = false;
    for (const p of tous) {
      if (p.parentId !== null && retenus.has(p.parentId) && !retenus.has(p.id)) {
        retenus.add(p.id);
        ajoute = true;
      }
    }
  }
  return [...retenus];
}

/**
 * Les cartes à réviser : celles échues, puis des nouvelles dans la limite du
 * jour. La requête s'appuie sur l'index (paquet, suspendue, prochaineDate).
 */
export async function chargerSession(
  paquetId: number | null,
  date = aujourdhui(),
): Promise<{ cartes: CarteSession[]; reglages: ReglagesComplets }> {
  const reglages = await chargerReglages();
  const ids = paquetId === null ? null : await sousArbre(paquetId);

  const portee = ids ? inArray(cartes.paquetId, ids) : undefined;
  const nonSuspendue = eq(cartes.suspendue, false);

  const champs = {
    id: cartes.id,
    recto: cartes.recto,
    verso: cartes.verso,
    type: cartes.type,
    notes: cartes.notes,
    etat: cartes.etat,
    stabilite: cartes.stabilite,
    difficulte: cartes.difficulte,
    rechutes: cartes.rechutes,
    prochaineDate: cartes.prochaineDate,
  };

  const dues = await db
    .select(champs)
    .from(cartes)
    .where(and(portee, nonSuspendue, lte(cartes.prochaineDate, date)))
    .orderBy(asc(cartes.prochaineDate), asc(cartes.id))
    .limit(reglages.maximumParJour);

  const placesRestantes = Math.max(
    0,
    Math.min(reglages.nouvellesParJour, TAILLE_SESSION_MAX - dues.length),
  );

  const nouvelles =
    placesRestantes === 0
      ? []
      : await db
          .select(champs)
          .from(cartes)
          .where(and(portee, nonSuspendue, isNull(cartes.prochaineDate)))
          .orderBy(asc(cartes.id))
          .limit(placesRestantes);

  const toutes = [...dues, ...nouvelles];
  const derniere = await dernieresRevisions(toutes.map((c) => c.id));

  return {
    reglages,
    cartes: toutes.map((c) => ({
      id: c.id,
      recto: c.recto,
      verso: c.verso,
      type: c.type,
      notes: c.notes,
      etat: c.etat,
      stabilite: c.stabilite,
      difficulte: c.difficulte,
      rechutes: c.rechutes,
      derniereRevision: derniere.get(c.id)?.vueLe ?? null,
      passages: derniere.get(c.id)?.passages ?? 0,
    })),
  };
}

async function dernieresRevisions(
  carteIds: number[],
): Promise<Map<number, { vueLe: string; passages: number }>> {
  if (carteIds.length === 0) return new Map();

  const lignes = await db
    .select({
      carteId: revisions.carteId,
      vueLe: sql<string>`max(${revisions.vueLe})`,
      passages: count(),
    })
    .from(revisions)
    .where(inArray(revisions.carteId, carteIds))
    .groupBy(revisions.carteId);

  return new Map(lignes.map((l) => [l.carteId, { vueLe: l.vueLe, passages: l.passages }]));
}

export type Notation1a4 = Notation;

/**
 * Enregistre une notation.
 *
 * L'insertion dans l'historique et la mise à jour de la carte forment un tout :
 * une carte dont l'état avancerait sans trace, ou l'inverse, corromprait le
 * calcul FSRS des années plus tard. Le pilote HTTP de Neon ne gère pas les
 * transactions ; on retombe alors sur une écriture ordonnée — historique
 * d'abord, puis carte — de sorte qu'une coupure laisse au pire une révision
 * enregistrée dont l'état n'a pas encore été reporté, ce qui reste réparable.
 */
export async function enregistrerNotation(entree: {
  carteId: number;
  note: Notation;
  dureeMs: number;
  maintenant?: Date;
}): Promise<{ intervalle: number; etat: EtatCarte }> {
  const maintenant = entree.maintenant ?? new Date();
  const date = aujourdhui(maintenant);
  const reglages = await chargerReglages();

  const [carte] = await db
    .select()
    .from(cartes)
    .where(eq(cartes.id, entree.carteId))
    .limit(1);
  if (!carte) throw new Error(`Carte ${entree.carteId} introuvable.`);

  const passages = await db
    .select({ combien: count() })
    .from(revisions)
    .where(eq(revisions.carteId, carte.id));

  const [derniere] = await db
    .select({ vueLe: revisions.vueLe })
    .from(revisions)
    .where(eq(revisions.carteId, carte.id))
    .orderBy(sql`${revisions.vueLe} desc`)
    .limit(1);

  const fsrsReglages: ReglagesFsrs = {
    retentionCible: reglages.retentionCible,
    poidsFsrs: reglages.poidsFsrs,
  };

  const plan = planifier(
    {
      stabilite: carte.stabilite,
      difficulte: carte.difficulte,
      derniereRevision: derniere ? new Date(derniere.vueLe) : null,
      rechutes: carte.rechutes,
      passages: passages[0]?.combien ?? 0,
    },
    entree.note,
    fsrsReglages,
    maintenant,
  );

  const prochaineDate = aujourdhui(plan.echeance);

  const ecrire = async () => {
    await db.insert(revisions).values({
      carteId: carte.id,
      date,
      vueLe: maintenant.toISOString(),
      note: entree.note,
      stabilite: plan.stabilite,
      difficulte: plan.difficulte,
      prochaineDate,
      intervalle: plan.intervalle,
      etat: plan.etat,
      duree: Math.min(entree.dureeMs, 3_600_000),
    });

    await db
      .update(cartes)
      .set({
        stabilite: plan.stabilite,
        difficulte: plan.difficulte,
        prochaineDate,
        etat: plan.etat,
        rechutes: carte.rechutes + (entree.note === 1 ? 1 : 0),
        modifieLe: date,
      })
      .where(eq(cartes.id, carte.id));
  };

  // `transaction` n'existe pas sur le pilote HTTP ; on s'en sert quand il est là.
  const avecTransaction = db as unknown as {
    transaction?: (f: (tx: unknown) => Promise<void>) => Promise<void>;
  };
  if (typeof avecTransaction.transaction === "function") {
    await avecTransaction.transaction(async () => ecrire());
  } else {
    await ecrire();
  }

  return { intervalle: plan.intervalle, etat: plan.etat };
}

export async function cloreSession(entree: {
  paquetId: number | null;
  cartesVues: number;
  dureeSecondes: number;
}): Promise<void> {
  await db.insert(sessionsRevision).values({
    date: aujourdhui(),
    paquetId: entree.paquetId,
    cartesVues: entree.cartesVues,
    duree: entree.dureeSecondes,
  });
}

/**
 * Ce qu'une journée de révision vaut au pilier « savoir ».
 *
 * Le gain est plafonné : une session de deux cents cartes ne doit pas valoir
 * dix fois une session de vingt. On récompense d'avoir ouvert le paquet, pas
 * d'avoir abattu du volume.
 */
export function gainSavoir(cartesVues: number): number {
  if (cartesVues <= 0) return 0;
  return Math.min(6, 2 + Math.floor(cartesVues / 20));
}

/* ────────────────────────────── Progression ────────────────────────────── */

export type RepartitionPaquet = {
  nouvelles: number;
  apprentissage: number;
  jeunes: number;
  mures: number;
  total: number;
  /** Part de cartes mûres : la maîtrise du paquet. */
  maitrise: number;
};

export type ResumePaquet = {
  id: number;
  nom: string;
  espaceId: number;
  espaceNom: string;
  couleur: string;
  parentId: number | null;
  couverture: string | null;
  repartition: RepartitionPaquet;
  duesAujourdhui: number;
  /** Jours depuis la dernière révision ; null si jamais révisé. */
  joursSansRevision: number | null;
};

export async function chargerPaquets(date = aujourdhui()): Promise<ResumePaquet[]> {
  const [listePaquets, parEtat, dues, dernieres] = await Promise.all([
    db
      .select({
        id: paquets.id,
        nom: paquets.nom,
        espaceId: paquets.espaceId,
        parentId: paquets.parentId,
        couverture: paquets.couverture,
        ordre: paquets.ordre,
        espaceNom: espaces.nom,
        couleur: espaces.couleur,
        espaceOrdre: espaces.ordre,
      })
      .from(paquets)
      .innerJoin(espaces, eq(paquets.espaceId, espaces.id))
      .orderBy(asc(espaces.ordre), asc(paquets.ordre), asc(paquets.id)),

    db
      .select({ paquetId: cartes.paquetId, etat: cartes.etat, combien: count() })
      .from(cartes)
      .where(eq(cartes.suspendue, false))
      .groupBy(cartes.paquetId, cartes.etat),

    db
      .select({ paquetId: cartes.paquetId, combien: count() })
      .from(cartes)
      .where(
        and(
          eq(cartes.suspendue, false),
          or(lte(cartes.prochaineDate, date), isNull(cartes.prochaineDate)),
        ),
      )
      .groupBy(cartes.paquetId),

    db
      .select({
        paquetId: cartes.paquetId,
        derniere: sql<string | null>`max(${revisions.date})`,
      })
      .from(revisions)
      .innerJoin(cartes, eq(revisions.carteId, cartes.id))
      .groupBy(cartes.paquetId),
  ]);

  const duesParPaquet = new Map(dues.map((d) => [d.paquetId, d.combien]));
  const dernieresParPaquet = new Map(dernieres.map((d) => [d.paquetId, d.derniere]));

  return listePaquets.map((p) => {
    const lignes = parEtat.filter((e) => e.paquetId === p.id);
    const compte = (etat: EtatCarte) =>
      lignes.find((l) => l.etat === etat)?.combien ?? 0;

    const nouvelles = compte("nouvelle");
    const apprentissage = compte("apprentissage");
    const jeunes = compte("jeune");
    const mures = compte("mure");
    const total = nouvelles + apprentissage + jeunes + mures;
    const derniere = dernieresParPaquet.get(p.id) ?? null;

    return {
      id: p.id,
      nom: p.nom,
      espaceId: p.espaceId,
      espaceNom: p.espaceNom,
      couleur: p.couleur,
      parentId: p.parentId,
      couverture: p.couverture,
      repartition: {
        nouvelles,
        apprentissage,
        jeunes,
        mures,
        total,
        maitrise: total === 0 ? 0 : Math.round((100 * mures) / total),
      },
      duesAujourdhui: duesParPaquet.get(p.id) ?? 0,
      joursSansRevision: derniere
        ? Math.round(
            (new Date(`${date}T00:00:00Z`).getTime() -
              new Date(`${derniere}T00:00:00Z`).getTime()) /
              86_400_000,
          )
        : null,
    };
  });
}

/**
 * Maîtrise d'un paquet, ou de tout le module. Relue après une session pour
 * savoir si la plante a changé de stade.
 */
export async function maitrisePaquet(
  paquetId: number | null,
): Promise<{ maitrise: number; total: number; mures: number }> {
  const ids = paquetId === null ? null : await sousArbre(paquetId);

  const lignes = await db
    .select({ etat: cartes.etat, combien: count() })
    .from(cartes)
    .where(
      and(
        eq(cartes.suspendue, false),
        ids ? inArray(cartes.paquetId, ids) : undefined,
      ),
    )
    .groupBy(cartes.etat);

  const total = lignes.reduce((somme, ligne) => somme + ligne.combien, 0);
  const mures = lignes.find((l) => l.etat === "mure")?.combien ?? 0;

  return { total, mures, maitrise: total === 0 ? 0 : Math.round((100 * mures) / total) };
}

/** Nombre de cartes dues aujourd'hui, tous paquets confondus. */
export async function cartesDues(date = aujourdhui()): Promise<number> {
  const [ligne] = await db
    .select({ combien: count() })
    .from(cartes)
    .where(
      and(
        eq(cartes.suspendue, false),
        or(lte(cartes.prochaineDate, date), isNull(cartes.prochaineDate)),
      ),
    );
  return ligne?.combien ?? 0;
}

/** Prévision des échéances sur les jours à venir. */
export async function previsions(
  jours = 7,
  date = aujourdhui(),
): Promise<{ date: string; combien: number }[]> {
  const fin = decalerJours(date, jours - 1);

  const lignes = await db
    .select({ jour: cartes.prochaineDate, combien: count() })
    .from(cartes)
    .where(
      and(
        eq(cartes.suspendue, false),
        gte(cartes.prochaineDate, date),
        lte(cartes.prochaineDate, fin),
      ),
    )
    .groupBy(cartes.prochaineDate);

  const parJour = new Map(lignes.map((l) => [l.jour, l.combien]));
  return Array.from({ length: jours }, (_, i) => {
    const j = decalerJours(date, i);
    return { date: j, combien: parJour.get(j) ?? 0 };
  });
}

/**
 * Tous les jours où quelque chose a été révisé, du plus ancien au plus récent.
 *
 * Une ligne par jour travaillé, pas par révision : même après des années, cela
 * tient en quelques milliers de lignes, et le calendrier peut donc se calculer
 * entièrement côté client — changer d'année ne coûte alors aucune requête.
 */
export async function joursDeRevision(
  anneesMax = 6,
  date = aujourdhui(),
): Promise<{ date: string; combien: number }[]> {
  const debut = decalerJours(date, -365 * anneesMax);

  const lignes = await db
    .select({ jour: revisions.date, combien: count() })
    .from(revisions)
    .where(gte(revisions.date, debut))
    .groupBy(revisions.date)
    .orderBy(asc(revisions.date));

  return lignes.map((l) => ({ date: l.jour, combien: l.combien }));
}

/** Taux de bonnes réponses par jour, sur la fenêtre demandée. */
export async function retention(
  jours = 30,
  date = aujourdhui(),
): Promise<{ date: string; taux: number; total: number }[]> {
  const debut = decalerJours(date, -(jours - 1));

  const lignes = await db
    .select({
      jour: revisions.date,
      total: count(),
      reussies: sql<number>`count(*) filter (where ${revisions.note} >= 3)`,
    })
    .from(revisions)
    .where(and(gte(revisions.date, debut), lte(revisions.date, date)))
    .groupBy(revisions.date);

  const parJour = new Map(lignes.map((l) => [l.jour, l]));
  return Array.from({ length: jours }, (_, i) => {
    const j = decalerJours(debut, i);
    const ligne = parJour.get(j);
    const total = Number(ligne?.total ?? 0);
    return {
      date: j,
      total,
      taux: total === 0 ? 0 : Math.round((100 * Number(ligne?.reussies ?? 0)) / total),
    };
  });
}

export { etatDepuisIntervalle };
