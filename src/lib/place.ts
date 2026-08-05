import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Répartition de la place occupée, poste par poste.
 *
 * L'écran des réglages affichait une taille totale et trois lignes venant du
 * seul module des cartes : on en concluait que les mégaoctets venaient des
 * cartes, alors qu'ils viennent presque tous du texte coranique importé une
 * fois pour toutes. Ce module mesure chaque table et les regroupe par poste,
 * en distinguant ce qui est figé de ce qui grandit avec l'usage.
 *
 * Les tailles viennent de `pg_total_relation_size` : la table, ses index et
 * son stockage débordé (TOAST). Rien n'est estimé.
 */

export type LignePoste = { nom: string; octets: number };

export type Poste = {
  cle: string;
  nom: string;
  /** Une phrase qui dit d'où vient le poids. */
  aide: string;
  octets: number;
  /** Vrai si le poste ne bouge plus une fois importé. */
  fixe: boolean;
  /** Ce que le poste contient, en clair. Vide si un seul contenu. */
  lignes: LignePoste[];
};

export type Repartition = {
  /** Taille de la base entière. Nulle si Postgres refuse de la dire. */
  octetsBase: number | null;
  /** Somme des tables mesurées. */
  mesure: number;
  postes: Poste[];
  totalFixe: number;
  totalVivant: number;
  /**
   * Ce que la base compte en plus des tables : catalogues système, journal
   * des migrations, espace libéré pas encore rendu. Nul si la base ne dit
   * pas sa taille.
   */
  reste: number | null;
};

type Groupe = {
  cle: string;
  nom: string;
  aide: string;
  fixe: boolean;
  tables: string[];
};

/**
 * Les postes, dans l'ordre d'affichage : d'abord ce qui pèse et ne bouge
 * plus, ensuite ce qui suit l'usage.
 */
const GROUPES: Groupe[] = [
  {
    cle: "coran",
    nom: "Texte coranique",
    aide: "Les 6236 versets et les éditions importées. Importé une fois, ne grandit plus.",
    fixe: true,
    tables: ["sourates", "versets", "editions_coran", "textes_versets"],
  },
  {
    cle: "morphologie",
    nom: "Corpus mot à mot",
    aide: "L'analyse mot par mot : racine, sens, grammaire. Importée une fois.",
    fixe: true,
    tables: ["mots_coran"],
  },
  {
    cle: "cartes",
    nom: "Cartes et historique",
    aide: "Les cartes, leurs paquets, et la trace de chaque révision.",
    fixe: false,
    tables: [
      "cartes",
      "revisions",
      "sessions_revision",
      "paquets",
      "espaces",
      "reglages_cartes",
    ],
  },
  {
    cle: "images",
    nom: "Images",
    aide: "Les images collées dans les cartes, stockées en base.",
    fixe: false,
    tables: ["medias"],
  },
  {
    cle: "vie",
    nom: "Quêtes, arcs, tâches, momentum",
    aide: "Le cœur de Questline. Léger : ce sont des lignes de quelques octets.",
    fixe: false,
    tables: [
      "arcs",
      "etapes_arc",
      "seuils_arcs",
      "taches",
      "quetes",
      "creneaux_recurrents",
      "evenements",
      "journees",
      "validations",
      "quetes_rares_faites",
      "saisons",
      "momentum",
    ],
  },
  {
    cle: "lecture",
    nom: "Suivi de lecture du Coran",
    aide: "Les séances, la position, les marque-pages. Le texte n'est pas là-dedans.",
    fixe: false,
    tables: [
      "seances_lecture",
      "position_lecture",
      "positions_sourate",
      "marque_pages",
      "reglages_coran",
    ],
  },
  {
    cle: "notifications",
    nom: "Notifications et messages",
    aide: "Abonnements des appareils et journal des messages envoyés.",
    fixe: false,
    tables: ["abonnements_push", "reglages_notifications", "messages_envoyes"],
  },
  {
    cle: "sauvegardes",
    nom: "Sauvegardes",
    aide: "Les copies complètes conservées en base. Les plus anciennes sont purgées.",
    fixe: false,
    tables: ["sauvegardes"],
  },
];

function lignes<T>(resultat: unknown): T[] {
  const brut = (resultat as { rows?: unknown[] })?.rows ?? resultat;
  return Array.isArray(brut) ? (brut as T[]) : [];
}

function nombre(valeur: unknown): number {
  const converti = Number(valeur);
  return Number.isFinite(converti) ? converti : 0;
}

/** Taille de chaque table publique, index et débordement compris. */
async function taillesParTable(): Promise<Map<string, number>> {
  const resultat = await db
    .execute(
      sql`select c.relname as nom, pg_total_relation_size(c.oid)::bigint as octets
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind in ('r', 'p')`,
    )
    .catch(() => null);

  const carte = new Map<string, number>();
  if (!resultat) return carte;
  for (const ligne of lignes<{ nom: string; octets: unknown }>(resultat)) {
    carte.set(String(ligne.nom), nombre(ligne.octets));
  }
  return carte;
}

/**
 * Répartit le poids des textes entre translittération et traduction.
 *
 * Une seule table les porte toutes les deux. On mesure les octets de texte
 * réellement écrits par type d'édition, puis on répartit le poids total de
 * la table — index compris — dans cette proportion.
 */
async function partsDesEditions(total: number): Promise<Map<string, number>> {
  const parts = new Map<string, number>();
  if (total <= 0) return parts;

  const resultat = await db
    .execute(
      sql`select e.type as type, coalesce(sum(pg_column_size(t.texte)), 0)::bigint as octets
          from textes_versets t
          join editions_coran e on e.cle = t.edition_cle
          group by e.type`,
    )
    .catch(() => null);
  if (!resultat) return parts;

  const brutes = lignes<{ type: string; octets: unknown }>(resultat).map((l) => ({
    type: String(l.type),
    octets: nombre(l.octets),
  }));
  const somme = brutes.reduce((acc, l) => acc + l.octets, 0);
  if (somme <= 0) return parts;

  for (const ligne of brutes) {
    parts.set(ligne.type, Math.round((ligne.octets / somme) * total));
  }
  return parts;
}

function additionner(tailles: Map<string, number>, tables: string[]): number {
  return tables.reduce((total, nom) => total + (tailles.get(nom) ?? 0), 0);
}

export async function repartitionBase(): Promise<Repartition> {
  const [tailles, octetsBase] = await Promise.all([
    taillesParTable(),
    db
      .execute(sql`select pg_database_size(current_database()) as octets`)
      .then((r) => {
        const premiere = lignes<{ octets: unknown }>(r)[0];
        return premiere === undefined ? null : nombre(premiere.octets);
      })
      // Certains hébergeurs refusent cette fonction : l'écran s'en passe.
      .catch(() => null),
  ]);

  const octetsTextes = tailles.get("textes_versets") ?? 0;
  const parts = await partsDesEditions(octetsTextes);

  const postes: Poste[] = GROUPES.map((groupe) => ({
    cle: groupe.cle,
    nom: groupe.nom,
    aide: groupe.aide,
    fixe: groupe.fixe,
    octets: additionner(tailles, groupe.tables),
    lignes: sousLignes(groupe.cle, tailles, parts),
  }));

  // Ce qui n'entre dans aucun poste : rien ne doit se perdre en route.
  const connues = new Set(GROUPES.flatMap((g) => g.tables));
  let divers = 0;
  for (const [nom, octets] of tailles) if (!connues.has(nom)) divers += octets;
  if (divers > 0) {
    postes.push({
      cle: "divers",
      nom: "Reste des tables",
      aide: "Journal des migrations et tables techniques.",
      fixe: false,
      octets: divers,
      lignes: [],
    });
  }

  const mesure = postes.reduce((total, poste) => total + poste.octets, 0);
  const totalFixe = postes.reduce((t, p) => t + (p.fixe ? p.octets : 0), 0);

  return {
    octetsBase,
    mesure,
    postes,
    totalFixe,
    totalVivant: mesure - totalFixe,
    reste: octetsBase === null ? null : Math.max(0, octetsBase - mesure),
  };
}

function sousLignes(
  cle: string,
  tailles: Map<string, number>,
  parts: Map<string, number>,
): LignePoste[] {
  if (cle === "coran") {
    const detail: LignePoste[] = [
      {
        nom: "Arabe",
        octets: additionner(tailles, ["versets", "sourates"]),
      },
    ];
    const translitteration = parts.get("translitteration") ?? 0;
    const traduction = parts.get("traduction") ?? 0;
    if (translitteration > 0) {
      detail.push({ nom: "Translittération", octets: translitteration });
    }
    if (traduction > 0) detail.push({ nom: "Traduction", octets: traduction });
    if (translitteration === 0 && traduction === 0) {
      const restant = tailles.get("textes_versets") ?? 0;
      if (restant > 0) detail.push({ nom: "Éditions importées", octets: restant });
    }
    detail.push({ nom: "Catalogue des éditions", octets: tailles.get("editions_coran") ?? 0 });
    return detail;
  }

  if (cle === "cartes") {
    return [
      { nom: "Cartes", octets: tailles.get("cartes") ?? 0 },
      {
        nom: "Historique des révisions",
        octets: additionner(tailles, ["revisions", "sessions_revision"]),
      },
      {
        nom: "Paquets et espaces",
        octets: additionner(tailles, ["paquets", "espaces", "reglages_cartes"]),
      },
    ];
  }

  return [];
}
