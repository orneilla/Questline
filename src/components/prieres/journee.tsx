"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { basculerPriere } from "@/app/(app)/prieres/actions";
import { formaterHeure, lignesDuJour, repere, type LignePriere } from "@/lib/prieres/partage";
import type { Reperes } from "@/lib/prieres/astronomie";
import { minutesLocales } from "@/lib/dates";

/**
 * Les cinq prières d'une journée.
 *
 * ── Ce qu'on ne verra jamais ici
 *
 * Aucun compte, aucun « 3 sur 5 », aucune barre de progression, aucune série,
 * aucune couleur d'alerte sur ce qui n'est pas coché. Une prière passée sans
 * coche est simplement grise, comme une ligne qu'on n'a pas écrite. L'écran
 * n'a pas d'avis.
 *
 * ── Ce qu'on voit
 *
 * L'heure d'entrée, la fenêtre, et un geste. La prière en cours est marquée
 * parce que c'est l'information utile à l'instant où l'on ouvre — pas pour
 * presser.
 */

type Etat = { erreur?: string };

function Coche({ faite }: { faite: boolean }) {
  return (
    <span
      aria-hidden
      className="flex size-[26px] shrink-0 items-center justify-center rounded-full border transition-colors duration-300"
      style={{
        borderColor: faite ? "var(--color-doux)" : "var(--color-bordure-vive)",
        backgroundColor: faite ? "var(--color-surface-haut)" : "transparent",
      }}
    >
      {faite && (
        <svg
          viewBox="0 0 24 24"
          className="size-[13px]"
          fill="none"
          stroke="var(--color-texte)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5 10 17.5 19 7" />
        </svg>
      )}
    </span>
  );
}

function Ligne({
  ligne,
  date,
  surErreur,
}: {
  ligne: LignePriere;
  date: string;
  surErreur: (etat: Etat) => void;
}) {
  const [enAttente, demarrer] = useTransition();
  // L'état local rend le geste immédiat : sur téléphone, attendre l'aller-retour
  // serveur avant de voir la coche donne l'impression d'un appui perdu.
  const [faite, setFaite] = useState(ligne.faite);

  useEffect(() => setFaite(ligne.faite), [ligne.faite]);

  const sansHeure = !Number.isFinite(ligne.debut);
  const enCours = ligne.etat === "en_cours";

  return (
    <button
      type="button"
      disabled={enAttente}
      onClick={() => {
        const suivant = !faite;
        setFaite(suivant);
        demarrer(async () => {
          const retour = await basculerPriere(date, ligne.cle, suivant);
          if (retour.erreur) {
            setFaite(!suivant);
            surErreur({ erreur: retour.erreur });
          } else surErreur({});
        });
      }}
      aria-pressed={faite}
      className="flex min-h-[68px] w-full items-center gap-3.5 rounded-2xl border px-4 text-left transition-colors duration-300 active:bg-surface-haut disabled:opacity-60"
      style={{
        borderColor: enCours ? "var(--color-bordure-vive)" : "var(--color-bordure)",
        backgroundColor: enCours ? "var(--color-surface)" : "transparent",
      }}
    >
      <Coche faite={faite} />

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span
            className="text-[16px] leading-snug"
            style={{ color: faite ? "var(--color-texte)" : "var(--color-doux)" }}
          >
            {ligne.nom}
          </span>
          {enCours && (
            <span className="text-[10.5px] tracking-[0.12em] text-tres-doux uppercase">
              en cours
            </span>
          )}
        </span>
        <span className="truncate text-[12px] text-tres-doux">
          {sansHeure
            ? "pas d'heure ce jour-là"
            : Number.isFinite(ligne.fin)
              ? `jusqu'à ${formaterHeure(ligne.fin)}`
              : ligne.moment}
        </span>
      </span>

      <span
        className="shrink-0 text-[17px] tabular-nums"
        style={{ color: faite ? "var(--color-texte)" : "var(--color-doux)" }}
      >
        {sansHeure ? "—" : formaterHeure(ligne.debut)}
      </span>
    </button>
  );
}

export function Journee({
  date,
  reperes,
  faites,
  aujourdhui,
}: {
  date: string;
  /** Les six repères du jour, en minutes depuis minuit. NaN si absent. */
  reperes: Reperes;
  faites: string[];
  /** Vrai si la date regardée est le jour même. */
  aujourdhui: boolean;
}) {
  const lever = reperes.lever;
  const [etat, setEtat] = useState<Etat>({});
  const [maintenant, setMaintenant] = useState<number | null>(null);

  // L'heure courante ne se lit qu'une fois montée : le serveur et le navigateur
  // ne la liraient pas au même instant, et l'écart ferait sauter le repère
  // « en cours » au premier rendu.
  useEffect(() => {
    if (!aujourdhui) return;
    const relire = () => setMaintenant(minutesLocales());
    relire();
    const battement = setInterval(relire, 60_000);
    return () => clearInterval(battement);
  }, [aujourdhui]);

  const calculees = lignesDuJour(reperes, faites, maintenant);

  const enTete = repere(calculees, maintenant);

  return (
    <div className="flex flex-col gap-3">
      {enTete && (
        <p className="px-0.5 text-[13px] text-doux tabular-nums" aria-live="polite">
          {enTete}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {calculees.map((ligne) => (
          <div key={ligne.cle} className="flex flex-col gap-2">
            <Ligne ligne={ligne} date={date} surErreur={setEtat} />
            {/*
              Le lever du soleil n'est pas une prière : il ferme la fenêtre du
              Fajr, et le dire évite d'avoir à le savoir de tête.
            */}
            {ligne.cle === "fajr" && Number.isFinite(lever) && (
              <p className="flex items-center gap-2 px-1 text-[11.5px] text-tres-doux">
                <span aria-hidden className="h-px flex-1 bg-bordure" />
                lever du soleil {formaterHeure(lever)}
                <span aria-hidden className="h-px flex-1 bg-bordure" />
              </p>
            )}
          </div>
        ))}
      </div>

      {etat.erreur && (
        <p aria-live="polite" className="px-0.5 text-[12.5px] text-doux">
          {etat.erreur}
          {etat.erreur.includes("base") && (
            <>
              {" "}
              <Link href="/prieres/reglages" className="underline">
                Voir les réglages
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
