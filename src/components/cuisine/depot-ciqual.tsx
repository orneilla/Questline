"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  lireCiqual,
  LIBELLES_NUTRIMENTS,
  type DiagnosticCiqual,
  type AlimentLu,
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
 */

const LOT = 400;

type Etape =
  | { phase: "attente" }
  | { phase: "lecture" }
  | { phase: "lu"; diagnostic: DiagnosticCiqual; aliments: AlimentLu[] }
  | { phase: "ecriture"; faits: number; total: number }
  | { phase: "fini"; ecrits: number }
  | { phase: "erreur"; message: string };

export function DepotCiqual({ dejaCharges }: { dejaCharges: number }) {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [etape, setEtape] = useState<Etape>({ phase: "attente" });

  async function choisir(fichier: File | undefined) {
    if (!fichier) return;
    setEtape({ phase: "lecture" });

    try {
      const contenu = await fichier.text();
      const { diagnostic, aliments } = lireCiqual(contenu);
      setEtape({ phase: "lu", diagnostic, aliments });
    } catch (erreur) {
      setEtape({
        phase: "erreur",
        message: erreur instanceof Error ? erreur.message : String(erreur),
      });
    }
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
      <input
        ref={champ}
        type="file"
        accept=".xml,.csv,.txt,text/xml,text/csv,text/plain"
        onChange={(e) => void choisir(e.target.files?.[0])}
        className="min-h-12 w-full rounded-xl border border-bordure bg-surface px-3 py-3 text-[13px] text-doux file:mr-3 file:rounded-lg file:border-0 file:bg-surface-haut file:px-3 file:py-2 file:text-[13px] file:text-texte"
      />

      {etape.phase === "lecture" && (
        <p className="text-[13px] text-doux">Lecture du fichier…</p>
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
