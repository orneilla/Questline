"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { estRtl } from "@/lib/cartes/generation";
import {
  apercuIntervalles,
  formaterIntervalle,
  NOTATIONS,
  type MemoireCarte,
  type Notation,
} from "@/lib/cartes/fsrs";
import {
  creerFile,
  noter,
  prochaine,
  restant,
  sessionTerminee,
  type File,
} from "@/lib/cartes/file";
import { ContenuCarte } from "./contenu-carte";
import { FileEcriture } from "./file-ecriture";

/**
 * Écran de révision.
 *
 * Sobre par principe : aucune décoration, aucun pixel art. Ce qui se joue ici
 * est un travail, la récompense vit ailleurs.
 *
 * La session est chargée d'un bloc, puis vit en mémoire : changer
 * d'orientation, perdre le réseau ou faire passer une carte ne provoque aucun
 * rechargement. Les écritures partent en arrière-plan et se rejouent d'elles-
 * mêmes au retour du réseau.
 */

export type CarteChargee = {
  id: number;
  recto: string;
  verso: string;
  notes: string;
  etat: "nouvelle" | "apprentissage" | "jeune" | "mure";
  stabilite: number;
  difficulte: number;
  rechutes: number;
  derniereRevision: string | null;
  passages: number;
};

export type Props = {
  cartes: CarteChargee[];
  paquetId: number | null;
  paquetNom: string;
  reglages: {
    delaiEncoreMin: number;
    delaiDifficileMin: number;
    retentionCible: number;
    poidsFsrs: number[];
  };
};

const COULEURS_NOTES: Record<Notation, string> = {
  1: "#b58a93",
  2: "#c2a567",
  3: "#8fa37e",
  4: "#6fa396",
};

export function EcranRevision({ cartes, paquetId, paquetNom, reglages }: Props) {
  const parId = useMemo(() => new Map(cartes.map((c) => [c.id, c])), [cartes]);
  const etatsInitiaux = useMemo(
    () =>
      new Map(
        cartes.map((c) => [c.id, c.etat === "nouvelle" ? "nouvelle" : "mure"] as const),
      ),
    [cartes],
  );

  const [file, setFile] = useState<File>(() => creerFile(cartes.map((c) => c.id)));
  const [revele, setRevele] = useState(false);
  const [vues, setVues] = useState(0);
  const debutSession = useRef(Date.now());
  const debutCarte = useRef(Date.now());
  const ecriture = useRef(new FileEcriture());

  // L'horloge de la file avance avec le temps réel : une carte remise à une
  // minute revient bien une minute plus tard, pas au prochain clic.
  const horloge = () => Date.now() - debutSession.current;

  const entree = prochaine(file, horloge());
  const carte = entree ? parId.get(entree.carteId) : undefined;
  const fini = sessionTerminee(file);

  const memoire: MemoireCarte | null = carte
    ? {
        stabilite: carte.stabilite,
        difficulte: carte.difficulte,
        derniereRevision: carte.derniereRevision ? new Date(carte.derniereRevision) : null,
        rechutes: carte.rechutes,
        passages: carte.passages,
      }
    : null;

  const apercu = useMemo(
    () => (memoire ? apercuIntervalles(memoire, reglages) : null),
    // La mémoire change avec la carte ; l'aperçu suit.
    [memoire?.stabilite, memoire?.difficulte, memoire?.derniereRevision, reglages],
  );

  const compteur = restant(file, etatsInitiaux);

  const appliquer = useCallback(
    (note: Notation) => {
      if (!carte) return;
      const duree = Date.now() - debutCarte.current;

      // L'écran avance tout de suite ; l'écriture suit à son rythme.
      ecriture.current.ajouter({ carteId: carte.id, note, dureeMs: duree });
      setFile((f) => noter(f, carte.id, note, reglages, horloge()));
      setVues((v) => v + 1);
      setRevele(false);
      debutCarte.current = Date.now();
    },
    [carte, reglages],
  );

  useEffect(() => {
    if (!fini) return;
    void ecriture.current.vider().then(() =>
      ecriture.current.cloreSession({
        paquetId,
        cartesVues: vues,
        dureeSecondes: Math.round((Date.now() - debutSession.current) / 1000),
      }),
    );
  }, [fini, paquetId, vues]);

  // Clavier physique : espace révèle, 1 à 4 notent.
  useEffect(() => {
    function auClavier(evenement: KeyboardEvent) {
      if (evenement.metaKey || evenement.ctrlKey || evenement.altKey) return;
      if (evenement.key === " " || evenement.key === "Enter") {
        evenement.preventDefault();
        if (!revele) setRevele(true);
        else appliquer(3);
        return;
      }
      if (revele && ["1", "2", "3", "4"].includes(evenement.key)) {
        evenement.preventDefault();
        appliquer(Number(evenement.key) as Notation);
      }
    }
    window.addEventListener("keydown", auClavier);
    return () => window.removeEventListener("keydown", auClavier);
  }, [revele, appliquer]);

  if (fini) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-7 text-center">
        <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
          {paquetNom}
        </p>
        <h1 className="police-titre text-[30px] leading-tight">File vide</h1>
        <p className="text-[15px] leading-relaxed text-doux">
          {vues} carte{vues > 1 ? "s" : ""} vue{vues > 1 ? "s" : ""}. Rien ne reste en
          attente.
        </p>
        <a
          href="/cartes"
          className="mt-4 flex min-h-14 w-full max-w-xs items-center justify-center rounded-2xl border border-bordure-vive bg-surface-haut text-[16px] text-texte"
        >
          Revenir aux paquets
        </a>
      </div>
    );
  }

  if (!carte || !apercu) return null;

  const rtlRecto = estRtl(carte.recto);
  const rtlVerso = estRtl(carte.verso);

  return (
    // Portrait : carte au-dessus, boutons en bas sous le pouce.
    // Paysage : carte à gauche, boutons en colonne à droite, pouce immobile.
    <div className="flex min-h-dvh flex-col landscape:flex-row landscape:items-stretch">
      <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-2 text-[11.5px] text-tres-doux tabular-nums landscape:hidden">
        <span className="truncate">{paquetNom}</span>
        <span aria-label="Cartes restantes">
          <span style={{ color: "#7e92b8" }}>{compteur.nouvelles}</span>
          {" · "}
          <span style={{ color: "#b58a93" }}>{compteur.apprentissage}</span>
          {" · "}
          <span style={{ color: "#8fa37e" }}>{compteur.mures}</span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => (revele ? undefined : setRevele(true))}
        aria-label={revele ? "Réponse révélée" : "Révéler la réponse"}
        className="flex flex-1 cursor-default flex-col items-center justify-center overflow-y-auto px-6 py-4 text-left landscape:py-8"
      >
        {/* Jamais étiré : le texte reste lisible même sur tablette en paysage. */}
        <div className="flex w-full max-w-[46ch] flex-col items-center gap-6 sm:max-w-[52ch]">
          <ContenuCarte texte={carte.recto} rtl={rtlRecto} role="recto" />

          {revele && (
            <>
              <span aria-hidden className="h-px w-16 bg-bordure-vive" />
              <ContenuCarte texte={carte.verso} rtl={rtlVerso} role="verso" />
              {carte.notes && (
                <p className="max-w-[46ch] text-center text-[13px] leading-relaxed text-tres-doux">
                  {carte.notes}
                </p>
              )}
            </>
          )}
        </div>
      </button>

      <div className="shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] landscape:flex landscape:w-[38%] landscape:max-w-[16rem] landscape:flex-col landscape:justify-center landscape:pb-4 landscape:pl-2">
        <div className="mb-2 hidden justify-between px-1 text-[11.5px] text-tres-doux tabular-nums landscape:flex">
          <span className="truncate">{paquetNom}</span>
          <span>
            {compteur.nouvelles} · {compteur.apprentissage} · {compteur.mures}
          </span>
        </div>

        {!revele ? (
          <button
            type="button"
            onClick={() => setRevele(true)}
            className="min-h-16 w-full rounded-2xl border border-bordure-vive bg-surface text-[17px] text-texte transition-colors duration-200 active:bg-surface-haut"
          >
            Révéler
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2 landscape:grid-cols-1">
            {NOTATIONS.map(({ note, libelle }) => (
              <button
                key={note}
                type="button"
                onClick={() => appliquer(note)}
                className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border bg-surface px-1 transition-colors duration-150 active:bg-surface-haut landscape:min-h-14 landscape:flex-row landscape:gap-2"
                style={{ borderColor: `${COULEURS_NOTES[note]}55` }}
              >
                <span
                  className="text-[13.5px] leading-none"
                  style={{ color: COULEURS_NOTES[note] }}
                >
                  {libelle}
                </span>
                <span className="text-[11px] text-tres-doux tabular-nums">
                  {formaterIntervalle(apercu[note].intervalle)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
