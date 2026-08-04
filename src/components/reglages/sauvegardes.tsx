"use client";

import { useState, useTransition } from "react";

import {
  actionApresRestauration,
  actionCreerSauvegarde,
} from "@/app/(app)/reglages/sauvegardes/actions";
import {
  analyserSauvegarde,
  NOMS_TABLES,
  SauvegardeIllisible,
  type ContenuSauvegarde,
  type FicheSauvegarde,
  type NomTable,
  type ResumeSauvegarde,
} from "@/lib/sauvegardes-partage";

/**
 * Sauvegardes.
 *
 * ── La restauration
 *
 * C'est la seule action de toute l'application qui puisse détruire des données.
 * Elle suit donc le même ordre que la route de dépôt : lire, montrer, écrire.
 * Le fichier est analysé sans rien toucher, le contenu est comparé ligne à
 * ligne avec ce qui est en base, et la confirmation dit en toutes lettres ce
 * qui sera remplacé. Pas de « êtes-vous sûr ? » : une phrase qui dit ce qui
 * disparaît.
 */

function poids(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

function quand(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

export function Sauvegardes({
  liste,
  conservees,
}: {
  liste: FicheSauvegarde[];
  conservees: number;
}) {
  const [enAttente, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const derniere = liste[0];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Dernière sauvegarde
        </h2>

        {derniere ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-bordure bg-surface p-4">
            <p className="text-[14.5px] text-texte">{quand(derniere.creeeLe)}</p>
            <p className="text-[12.5px] text-tres-doux tabular-nums">
              {poids(derniere.octets)} ·{" "}
              {Object.values(derniere.resume)
                .reduce((somme, n) => somme + (n ?? 0), 0)
                .toLocaleString("fr-FR")}{" "}
              lignes
            </p>
            <a
              href={`/api/sauvegardes/${derniere.id}`}
              download
              className="flex min-h-12 items-center justify-center rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte"
            >
              Télécharger
            </a>
          </div>
        ) : (
          <p className="text-[13px] leading-relaxed text-doux">
            Aucune sauvegarde pour l'instant. La première partira au prochain
            déclenchement planifié ; tu peux aussi en créer une maintenant.
          </p>
        )}

        <button
          type="button"
          disabled={enAttente}
          onClick={() =>
            demarrer(async () => {
              const fiche = await actionCreerSauvegarde();
              setMessage(`Sauvegarde créée — ${poids(fiche.octets)}.`);
            })
          }
          className="min-h-12 rounded-xl border border-bordure text-[13.5px] text-doux disabled:opacity-40"
        >
          {enAttente ? "…" : "Sauvegarder maintenant"}
        </button>

        {message && <p className="text-[12.5px] text-doux">{message}</p>}

        <p className="text-[11.5px] leading-relaxed text-tres-doux">
          Une sauvegarde par semaine, {conservees} conservées, les plus anciennes
          purgées. Elle contient tes cartes et leur historique, tes quêtes, arcs,
          étapes, momentum, tâches, emploi du temps, progression de lecture et
          réglages. Pas le texte coranique ni les analyses : ils se réinstallent
          d'une adresse, et les embarquer rendrait la sauvegarde impossible à écrire.
        </p>
      </section>

      {liste.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
            Précédentes
          </h2>
          <ul className="flex flex-col gap-1.5">
            {liste.slice(1).map((fiche) => (
              <li key={fiche.id}>
                <a
                  href={`/api/sauvegardes/${fiche.id}`}
                  download
                  className="flex items-center justify-between gap-3 rounded-xl border border-bordure px-4 py-3"
                >
                  <span className="text-[13.5px] text-doux">{quand(fiche.creeeLe)}</span>
                  <span className="text-[12px] text-tres-doux tabular-nums">
                    {poids(fiche.octets)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Restauration />
    </div>
  );
}

/* ───────────────────────────── Restauration ───────────────────────────── */

type LigneApercu = { table: NomTable; fichier: number; base: number };

/** Lignes envoyées par requête. Assez court pour ne jamais dépasser une limite. */
const TAILLE_LOT = 400;

function Restauration() {
  const [contenu, setContenu] = useState<ContenuSauvegarde | null>(null);
  const [apercu, setApercu] = useState<LigneApercu[] | null>(null);
  const [inconnues, setInconnues] = useState<string[]>([]);
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirme, setConfirme] = useState(false);
  const [avancement, setAvancement] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function choisir(fichier: File) {
    setErreur(null);
    setApercu(null);
    setContenu(null);
    setFait(null);
    setConfirme(false);
    setNom(fichier.name);

    try {
      // Le fichier est lu ici, en entier : c'est le seul endroit où il tient.
      const lu = analyserSauvegarde(await fichier.text());
      setContenu(lu.contenu);
      setInconnues(lu.inconnues);

      const reponse = await fetch("/api/sauvegardes/restaurer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "etat" }),
      });
      const { etat, erreur: probleme } = (await reponse.json()) as {
        etat?: ResumeSauvegarde;
        erreur?: string;
      };
      if (!etat) throw new Error(probleme ?? "État de la base indisponible.");

      setApercu(
        NOMS_TABLES.map((table) => ({
          table,
          fichier: lu.resume[table] ?? 0,
          base: etat[table] ?? 0,
        })).filter((l) => l.fichier > 0 || l.base > 0),
      );
    } catch (probleme) {
      setErreur(
        probleme instanceof SauvegardeIllisible
          ? probleme.message
          : probleme instanceof Error
            ? probleme.message
            : String(probleme),
      );
    }
  }

  async function poster(corps: unknown): Promise<Record<string, unknown>> {
    const reponse = await fetch("/api/sauvegardes/restaurer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corps),
    });
    const lu = (await reponse.json()) as Record<string, unknown>;
    if (!reponse.ok) throw new Error(String(lu.erreur ?? reponse.status));
    return lu;
  }

  async function restaurer() {
    if (!contenu) return;
    setEnCours(true);
    setErreur(null);

    try {
      const tables = NOMS_TABLES.filter((t) => Array.isArray(contenu.tables[t]));

      setAvancement("Vidage des tables concernées…");
      await poster({ action: "vider", tables });

      let ecrites = 0;
      for (const table of tables) {
        const lignes = (contenu.tables[table] ?? []) as Record<string, unknown>[];
        for (let debut = 0; debut < lignes.length; debut += TAILLE_LOT) {
          await poster({
            action: "ecrire",
            table,
            lignes: lignes.slice(debut, debut + TAILLE_LOT),
          });
          ecrites += Math.min(TAILLE_LOT, lignes.length - debut);
          setAvancement(`${table} — ${ecrites.toLocaleString("fr-FR")} lignes écrites`);
        }
      }

      setAvancement("Remise en ordre des séquences…");
      await poster({ action: "clore", tables });
      await actionApresRestauration();

      setAvancement(null);
      setFait(`${ecrites.toLocaleString("fr-FR")} lignes restaurées.`);
    } catch (probleme) {
      setAvancement(null);
      setErreur(
        "La restauration s'est interrompue : " +
          (probleme instanceof Error ? probleme.message : String(probleme)) +
          " Les tables déjà réécrites le sont ; redépose le même fichier pour reprendre.",
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Restaurer</h2>

      <input
        type="file"
        accept=".json,application/json"
        id="fichier-sauvegarde"
        className="hidden"
        onChange={(evenement) => {
          const fichier = evenement.target.files?.[0];
          if (fichier) void choisir(fichier);
          evenement.target.value = "";
        }}
      />

      <label
        htmlFor="fichier-sauvegarde"
        className="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl border border-dashed border-bordure-vive bg-surface px-4 py-3 text-center"
      >
        <span className="text-[14.5px] text-texte">
          {nom ? "Choisir un autre fichier" : "Choisir une sauvegarde"}
        </span>
        <span className="text-[12px] text-tres-doux">
          {nom || "un .json exporté depuis Questline"}
        </span>
      </label>

      {erreur && (
        <p className="rounded-xl border border-bordure-vive bg-surface p-4 text-[13px] leading-relaxed text-doux">
          {erreur}
        </p>
      )}

      {apercu && contenu && !fait && (
        <div className="flex flex-col gap-3 rounded-2xl border border-bordure bg-surface p-4">
          <p className="text-[12.5px] text-tres-doux">
            Sauvegarde du {quand(contenu.creeeLe)}
          </p>

          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 text-[12.5px]">
            <span className="text-[11px] tracking-[0.1em] text-tres-doux uppercase">
              Table
            </span>
            <span className="text-right text-[11px] tracking-[0.1em] text-tres-doux uppercase">
              Fichier
            </span>
            <span className="text-right text-[11px] tracking-[0.1em] text-tres-doux uppercase">
              En base
            </span>

            {apercu.map((ligne) => (
              <div key={ligne.table} className="contents">
                <span className="text-doux">{ligne.table}</span>
                <span className="text-right text-texte tabular-nums">{ligne.fichier}</span>
                <span className="text-right text-tres-doux tabular-nums">{ligne.base}</span>
              </div>
            ))}
          </div>

          {inconnues.length > 0 && (
            <p className="text-[12px] leading-relaxed text-tres-doux">
              Ignorées, inconnues de cette version : {inconnues.join(", ")}.
            </p>
          )}

          <p className="text-[12.5px] leading-relaxed text-doux">
            Chaque table listée sera <b>vidée puis réécrite</b> avec le contenu du
            fichier. Ce qui est en base aujourd'hui pour ces tables disparaît. Les
            tables absentes du fichier ne sont pas touchées, et le texte coranique
            n'est jamais concerné.
          </p>

          {avancement && (
            <p className="text-[12.5px] text-doux tabular-nums">{avancement}</p>
          )}

          {!confirme ? (
            <button
              type="button"
              onClick={() => setConfirme(true)}
              className="min-h-12 rounded-xl border border-bordure text-[13.5px] text-doux"
            >
              J'ai lu — préparer la restauration
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={enCours}
                onClick={() => setConfirme(false)}
                className="min-h-12 flex-1 rounded-xl border border-bordure text-[13.5px] text-doux disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={() => void restaurer()}
                className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[13.5px] text-texte disabled:opacity-40"
              >
                {enCours ? "…" : "Restaurer"}
              </button>
            </div>
          )}
        </div>
      )}

      {fait && (
        <div className="flex flex-col gap-2 rounded-2xl border border-bordure-vive bg-surface p-4">
          <p className="text-[14px] text-texte">Restauration terminée.</p>
          <p className="text-[12.5px] leading-relaxed text-doux tabular-nums">{fait}</p>
          <a
            href="/jour"
            className="mt-1 flex min-h-12 items-center justify-center rounded-xl border border-bordure text-[13.5px] text-doux"
          >
            Revenir au jour
          </a>
        </div>
      )}
    </section>
  );
}
