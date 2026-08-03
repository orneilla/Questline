"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ajouterMarquePage,
  memoriser,
  sauverPosition,
} from "@/app/(app)/coran/actions";
import { FORMATS } from "@/lib/coran/formats";
import type { VersetAffiche } from "@/lib/coran/donnees";
import { nomReciteur, pilePolice, urlAudio } from "@/lib/coran/sources";

/**
 * Le lecteur.
 *
 * Trois choses s'y passent en même temps et ne doivent pas se gêner : on lit,
 * on écoute, et l'application note où l'on en est. La lecture continue fait
 * défiler et surligne le verset en cours ; la position est enregistrée en
 * arrière-plan, jamais de façon bloquante ; et la séance est journalisée en
 * quittant l'écran comme à intervalles réguliers, pour qu'une longue lecture
 * interrompue compte tout de même.
 */

export type Sources = {
  riwaya: string;
  graphie: string;
  sourceArabe: string;
  traduction: { nom: string; auteur: string } | null;
  translitteration: { nom: string; auteur: string } | null;
};

export type ReglagesLecteur = {
  reciteur: string;
  tailleArabe: number;
  policeArabe: string;
  afficherArabe: boolean;
  afficherTranslitteration: boolean;
  afficherTraduction: boolean;
};

/** Toutes les trois minutes : assez rare pour ne rien coûter, assez fréquent
 *  pour qu'une coupure ne fasse pas perdre grand-chose. */
const INTERVALLE_JOURNAL_MS = 180_000;

/** Versets lus au-delà desquels on journalise sans attendre la sortie. */
const PAS_JOURNAL = 20;

export function Lecteur({
  versets,
  reglages,
  sources,
  titre,
  versetInitial,
}: {
  versets: VersetAffiche[];
  reglages: ReglagesLecteur;
  sources: Sources;
  titre: string;
  versetInitial: number;
}) {
  const [actif, setActif] = useState<number | null>(null);
  const [continu, setContinu] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [retour, setRetour] = useState<string | null>(null);
  const [afficher, setAfficher] = useState({
    arabe: reglages.afficherArabe,
    translitteration: reglages.afficherTranslitteration,
    traduction: reglages.afficherTraduction,
  });

  const audio = useRef<HTMLAudioElement | null>(null);
  const elements = useRef(new Map<number, HTMLElement>());
  const debutSeance = useRef(Date.now());
  const premierLu = useRef(versetInitial);
  const dernierLu = useRef(versetInitial);

  /** Enregistre la séance en cours. Idempotent tant que rien n'a bougé. */
  const journaliser = useCallback(() => {
    if (dernierLu.current <= premierLu.current) return;
    const charge = JSON.stringify({
      debut: Math.min(premierLu.current, dernierLu.current),
      fin: Math.max(premierLu.current, dernierLu.current),
      secondes: Math.round((Date.now() - debutSeance.current) / 1000),
    });

    // `sendBeacon` est le seul envoi qui survive à la fermeture de la page :
    // une action serveur partirait avec l'onglet et la lecture ne compterait
    // pas. `keepalive` sert de repli là où le beacon n'existe pas.
    const envoye =
      typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
        ? navigator.sendBeacon(
            "/api/coran/lecture",
            new Blob([charge], { type: "application/json" }),
          )
        : false;

    if (!envoye) {
      void fetch("/api/coran/lecture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: charge,
        keepalive: true,
      }).catch(() => undefined);
    }

    // La séance suivante repart d'ici.
    premierLu.current = dernierLu.current;
    debutSeance.current = Date.now();
  }, [versetInitial]);

  // Journal périodique, et journal au départ de l'écran.
  useEffect(() => {
    const minuteur = setInterval(journaliser, INTERVALLE_JOURNAL_MS);
    const partir = () => journaliser();
    window.addEventListener("pagehide", partir);
    return () => {
      clearInterval(minuteur);
      window.removeEventListener("pagehide", partir);
      journaliser();
    };
  }, [journaliser]);

  // Le verset le plus bas atteint marque la progression de la lecture.
  useEffect(() => {
    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue;
          const numero = Number(entree.target.getAttribute("data-verset"));
          if (Number.isInteger(numero) && numero > dernierLu.current) {
            dernierLu.current = numero;
            void sauverPosition(numero);
            // Journal intermédiaire : arriver sur l'écran de suivi juste après
            // avoir lu ne doit pas montrer des chiffres en retard, et une
            // fermeture brutale ne doit pas effacer une longue lecture.
            if (dernierLu.current - premierLu.current >= PAS_JOURNAL) journaliser();
          }
        }
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );

    for (const element of elements.current.values()) observateur.observe(element);
    return () => observateur.disconnect();
  }, [versets, journaliser]);

  // Reprise : on ouvre là où la lecture s'était arrêtée.
  useEffect(() => {
    const cible = elements.current.get(versetInitial);
    if (cible) cible.scrollIntoView({ block: "center" });
  }, [versetInitial]);

  const jouer = useCallback(
    (numero: number) => {
      const lecteur = audio.current;
      if (!lecteur) return;
      lecteur.src = urlAudio(reglages.reciteur, numero);
      setActif(numero);
      void lecteur.play().catch(() => {
        // Récitation injoignable — hors ligne, ou CDN muet. On le dit et on
        // arrête l'enchaînement plutôt que de le laisser tourner à vide ; le
        // texte, lui, reste lisible puisqu'il vient de la base.
        setActif(null);
        setContinu(false);
        setRetour("La récitation n'a pas pu être jointe. Le texte reste lisible.");
      });
    },
    [reglages.reciteur],
  );

  // Défilement sur le verset récité.
  useEffect(() => {
    if (actif === null) return;
    elements.current
      .get(actif)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [actif]);

  function auBout(): void {
    if (!continu || actif === null) {
      setActif(null);
      return;
    }
    const rang = versets.findIndex((v) => v.numero === actif);
    const suivant = versets[rang + 1];
    if (!suivant) {
      setActif(null);
      setContinu(false);
      return;
    }
    jouer(suivant.numero);
  }

  const bascule = (cle: keyof typeof afficher, libelle: string) => (
    <button
      type="button"
      aria-pressed={afficher[cle]}
      onClick={() => setAfficher((a) => ({ ...a, [cle]: !a[cle] }))}
      className="min-h-9 rounded-lg border px-3 text-[12px] transition-colors duration-200"
      style={{
        borderColor: afficher[cle] ? "var(--color-bordure-vive)" : "var(--color-bordure)",
        backgroundColor: afficher[cle] ? "var(--color-surface-haut)" : "transparent",
        color: afficher[cle] ? "var(--color-texte)" : "var(--color-tres-doux)",
      }}
    >
      {libelle}
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <audio ref={audio} onEnded={auBout} preload="none" className="sr-only" />

      <div className="flex flex-wrap items-center gap-2">
        {bascule("arabe", "arabe")}
        {sources.translitteration && bascule("translitteration", "translittération")}
        {sources.traduction && bascule("traduction", "traduction")}

        <button
          type="button"
          onClick={() => {
            if (continu) {
              setContinu(false);
              audio.current?.pause();
              setActif(null);
              return;
            }
            setContinu(true);
            jouer(actif ?? versets[0].numero);
          }}
          className="ml-auto min-h-9 rounded-lg border border-bordure-vive bg-surface-haut px-3 text-[12px] text-texte transition-colors duration-200"
        >
          {continu ? "Arrêter la lecture" : "Lecture continue"}
        </button>
      </div>

      {retour && (
        <p aria-live="polite" className="text-[12.5px] text-doux">
          {retour}
        </p>
      )}

      <ol className="flex flex-col">
        {versets.map((verset) => {
          const enCours = actif === verset.numero;
          return (
            <li
              key={verset.numero}
              data-verset={verset.numero}
              ref={(element) => {
                if (element) elements.current.set(verset.numero, element);
                else elements.current.delete(verset.numero);
              }}
              className="border-b border-bordure py-5 transition-colors duration-500"
              style={{
                backgroundColor: enCours ? "var(--color-voile)" : "transparent",
                boxShadow: enCours ? "inset 2px 0 0 0 var(--color-deen)" : undefined,
              }}
            >
              <div className="flex items-center justify-between gap-3 px-1">
                <button
                  type="button"
                  onClick={() => setOuvert(ouvert === verset.numero ? null : verset.numero)}
                  aria-expanded={ouvert === verset.numero}
                  className="min-h-9 rounded-lg px-2 text-[11.5px] text-tres-doux tabular-nums transition-colors duration-200 active:text-doux"
                >
                  {verset.sourate}:{verset.numeroDansSourate}
                  {verset.sajda ? " · sajda" : ""}
                </button>

                <button
                  type="button"
                  onClick={() => (enCours ? audio.current?.pause() : jouer(verset.numero))}
                  aria-label={`Écouter le verset ${verset.sourate}:${verset.numeroDansSourate}`}
                  className="flex size-9 items-center justify-center rounded-lg text-tres-doux transition-colors duration-200 active:text-texte"
                >
                  <svg viewBox="0 0 24 24" className="size-[15px]" fill="currentColor" aria-hidden>
                    {enCours ? (
                      <path d="M8 5.5h3v13H8zM13 5.5h3v13h-3z" />
                    ) : (
                      <path d="M8 5.4v13.2l10-6.6z" />
                    )}
                  </svg>
                </button>
              </div>

              {afficher.arabe && (
                <p
                  dir="rtl"
                  lang="ar"
                  className="px-1 pt-3 text-right"
                  style={{
                    fontFamily: pilePolice(reglages.policeArabe),
                    fontSize: `${reglages.tailleArabe}px`,
                    lineHeight: 2.15,
                  }}
                >
                  {verset.arabe}
                </p>
              )}

              {afficher.translitteration && verset.translitteration && (
                <p className="px-1 pt-3 text-[13.5px] leading-relaxed text-tres-doux italic">
                  {verset.translitteration}
                </p>
              )}

              {afficher.traduction && verset.traduction && (
                <p className="px-1 pt-3 text-[15px] leading-relaxed text-doux">
                  {verset.traduction}
                </p>
              )}

              {ouvert === verset.numero && (
                <ActionsVerset
                  verset={verset}
                  surRetour={(texte) => {
                    setRetour(texte);
                    setOuvert(null);
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>

      <footer className="flex flex-col gap-1 pt-2 text-[11.5px] leading-relaxed text-tres-doux">
        <p>
          Texte arabe : {sources.riwaya}, graphie {sources.graphie}. {sources.sourceArabe}.
        </p>
        {sources.traduction && (
          <p>
            Traduction : {sources.traduction.nom} — {sources.traduction.auteur}.
          </p>
        )}
        {sources.translitteration && (
          <p>Translittération : {sources.translitteration.auteur}.</p>
        )}
        <p>Récitation : {nomReciteur(reglages.reciteur)}, diffusée depuis islamic.network.</p>
      </footer>
    </div>
  );
}

function ActionsVerset({
  verset,
  surRetour,
}: {
  verset: VersetAffiche;
  surRetour: (texte: string) => void;
}) {
  const [nom, setNom] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function lancer(action: () => Promise<{ erreur?: string; message?: string }>) {
    setEnCours(true);
    const resultat = await action();
    setEnCours(false);
    surRetour(resultat.erreur ?? resultat.message ?? "");
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-bordure bg-surface p-3">
      <p className="text-[11px] tracking-[0.14em] text-tres-doux uppercase">Mémoriser</p>
      <div className="flex flex-wrap gap-2">
        {FORMATS.map((format) => (
          <button
            key={format.valeur}
            type="button"
            disabled={enCours}
            title={format.aide}
            onClick={() => void lancer(() => memoriser(verset.numero, format.valeur))}
            className="min-h-10 rounded-lg border border-bordure px-3 text-[12.5px] text-doux transition-colors duration-200 active:bg-surface-haut disabled:opacity-50"
          >
            {format.libelle}
          </button>
        ))}
      </div>

      <p className="text-[11px] tracking-[0.14em] text-tres-doux uppercase">Marque-page</p>
      <div className="flex gap-2">
        <input
          value={nom}
          onChange={(evenement) => setNom(evenement.target.value)}
          placeholder="Un nom, pour le retrouver"
          maxLength={120}
          className="min-h-11 flex-1 rounded-lg border border-bordure bg-fond px-3 text-[14px] text-texte outline-none focus:border-bordure-vive"
        />
        <button
          type="button"
          disabled={enCours}
          onClick={() => void lancer(() => ajouterMarquePage(verset.numero, nom))}
          className="min-h-11 shrink-0 rounded-lg border border-bordure-vive bg-surface-haut px-4 text-[13px] text-texte disabled:opacity-50"
        >
          Poser
        </button>
      </div>
    </div>
  );
}
