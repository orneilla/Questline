"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  lireCiqualMulti,
  LIBELLES_NUTRIMENTS,
  type DiagnosticCiqual,
  type AlimentLu,
  type Fichier,
} from "@/lib/cuisine/ciqual";

/**
 * Dépôt de la table Ciqual depuis le navigateur.
 *
 * Le fichier pèse des dizaines de mégaoctets : il est lu et découpé ici, puis
 * envoyé par tranches. Rien ne transite en un seul bloc, et l'import reprend
 * là où il s'est arrêté si on le relance — l'écriture est idempotente.
 *
 * Deux temps volontaires : on lit et on montre ce qui a été reconnu, puis on
 * écrit seulement si l'association des colonnes est juste. Un nutriment mal
 * associé fausserait tous les comptes à venir, en silence.
 *
 * L'export XML de l'Anses vient en plusieurs documents — aliments, teneurs,
 * libellés de constituants. Ils se déposent donc ensemble, ou l'un après
 * l'autre : ce qui a déjà été lu est gardé, et l'écran dit ce qu'il attend
 * encore plutôt que de refuser le fichier officiel.
 */

const LOT = 400;

type Etape =
  | { phase: "attente" }
  | { phase: "lecture" }
  | { phase: "lu"; diagnostic: DiagnosticCiqual; aliments: AlimentLu[] }
  | { phase: "ecriture"; faits: number; total: number }
  | { phase: "fini"; ecrits: number }
  | { phase: "incomplet"; message: string }
  | { phase: "erreur"; message: string };

export function DepotCiqual({ dejaCharges }: { dejaCharges: number }) {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [etape, setEtape] = useState<Etape>({ phase: "attente" });
  const [deposes, setDeposes] = useState<Fichier[]>([]);

  async function choisir(choisis: FileList | null) {
    if (!choisis || choisis.length === 0) return;
    setEtape({ phase: "lecture" });

    let ensemble: Fichier[] = deposes;
    try {
      const nouveaux = await Promise.all(
        [...choisis].map(async (f) => ({ nom: f.name, contenu: await f.text() })),
      );
      // Redéposer le même document le remplace plutôt que de le doubler.
      const noms = new Set(nouveaux.map((f) => f.nom));
      ensemble = [...deposes.filter((f) => !noms.has(f.nom)), ...nouveaux];
      setDeposes(ensemble);
    } catch (erreur) {
      setEtape({
        phase: "erreur",
        message: `Lecture impossible : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
      });
      return;
    }

    try {
      const { diagnostic, aliments } = lireCiqualMulti(ensemble);
      setEtape({ phase: "lu", diagnostic, aliments });
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      // « Il manque … » n'est pas un échec : c'est une attente. L'écran le
      // distingue, sinon déposer le premier des trois fichiers ressemble à une
      // erreur et on n'ose pas déposer le suivant.
      setEtape({
        phase: message.startsWith("Il manque") ? "incomplet" : "erreur",
        message,
      });
    }
  }

  function oublier() {
    setDeposes([]);
    setEtape({ phase: "attente" });
    if (champ.current) champ.current.value = "";
  }

  async function ecrire(aliments: AlimentLu[]) {
    setEtape({ phase: "ecriture", faits: 0, total: aliments.length });

    let ecrits = 0;
    for (let i = 0; i < aliments.length; i += LOT) {
      const lot = aliments.slice(i, i + LOT);
      const reponse = await fetch("/api/cuisine/aliments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aliments: lot }),
      });

      if (!reponse.ok) {
        const corps = (await reponse.json().catch(() => ({}))) as { erreur?: string };
        setEtape({
          phase: "erreur",
          message:
            `Interrompu après ${ecrits} aliments : ${corps.erreur ?? reponse.statusText}. ` +
            "Ce qui est écrit reste écrit — relancer reprend sans doublon.",
        });
        return;
      }

      ecrits += lot.length;
      setEtape({ phase: "ecriture", faits: ecrits, total: aliments.length });
    }

    setEtape({ phase: "fini", ecrits });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {/*
        Le champ natif est masqué derrière un libellé plutôt que stylé : sur
        iOS il s'affiche « Choisir un fichier / Aucun fichier », dans une
        typographie et une langue que la page ne contrôle pas. Le rendre
        cliquable par son label donne un bouton qui ressemble aux autres, et
        dit ce qu'il attend.
      */}
      <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-xl border border-bordure-vive bg-surface-haut px-5 text-center text-[15px] text-texte transition-colors duration-300 active:bg-bordure">
        <input
          ref={champ}
          type="file"
          multiple
          accept=".xml,.csv,.txt,text/xml,text/csv,text/plain"
          onChange={(e) => void choisir(e.target.files)}
          className="sr-only"
        />
        {deposes.length === 0
          ? "Choisir les fichiers Ciqual"
          : "Ajouter un autre fichier"}
      </label>

      {deposes.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-bordure p-4">
          <span className="text-[11.5px] tracking-[0.1em] text-tres-doux uppercase">
            Déposés
          </span>
          <ul className="flex flex-col gap-0.5">
            {deposes.map((f) => (
              <li key={f.nom} className="text-[12.5px] break-all text-doux">
                {f.nom}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={oublier}
            className="mt-1 min-h-10 self-start text-left text-[12.5px] text-tres-doux transition-colors duration-300 active:text-doux"
          >
            Tout retirer et recommencer
          </button>
        </div>
      )}

      {etape.phase === "lecture" && (
        <p className="text-[13px] text-doux">Lecture des fichiers…</p>
      )}

      {etape.phase === "incomplet" && (
        <p className="rounded-xl border border-bordure p-4 text-[13px] leading-relaxed text-doux">
          {etape.message} Rien n&apos;est perdu : ce qui est déjà déposé reste en
          mémoire, ajoute simplement le document suivant.
        </p>
      )}

      {etape.phase === "erreur" && (
        <p className="rounded-xl border border-bordure-vive p-4 text-[13px] leading-relaxed text-doux">
          {etape.message}
        </p>
      )}

      {etape.phase === "lu" && (
        <div className="flex flex-col gap-3 rounded-xl border border-bordure-vive p-4">
          <p className="text-[13px] leading-relaxed text-doux">
            Format {etape.diagnostic.format.toUpperCase()} reconnu.{" "}
            {etape.diagnostic.aliments.toLocaleString("fr-FR")} aliments —{" "}
            {etape.diagnostic.crus.toLocaleString("fr-FR")} rangés en cru,{" "}
            {etape.diagnostic.cuits.toLocaleString("fr-FR")} en cuit.
          </p>

          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] tracking-[0.1em] text-tres-doux uppercase">
              Colonnes associées
            </span>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
              {etape.diagnostic.associations.map((a) => (
                <div key={a.nutriment} className="contents">
                  <dt className="text-tres-doux">{LIBELLES_NUTRIMENTS[a.nutriment]}</dt>
                  <dd className="min-w-0 truncate text-doux">« {a.libelle} »</dd>
                </div>
              ))}
            </dl>
          </div>

          {etape.diagnostic.absents.length > 0 && (
            <p className="text-[12px] leading-relaxed text-tres-doux">
              Sans colonne, donc laissés vides :{" "}
              {etape.diagnostic.absents
                .map((cle) => LIBELLES_NUTRIMENTS[cle])
                .join(", ")}
              .
            </p>
          )}

          <p className="text-[12px] leading-relaxed text-tres-doux">
            Vérifie que chaque nutriment pointe bien la colonne attendue avant
            d'écrire. Une association fausse ne se verrait plus ensuite.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEtape({ phase: "attente" });
                if (champ.current) champ.current.value = "";
              }}
              className="min-h-12 flex-1 rounded-xl border border-bordure text-[13.5px] text-doux"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void ecrire(etape.aliments)}
              className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[13.5px] text-texte"
            >
              Écrire en base
            </button>
          </div>
        </div>
      )}

      {etape.phase === "ecriture" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-doux">Écriture…</span>
            <span className="text-tres-doux tabular-nums">
              {etape.faits.toLocaleString("fr-FR")} / {etape.total.toLocaleString("fr-FR")}
            </span>
          </div>
          <span
            aria-hidden
            className="flex h-1.5 w-full overflow-hidden rounded-full bg-bordure"
          >
            <span
              className="transition-[width] duration-300"
              style={{
                width: `${Math.round((100 * etape.faits) / Math.max(1, etape.total))}%`,
                backgroundColor: "#8fa37e",
              }}
            />
          </span>
        </div>
      )}

      {etape.phase === "fini" && (
        <p className="text-[13px] leading-relaxed text-doux">
          {etape.ecrits.toLocaleString("fr-FR")} aliments écrits. Relancer le même
          fichier ne créera pas de doublon : chaque aliment est mis à jour.
        </p>
      )}

      {dejaCharges > 0 && etape.phase === "attente" && (
        <p className="text-[12px] leading-relaxed text-tres-doux">
          {dejaCharges.toLocaleString("fr-FR")} aliments Ciqual sont déjà en base.
          Redéposer le fichier les met à jour sans les dupliquer.
        </p>
      )}
    </div>
  );
}
