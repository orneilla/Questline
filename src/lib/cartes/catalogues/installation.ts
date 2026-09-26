import "server-only";

import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";

import { db } from "@/db";
import { cartes, espaces, medias, paquets } from "@/db/schema";
import { aujourdhui } from "@/lib/dates";
import { creerEspace, creerPaquet } from "@/lib/cartes/edition";
import { engendrer } from "@/lib/cartes/generation";

import {
  cleSource,
  compterCartes,
  imagesCitees,
  prefixeCatalogue,
  trouverCatalogue,
  verifierCatalogue,
  CATALOGUES,
} from "./index";
import { REPERE_IMAGE, type Catalogue } from "./types";

/**
 * Installation et mise à jour d'un catalogue.
 *
 * La même opération sert aux deux : une carte déjà en base est retrouvée par
 * sa clé et réécrite sur place — échéance, stabilité, historique et suspension
 * intacts —, une carte nouvelle du catalogue est ajoutée, et une carte que le
 * catalogue ne contient plus est retirée. Une carte déplacée dans un autre
 * paquet y reste.
 */

export type EtatCatalogue = {
  id: string;
  titre: string;
  source: string;
  description: string;
  /** Ce que le catalogue contient. */
  notes: number;
  cartes: number;
  /** Ce qui en est déjà en base. */
  installees: number;
  jamaisVues: number;
};

export async function etatCatalogues(): Promise<EtatCatalogue[]> {
  return Promise.all(
    CATALOGUES.map(async (catalogue) => {
      const prefixe = `${prefixeCatalogue(catalogue)}%`;
      const [[total], [neuves]] = await Promise.all([
        db
          .select({ combien: sql<number>`count(*)::int` })
          .from(cartes)
          .where(like(cartes.sourceCle, prefixe)),
        db
          .select({ combien: sql<number>`count(*)::int` })
          .from(cartes)
          .where(and(like(cartes.sourceCle, prefixe), isNull(cartes.prochaineDate))),
      ]);
      const { notes, cartes: nombre } = compterCartes(catalogue);
      return {
        id: catalogue.id,
        titre: catalogue.titre,
        source: catalogue.source,
        description: catalogue.description,
        notes,
        cartes: nombre,
        installees: total?.combien ?? 0,
        jamaisVues: neuves?.combien ?? 0,
      };
    }),
  );
}

export type ResultatInstallation = {
  ajoutees: number;
  misesAJour: number;
  inchangees: number;
  retirees: number;
};

export async function installerCatalogue(id: string): Promise<ResultatInstallation> {
  const catalogue = trouverCatalogue(id);
  if (!catalogue) throw new Error("Catalogue inconnu.");

  const problemes = verifierCatalogue(catalogue);
  if (problemes.length > 0) throw new Error(problemes.join(" · "));

  const liens = await enregistrerImages(catalogue);
  const resoudre = (texte: string) =>
    texte.replace(REPERE_IMAGE, (_tout, cle: string) => `![${cle}](${liens.get(cle)})`);

  const prefixe = prefixeCatalogue(catalogue);
  const existantes = await db
    .select({
      id: cartes.id,
      paquetId: cartes.paquetId,
      sourceCle: cartes.sourceCle,
      sourceIndex: cartes.sourceIndex,
      recto: cartes.recto,
      verso: cartes.verso,
      notes: cartes.notes,
      tags: cartes.tags,
      type: cartes.type,
    })
    .from(cartes)
    .where(like(cartes.sourceCle, `${prefixe}%`));

  const parRepere = new Map(existantes.map((c) => [`${c.sourceCle}#${c.sourceIndex}`, c]));
  const paquetsTrouves = await accorderPaquets(catalogue, existantes);

  const jour = aujourdhui();
  const aAjouter: (typeof cartes.$inferInsert)[] = [];
  const aModifier: {
    id: number;
    recto: string;
    verso: string;
    notes: string;
    tags: string[];
    type: string;
    sourceRecto: string;
    sourceVerso: string;
  }[] = [];
  const conservees = new Set<number>();
  let inchangees = 0;

  for (const paquet of catalogue.paquets) {
    const paquetId = paquetsTrouves.get(paquet.cle)!;
    for (const note of paquet.notes) {
      const cle = cleSource(catalogue, note);
      const recto = resoudre(note.recto);
      const verso = resoudre(note.verso);
      const engendrees = engendrer({
        cle,
        recto,
        verso,
        type: note.type ?? "recto_verso",
        notes: note.notes ?? "",
        tags: note.tags ?? [],
      });

      for (const carte of engendrees) {
        const existante = parRepere.get(`${cle}#${carte.index}`);
        if (!existante) {
          aAjouter.push({
            paquetId,
            recto: carte.recto,
            verso: carte.verso,
            type: carte.type,
            notes: carte.notes,
            tags: carte.tags,
            sourceCle: cle,
            sourceRecto: recto,
            sourceVerso: verso,
            sourceIndex: carte.index,
            creeLe: jour,
            modifieLe: jour,
          });
          continue;
        }

        conservees.add(existante.id);
        const identique =
          existante.recto === carte.recto &&
          existante.verso === carte.verso &&
          existante.notes === carte.notes &&
          existante.type === carte.type &&
          existante.tags.join("\u001f") === carte.tags.join("\u001f");
        if (identique) {
          inchangees += 1;
        } else {
          aModifier.push({
            id: existante.id,
            recto: carte.recto,
            verso: carte.verso,
            notes: carte.notes,
            tags: carte.tags,
            type: carte.type,
            sourceRecto: recto,
            sourceVerso: verso,
          });
        }
      }
    }
  }

  // Par tranches : une requête HTTP Neon a une taille maximale, et une mise à
  // jour ligne par ligne coûterait un aller-retour par carte.
  for (let debut = 0; debut < aAjouter.length; debut += 100) {
    await db.insert(cartes).values(aAjouter.slice(debut, debut + 100));
  }

  for (let debut = 0; debut < aModifier.length; debut += 50) {
    const tranche = aModifier.slice(debut, debut + 50);
    const valeurs = sql.join(
      tranche.map(
        (c) =>
          sql`(${c.id}::int, ${c.recto}::text, ${c.verso}::text, ${c.notes}::text, string_to_array(${c.tags.join("\u001f")}::text, chr(31)), ${c.type}::type_carte, ${c.sourceRecto}::text, ${c.sourceVerso}::text)`,
      ),
      sql`, `,
    );
    await db.execute(sql`
      update cartes set
        recto = v.recto, verso = v.verso, notes = v.notes, tags = v.tags, type = v.type,
        source_recto = v.source_recto, source_verso = v.source_verso, modifie_le = ${jour}::date
      from (values ${valeurs}) as v(id, recto, verso, notes, tags, type, source_recto, source_verso)
      where cartes.id = v.id`);
  }

  const aRetirer = existantes.map((c) => c.id).filter((carteId) => !conservees.has(carteId));
  if (aRetirer.length > 0) {
    await db.delete(cartes).where(inArray(cartes.id, aRetirer));
  }

  return {
    ajoutees: aAjouter.length,
    misesAJour: aModifier.length,
    inchangees,
    retirees: aRetirer.length,
  };
}

/**
 * Enregistre chaque dessin comme une image de carte, une seule fois : une
 * image déjà en base avec le même contenu est réutilisée. Un dessin corrigé en
 * crée une nouvelle — les images sont servies comme immuables — et l'ancienne,
 * qu'aucune carte ne cite plus, part avec la purge des images orphelines.
 */
async function enregistrerImages(catalogue: Catalogue): Promise<Map<string, string>> {
  const nom = (cle: string) => `catalogue/${catalogue.id}/${cle}.svg`;
  const citees = imagesCitees(catalogue);

  const connues = await db
    .select({ id: medias.id, nom: medias.nom, donnees: medias.donnees })
    .from(medias)
    .where(like(medias.nom, `catalogue/${catalogue.id}/%`));

  const liens = new Map<string, string>();
  const nouvelles: { cle: string; valeurs: typeof medias.$inferInsert }[] = [];

  for (const cle of citees) {
    const dessin = catalogue.images[cle];
    const donnees = Buffer.from(dessin, "utf8").toString("base64");
    const deja = connues.find((m) => m.nom === nom(cle) && m.donnees === donnees);
    if (deja) {
      liens.set(cle, `/api/cartes/media/${deja.id}.svg`);
      continue;
    }
    nouvelles.push({
      cle,
      valeurs: {
        nom: nom(cle),
        typeMime: "image/svg+xml",
        octets: Buffer.byteLength(dessin, "utf8"),
        largeur: Number(/width='(\d+)'/.exec(dessin)?.[1] ?? 0),
        hauteur: Number(/height='(\d+)'/.exec(dessin)?.[1] ?? 0),
        donnees,
        creeLe: aujourdhui(),
      },
    });
  }

  for (let debut = 0; debut < nouvelles.length; debut += 20) {
    const tranche = nouvelles.slice(debut, debut + 20);
    const creees = await db
      .insert(medias)
      .values(tranche.map((n) => n.valeurs))
      .returning({ id: medias.id, nom: medias.nom });
    for (const n of tranche) {
      const cree = creees.find((c) => c.nom === n.valeurs.nom);
      if (cree) liens.set(n.cle, `/api/cartes/media/${cree.id}.svg`);
    }
  }

  return liens;
}

/**
 * Trouve, ou crée, le paquet de chaque section du catalogue.
 *
 * On se fie d'abord aux cartes déjà installées : si l'on a renommé ou déplacé
 * un paquet, ses cartes y sont toujours et les nouvelles les y rejoignent.
 * Sinon, on cherche par nom sous le paquet racine, et à défaut on crée.
 */
async function accorderPaquets(
  catalogue: Catalogue,
  existantes: { paquetId: number; sourceCle: string | null }[],
): Promise<Map<string, number>> {
  const resultat = new Map<string, number>();

  for (const paquet of catalogue.paquets) {
    const cles = new Set(paquet.notes.map((n) => cleSource(catalogue, n)));
    const votes = new Map<number, number>();
    for (const carte of existantes) {
      if (carte.sourceCle && cles.has(carte.sourceCle)) {
        votes.set(carte.paquetId, (votes.get(carte.paquetId) ?? 0) + 1);
      }
    }
    const majoritaire = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (majoritaire) resultat.set(paquet.cle, majoritaire[0]);
  }

  if (resultat.size === catalogue.paquets.length) return resultat;

  const { espaceId, racineId } = await accorderRacine(catalogue);
  const enfants = await db
    .select({ id: paquets.id, nom: paquets.nom })
    .from(paquets)
    .where(eq(paquets.parentId, racineId));

  for (const paquet of catalogue.paquets) {
    if (resultat.has(paquet.cle)) continue;
    const trouve = enfants.find((p) => p.nom === paquet.nom);
    resultat.set(
      paquet.cle,
      trouve?.id ?? (await creerPaquet({ espaceId, parentId: racineId, nom: paquet.nom })),
    );
  }

  return resultat;
}

async function accorderRacine(
  catalogue: Catalogue,
): Promise<{ espaceId: number; racineId: number }> {
  const [espace] = await db
    .select({ id: espaces.id })
    .from(espaces)
    .where(eq(espaces.nom, catalogue.espace.nom))
    .limit(1);
  const espaceId = espace?.id ?? (await creerEspace(catalogue.espace.nom, catalogue.espace.couleur));

  const [racine] = await db
    .select({ id: paquets.id })
    .from(paquets)
    .where(
      and(eq(paquets.espaceId, espaceId), eq(paquets.nom, catalogue.racine), isNull(paquets.parentId)),
    )
    .limit(1);
  const racineId =
    racine?.id ?? (await creerPaquet({ espaceId, parentId: null, nom: catalogue.racine }));

  return { espaceId, racineId };
}
