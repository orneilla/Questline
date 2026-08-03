"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";

import { deplacerVersPaquet, rechercher } from "@/app/(app)/cartes/edition-actions";
import type { ResultatCarte } from "@/lib/cartes/edition";
import type { EtatCarte } from "@/db/schema";
import { COULEURS_ETATS, LIBELLES_ETATS } from "./barre-paquet";
import type { PaquetChoix } from "./editeur-carte";

/**
 * Recherche dans toutes les cartes.
 *
 * Les résultats se sélectionnent pour être déplacés en bloc d'un paquet à un
 * autre : c'est la seule opération de masse de l'application, et elle sert
 * chaque fois qu'un paquet devient trop gros et se scinde.
 */

const CHAMP =
  "min-h-12 w-full rounded-xl border border-bordure bg-surface px-4 text-[15px] text-texte outline-none transition-colors duration-300 placeholder:text-tres-doux focus:border-bordure-vive";

const ETATS: { valeur: EtatCarte; libelle: string }[] = [
  { valeur: "nouvelle", libelle: LIBELLES_ETATS.nouvelles },
  { valeur: "apprentissage", libelle: LIBELLES_ETATS.apprentissage },
  { valeur: "jeune", libelle: LIBELLES_ETATS.jeunes },
  { valeur: "mure", libelle: LIBELLES_ETATS.mures },
];

const TEINTE_ETAT: Record<EtatCarte, string> = {
  nouvelle: COULEURS_ETATS.nouvelles,
  apprentissage: COULEURS_ETATS.apprentissage,
  jeune: COULEURS_ETATS.jeunes,
  mure: COULEURS_ETATS.mures,
};

/** Rend un extrait lisible : ni balises, ni formules, ni images. */
function extrait(texte: string, longueur = 120): string {
  const nu = texte
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[image]")
    .replace(/\$\$[\s\S]*?\$\$/g, "[formule]")
    .replace(/\$[^$\n]*\$/g, "[formule]")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return nu.length > longueur ? `${nu.slice(0, longueur)}…` : nu;
}

export function Recherche({ paquets }: { paquets: PaquetChoix[] }) {
  const [texte, setTexte] = useState("");
  const [paquetId, setPaquetId] = useState<number | null>(null);
  const [etat, setEtat] = useState<EtatCarte | null>(null);
  const [suspendues, setSuspendues] = useState<"avec" | "sans" | "seules">("avec");

  const [resultats, setResultats] = useState<ResultatCarte[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, demarrer] = useTransition();
  const [premiereFois, setPremiereFois] = useState(true);

  const [choisies, setChoisies] = useState<Set<number>>(new Set());
  const [destination, setDestination] = useState<number>(paquets[0]?.id ?? 0);
  const [bilan, setBilan] = useState<string | null>(null);

  // La frappe ne déclenche pas une requête par lettre.
  useEffect(() => {
    const minuterie = setTimeout(() => {
      demarrer(async () => {
        const reponse = await rechercher({
          texte,
          paquetId,
          etat,
          suspendues,
          limite: 80,
        });
        setResultats(reponse.cartes);
        setErreur(reponse.erreur ?? null);
        setPremiereFois(false);
      });
    }, 260);
    return () => clearTimeout(minuterie);
  }, [texte, paquetId, etat, suspendues]);

  function basculer(id: number): void {
    setChoisies((precedent) => {
      const suivant = new Set(precedent);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <input
          value={texte}
          onChange={(evenement) => setTexte(evenement.target.value)}
          placeholder="Chercher dans le recto, le verso, les notes, les étiquettes"
          className={CHAMP}
          autoFocus
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={paquetId ?? ""}
            onChange={(evenement) =>
              setPaquetId(evenement.target.value ? Number(evenement.target.value) : null)
            }
            className={CHAMP}
          >
            <option value="">Tous les paquets</option>
            {paquets.map((paquet) => (
              <option key={paquet.id} value={paquet.id}>
                {paquet.espaceNom} · {paquet.nom}
              </option>
            ))}
          </select>

          <select
            value={etat ?? ""}
            onChange={(evenement) =>
              setEtat(evenement.target.value ? (evenement.target.value as EtatCarte) : null)
            }
            className={CHAMP}
          >
            <option value="">Tous les états</option>
            {ETATS.map((choix) => (
              <option key={choix.valeur} value={choix.valeur}>
                {choix.libelle}
              </option>
            ))}
          </select>

          <select
            value={suspendues}
            onChange={(evenement) =>
              setSuspendues(evenement.target.value as "avec" | "sans" | "seules")
            }
            className={CHAMP}
          >
            <option value="avec">Suspendues comprises</option>
            <option value="sans">Sans les suspendues</option>
            <option value="seules">Seulement les suspendues</option>
          </select>
        </div>
      </div>

      {choisies.size > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-bordure-vive bg-surface p-4">
          <p className="text-[13px] text-doux">
            {choisies.size} carte{choisies.size > 1 ? "s" : ""} sélectionnée
            {choisies.size > 1 ? "s" : ""}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={destination}
              onChange={(evenement) => setDestination(Number(evenement.target.value))}
              className={CHAMP}
            >
              {paquets.map((paquet) => (
                <option key={paquet.id} value={paquet.id}>
                  {paquet.espaceNom} · {paquet.nom}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={chargement || destination === 0}
              onClick={() =>
                demarrer(async () => {
                  const combien = choisies.size;
                  await deplacerVersPaquet([...choisies], destination);
                  setChoisies(new Set());
                  setBilan(`${combien} carte(s) déplacée(s).`);
                  const reponse = await rechercher({
                    texte,
                    paquetId,
                    etat,
                    suspendues,
                    limite: 80,
                  });
                  setResultats(reponse.cartes);
                })}
              className="min-h-12 shrink-0 rounded-xl border border-bordure-vive bg-surface-haut px-5 text-[14px] text-texte transition-colors duration-300 active:bg-bordure disabled:opacity-50"
            >
              Déplacer
            </button>
            <button
              type="button"
              onClick={() => setChoisies(new Set())}
              className="min-h-12 shrink-0 rounded-xl border border-bordure px-5 text-[14px] text-doux"
            >
              Désélectionner
            </button>
          </div>
        </div>
      )}

      <p aria-live="polite" className="min-h-5 text-[12.5px] text-tres-doux">
        {erreur ??
          bilan ??
          (chargement
            ? "…"
            : premiereFois
              ? ""
              : `${resultats.length} résultat${resultats.length > 1 ? "s" : ""}${resultats.length >= 80 ? " (les 80 plus récents)" : ""}`)}
      </p>

      <ul className="flex flex-col gap-2">
        {resultats.map((carte) => (
          <li
            key={carte.id}
            className="flex items-stretch gap-0 overflow-hidden rounded-2xl border border-bordure bg-surface"
            style={{ opacity: carte.suspendue ? 0.55 : 1 }}
          >
            <button
              type="button"
              aria-pressed={choisies.has(carte.id)}
              aria-label={`Sélectionner la carte ${carte.id}`}
              onClick={() => basculer(carte.id)}
              className="flex w-12 shrink-0 items-center justify-center border-r border-bordure transition-colors duration-200 active:bg-surface-haut"
            >
              <span
                aria-hidden
                className="size-4 rounded-[5px] border transition-colors duration-200"
                style={{
                  borderColor: choisies.has(carte.id)
                    ? "var(--color-doux)"
                    : "var(--color-bordure-vive)",
                  backgroundColor: choisies.has(carte.id)
                    ? "var(--color-doux)"
                    : "transparent",
                }}
              />
            </button>

            <Link
              href={`/cartes/carte/${carte.id}`}
              className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3 transition-colors duration-200 active:bg-surface-haut"
            >
              <span className="truncate text-[14.5px] text-texte">
                {extrait(carte.recto) || "(recto vide)"}
              </span>
              <span className="truncate text-[12.5px] text-doux">
                {extrait(carte.verso, 90)}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-tres-doux">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: TEINTE_ETAT[carte.etat] }}
                />
                {carte.espaceNom} · {carte.paquetNom}
                {carte.prochaineDate ? ` · échéance ${carte.prochaineDate}` : " · jamais vue"}
                {carte.suspendue ? " · suspendue" : ""}
                {carte.tags.length > 0 ? ` · ${carte.tags.join(" ")}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {!chargement && !premiereFois && resultats.length === 0 && (
        <p className="text-[13.5px] leading-relaxed text-doux">
          Rien ne correspond. La recherche porte sur le texte des cartes tel qu'il est
          enregistré : une formule s'y cherche par son code LaTeX.
        </p>
      )}
    </div>
  );
}
