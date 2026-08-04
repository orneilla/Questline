"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  LIBELLES_TYPES,
  type GroupeResultats,
  type TypeResultat,
} from "@/lib/recherche-partage";

/**
 * Le champ de recherche et ses résultats.
 *
 * ── L'historique
 *
 * Les derniers termes cherchés sont gardés dans le navigateur, pas en base :
 * c'est un confort personnel, propre à l'appareil, qui n'a aucune raison de
 * voyager ni d'être sauvegardé. Il ne garde que ce qui a donné quelque chose.
 *
 * ── Les filtres
 *
 * Ils restreignent à un type, sans relancer la frappe : la requête reste dans
 * l'URL, seul le paramètre `type` change. Le compte affiché est le total réel
 * du groupe, pas le nombre de lignes montrées.
 */

const CLE_HISTORIQUE = "questline.recherches";
const HISTORIQUE_MAX = 8;

const TYPES = Object.keys(LIBELLES_TYPES) as TypeResultat[];

function lireHistorique(): string[] {
  try {
    const brut = window.localStorage.getItem(CLE_HISTORIQUE);
    const lu: unknown = brut ? JSON.parse(brut) : [];
    return Array.isArray(lu) ? lu.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function RechercheGlobale({
  requete,
  filtre,
  groupes,
  erreur,
}: {
  requete: string;
  filtre: TypeResultat | undefined;
  groupes: GroupeResultats[];
  erreur: string | null;
}) {
  const router = useRouter();
  const [saisie, setSaisie] = useState(requete);
  const [historique, setHistorique] = useState<string[]>([]);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => setHistorique(lireHistorique()), []);
  useEffect(() => setSaisie(requete), [requete]);

  // On ne retient que ce qui a donné quelque chose : une faute de frappe n'a
  // pas à encombrer la liste.
  useEffect(() => {
    if (requete.length === 0 || groupes.length === 0) return;
    try {
      const suite = [requete, ...lireHistorique().filter((t) => t !== requete)].slice(
        0,
        HISTORIQUE_MAX,
      );
      window.localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(suite));
      setHistorique(suite);
    } catch {
      // Un navigateur qui refuse le stockage local ne doit pas casser la
      // recherche : on perd l'historique, rien d'autre.
    }
  }, [requete, groupes.length]);

  function lancer(terme: string, type?: TypeResultat) {
    const propre = terme.trim();
    if (propre.length === 0) return;
    const parametres = new URLSearchParams({ q: propre });
    if (type) parametres.set("type", type);
    router.push(`/recherche?${parametres.toString()}`);
  }

  const total = groupes.reduce((somme, groupe) => somme + groupe.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 rounded-xl border border-bordure bg-surface px-3">
        <svg viewBox="0 0 24 24" className="size-[17px] shrink-0 text-tres-doux" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m16.5 16.5 4 4" />
        </svg>
        <input
          ref={champ}
          value={saisie}
          onChange={(evenement) => setSaisie(evenement.target.value)}
          onKeyDown={(evenement) => {
            if (evenement.key === "Enter") {
              evenement.preventDefault();
              lancer(saisie, filtre);
            }
          }}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Chercher dans tout"
          aria-label="Chercher"
          className="min-h-12 flex-1 bg-transparent text-[15px] text-texte outline-none placeholder:text-tres-doux"
        />
      </div>

      {requete.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Pastille
            libelle="Tout"
            actif={filtre === undefined}
            onClick={() => lancer(requete)}
          />
          {TYPES.map((type) => (
            <Pastille
              key={type}
              libelle={LIBELLES_TYPES[type]}
              actif={filtre === type}
              onClick={() => lancer(requete, type)}
            />
          ))}
        </div>
      )}

      {erreur && (
        <p className="rounded-xl border border-bordure-vive bg-surface p-4 text-[13px] leading-relaxed text-doux">
          {erreur}
        </p>
      )}

      {requete.length === 0 && historique.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[12px] tracking-[0.14em] text-tres-doux uppercase">
            Dernières recherches
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {historique.map((terme) => (
              <button
                key={terme}
                type="button"
                onClick={() => lancer(terme)}
                className="min-h-10 rounded-full border border-bordure px-3.5 text-[13px] text-doux"
              >
                {terme}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.removeItem(CLE_HISTORIQUE);
              } catch {
                // Sans stockage local, il n'y avait rien à effacer.
              }
              setHistorique([]);
            }}
            className="mt-1 min-h-10 self-start text-[12px] text-tres-doux"
          >
            Effacer l'historique
          </button>
        </section>
      )}

      {requete.length > 0 && groupes.length === 0 && !erreur && (
        <p className="text-[13.5px] leading-relaxed text-doux">
          Rien pour « {requete} ». La recherche ignore les accents et les signes de
          translittération, et connaît quelques graphies — « coran » trouve « Qurʾān ».
        </p>
      )}

      {groupes.length > 0 && (
        <p className="text-[12px] text-tres-doux tabular-nums">
          {total} résultat{total > 1 ? "s" : ""}
        </p>
      )}

      {groupes.map((groupe) => (
        <section key={groupe.type} className="flex flex-col gap-2">
          <h2 className="flex items-baseline justify-between gap-3 text-[12px] tracking-[0.14em] text-doux uppercase">
            {groupe.libelle}
            <span className="text-tres-doux tabular-nums">{groupe.total}</span>
          </h2>

          <ul className="flex flex-col gap-1.5">
            {groupe.resultats.map((resultat, rang) => (
              <li key={`${resultat.lien}-${rang}`}>
                <Link
                  href={resultat.lien}
                  className="flex flex-col gap-0.5 rounded-xl border border-bordure bg-surface px-4 py-3 transition-colors duration-200 active:bg-surface-haut"
                >
                  <span className="line-clamp-2 text-[14.5px] leading-snug text-texte">
                    {resultat.titre}
                  </span>
                  <span className="truncate text-[12px] text-tres-doux">
                    {resultat.detail}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {groupe.total > groupe.resultats.length && filtre === undefined && (
            <button
              type="button"
              onClick={() => lancer(requete, groupe.type)}
              className="min-h-10 self-start text-[12.5px] text-tres-doux"
            >
              Voir les {groupe.total} résultats
            </button>
          )}
        </section>
      ))}
    </div>
  );
}

function Pastille({
  libelle,
  actif,
  onClick,
}: {
  libelle: string;
  actif: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className="min-h-9 rounded-full border px-3 text-[12px] transition-colors duration-200"
      style={{
        borderColor: actif ? "var(--color-bordure-vive)" : "var(--color-bordure)",
        backgroundColor: actif ? "var(--color-surface-haut)" : "transparent",
        color: actif ? "var(--color-texte)" : "var(--color-tres-doux)",
      }}
    >
      {libelle}
    </button>
  );
}
