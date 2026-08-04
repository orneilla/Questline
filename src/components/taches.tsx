"use client";

import { useRef, useState, useTransition } from "react";

import {
  actionAjouterTache,
  actionCocherTache,
  actionPromouvoirTache,
  actionRattacherTache,
  actionSupprimerTache,
} from "@/app/(app)/jour/actions";
import { COULEURS_PILIERS, LIBELLES_PILIERS, PILIERS } from "@/lib/constantes";
import type { Pilier } from "@/db/schema";
import type { ArcDisponible, EtatTaches, TacheOuverte } from "@/lib/taches";

/**
 * À faire aujourd'hui.
 *
 * Une liste, pas un système. On tape, on valide, c'est là. Pas de formulaire,
 * pas de catégorie obligatoire, pas d'échéance : le seul champ facultatif est
 * le pilier, et ne pas le remplir est le cas normal.
 *
 * ── Les gestes
 *
 * Cocher valide. Glisser vers la gauche découvre la suppression, et un appui
 * long la découvre aussi — sur une tablette, l'un ou l'autre vient selon la
 * main. Rien ne supprime au premier geste : le glissement révèle un bouton, il
 * ne déclenche pas. Une liste où un mouvement mal assuré efface une ligne est
 * une liste dans laquelle on n'écrit plus.
 *
 * ── Ce qui n'est pas fait
 *
 * Reste. Sans couleur d'alerte, sans compteur de jours en évidence, sans
 * mention de retard — une tâche ouverte depuis huit jours s'affiche comme celle
 * d'il y a une heure. L'ancienneté n'est lisible que si on ouvre la tâche.
 */

const SEUIL_GLISSEMENT = 56;
const DUREE_APPUI_LONG = 550;

export function Taches({
  etat,
  arcs,
  seuilRecurrence,
}: {
  etat: EtatTaches;
  arcs: ArcDisponible[];
  seuilRecurrence: number;
}) {
  const [ouvert, setOuvert] = useState<number | null>(null);

  return (
    <section aria-label="À faire aujourd'hui" className="flex flex-col gap-3.5">
      <h2 className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
        À faire aujourd'hui
      </h2>

      <ChampAjout />

      {etat.ouvertes.length === 0 && etat.faitesAujourdhui.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-tres-doux">
          Rien pour l'instant. Une ligne suffit — ce qui tombe sans prévenir se
          note ici, et n'a besoin de rien d'autre.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {etat.ouvertes.map((tache) => (
            <LigneTache
              key={tache.id}
              tache={tache}
              arcs={arcs}
              seuilRecurrence={seuilRecurrence}
              deplie={ouvert === tache.id}
              surDepli={() => setOuvert(ouvert === tache.id ? null : tache.id)}
            />
          ))}

          {etat.faitesAujourdhui.map((tache) => (
            <li key={tache.id}>
              <button
                type="button"
                onClick={() => void actionCocherTache(tache.id, false)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left"
              >
                <Coche cochee />
                <span className="flex-1 truncate text-[14.5px] text-tres-doux line-through">
                  {tache.texte}
                </span>
                {tache.pilier && <Pastille pilier={tache.pilier} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ───────────────────────────── Ajout ───────────────────────────── */

function ChampAjout() {
  const [texte, setTexte] = useState("");
  const [pilier, setPilier] = useState<Pilier | null>(null);
  const [enAttente, demarrer] = useTransition();
  const champ = useRef<HTMLInputElement>(null);

  function envoyer() {
    const propre = texte.trim();
    if (propre.length === 0 || enAttente) return;
    setTexte("");
    // Le pilier reste choisi : plusieurs tâches d'affilée vont souvent au même.
    demarrer(async () => {
      await actionAjouterTache(propre, pilier);
      champ.current?.focus();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-xl border border-bordure bg-surface px-3">
        <input
          ref={champ}
          value={texte}
          onChange={(evenement) => setTexte(evenement.target.value)}
          onKeyDown={(evenement) => {
            if (evenement.key === "Enter") {
              evenement.preventDefault();
              envoyer();
            }
          }}
          enterKeyHint="done"
          placeholder="Rédiger le mémoire, appeler…"
          aria-label="Nouvelle tâche"
          className="min-h-12 flex-1 bg-transparent text-[15px] text-texte outline-none placeholder:text-tres-doux"
        />
        {texte.trim().length > 0 && (
          <button
            type="button"
            onClick={envoyer}
            disabled={enAttente}
            aria-label="Ajouter"
            className="-mr-1 flex size-11 shrink-0 items-center justify-center text-doux active:text-texte"
          >
            <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>

      <ChoixPilier
        valeur={pilier}
        surChoix={setPilier}
        libelleVide="Sans pilier"
      />
    </div>
  );
}

/**
 * Le rattachement, en pastilles.
 *
 * « Sans pilier » vient en premier et reste sélectionné par défaut : le
 * rattachement est un ajout possible, pas une case à cocher qu'on aurait
 * oubliée.
 */
function ChoixPilier({
  valeur,
  surChoix,
  libelleVide,
}: {
  valeur: Pilier | null;
  surChoix: (pilier: Pilier | null) => void;
  libelleVide: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => surChoix(null)}
        aria-pressed={valeur === null}
        className="min-h-9 rounded-full border px-3 text-[12px] transition-colors duration-200"
        style={{
          borderColor: valeur === null ? "var(--color-bordure-vive)" : "var(--color-bordure)",
          color: valeur === null ? "var(--color-doux)" : "var(--color-tres-doux)",
        }}
      >
        {libelleVide}
      </button>

      {PILIERS.map((p) => {
        const choisi = valeur === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => surChoix(choisi ? null : p)}
            aria-pressed={choisi}
            className="min-h-9 rounded-full border px-3 text-[12px] transition-colors duration-200"
            style={{
              borderColor: choisi ? COULEURS_PILIERS[p] : "var(--color-bordure)",
              backgroundColor: choisi ? `${COULEURS_PILIERS[p]}1f` : "transparent",
              color: choisi ? "var(--color-texte)" : "var(--color-tres-doux)",
            }}
          >
            {LIBELLES_PILIERS[p]}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── Une ligne ───────────────────────────── */

function LigneTache({
  tache,
  arcs,
  seuilRecurrence,
  deplie,
  surDepli,
}: {
  tache: TacheOuverte;
  arcs: ArcDisponible[];
  seuilRecurrence: number;
  deplie: boolean;
  surDepli: () => void;
}) {
  const [decalage, setDecalage] = useState(0);
  const [decouvert, setDecouvert] = useState(false);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glisse = useRef(false);

  function annulerAppuiLong() {
    if (minuterie.current) {
      clearTimeout(minuterie.current);
      minuterie.current = null;
    }
  }

  function auDebut(evenement: React.PointerEvent) {
    // La souris ne glisse pas : seul le tactile et le stylet ouvrent le geste.
    depart.current = { x: evenement.clientX, y: evenement.clientY };
    glisse.current = false;
    annulerAppuiLong();
    minuterie.current = setTimeout(() => {
      setDecouvert(true);
      setDecalage(0);
    }, DUREE_APPUI_LONG);
  }

  function auMouvement(evenement: React.PointerEvent) {
    if (!depart.current) return;
    const dx = evenement.clientX - depart.current.x;
    const dy = evenement.clientY - depart.current.y;

    // Un mouvement vertical est un défilement de page : on ne le détourne pas.
    if (Math.abs(dy) > Math.abs(dx)) {
      annulerAppuiLong();
      depart.current = null;
      setDecalage(0);
      return;
    }

    if (Math.abs(dx) > 6) {
      annulerAppuiLong();
      glisse.current = true;
    }
    setDecalage(Math.min(0, Math.max(-96, dx)));
  }

  function auRelachement() {
    annulerAppuiLong();
    if (glisse.current) {
      // Le glissement découvre le bouton ; il ne supprime jamais tout seul.
      setDecouvert(-decalage >= SEUIL_GLISSEMENT);
    }
    setDecalage(0);
    depart.current = null;
  }

  const repetee = tache.repetitions >= seuilRecurrence;

  return (
    <li className="relative overflow-hidden rounded-xl">
      {/* Le fond découvert par le glissement. */}
      {(decouvert || decalage < 0) && (
        <div className="absolute inset-y-0 right-0 flex items-center">
          <button
            type="button"
            onClick={() => void actionSupprimerTache(tache.id)}
            className="flex h-full min-h-12 items-center rounded-xl px-4 text-[13px] text-doux"
            style={{ backgroundColor: "var(--color-surface-haut)" }}
          >
            Supprimer
          </button>
        </div>
      )}

      <div
        onPointerDown={auDebut}
        onPointerMove={auMouvement}
        onPointerUp={auRelachement}
        onPointerCancel={auRelachement}
        className="relative flex min-h-12 items-center gap-3 rounded-xl bg-fond px-3 transition-transform duration-200"
        style={{ transform: `translateX(${decouvert ? -104 : decalage}px)` }}
      >
        <button
          type="button"
          onClick={() => void actionCocherTache(tache.id, true)}
          aria-label={`Valider « ${tache.texte} »`}
          className="-ml-1 flex size-11 shrink-0 items-center justify-center"
        >
          <Coche cochee={false} />
        </button>

        <button
          type="button"
          onClick={surDepli}
          className="min-w-0 flex-1 py-2 text-left"
        >
          <span className="block truncate text-[15px] text-texte">{tache.texte}</span>
          {repetee && (
            <span className="block text-[11.5px] text-tres-doux">
              faite {tache.repetitions} fois — peut devenir une quête
            </span>
          )}
        </button>

        {tache.pilier && <Pastille pilier={tache.pilier} />}
      </div>

      {decouvert && !deplie && (
        <button
          type="button"
          onClick={() => setDecouvert(false)}
          className="mt-1 min-h-9 w-full text-[12px] text-tres-doux"
        >
          Annuler
        </button>
      )}

      {deplie && (
        <DetailTache tache={tache} arcs={arcs} surFermeture={surDepli} />
      )}
    </li>
  );
}

/** Ce qu'on ne voit qu'en ouvrant : le rattachement, l'âge, la promotion. */
function DetailTache({
  tache,
  arcs,
  surFermeture,
}: {
  tache: TacheOuverte;
  arcs: ArcDisponible[];
  surFermeture: () => void;
}) {
  const [promotion, setPromotion] = useState(false);
  const [arcId, setArcId] = useState<number | null>(arcs[0]?.id ?? null);
  const [frequence, setFrequence] = useState(3);
  const [duree, setDuree] = useState(20);
  const [enAttente, demarrer] = useTransition();

  return (
    <div className="mt-1.5 mb-1 flex flex-col gap-3 rounded-xl border border-bordure bg-surface p-3.5">
      <ChoixPilier
        valeur={tache.pilier}
        surChoix={(p) => void actionRattacherTache(tache.id, p)}
        libelleVide="Libre"
      />

      <p className="text-[11.5px] text-tres-doux">
        {tache.age === 0
          ? "Notée aujourd'hui."
          : `Notée il y a ${tache.age} jour${tache.age > 1 ? "s" : ""}.`}
        {tache.pilier
          ? " Cochée, elle comptera pour son pilier."
          : " Sans pilier, elle ne compte nulle part — c'est très bien."}
      </p>

      {!promotion ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={arcs.length === 0}
            onClick={() => setPromotion(true)}
            className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux disabled:opacity-40"
          >
            En faire une quête
          </button>
          <button
            type="button"
            onClick={surFermeture}
            className="min-h-11 rounded-xl border border-bordure px-4 text-[13px] text-doux"
          >
            Fermer
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="text-[12px] leading-relaxed text-doux">
            Elle quittera cette liste pour revenir par la sélection du jour, avec
            son arc et son rythme.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] tracking-[0.1em] text-tres-doux uppercase">
              Arc de rattachement
            </span>
            <select
              value={arcId ?? ""}
              onChange={(evenement) => setArcId(Number(evenement.target.value))}
              className="min-h-11 rounded-xl border border-bordure bg-surface px-3 text-[14px] text-texte outline-none"
            >
              {arcs.map((arc) => (
                <option key={arc.id} value={arc.id}>
                  {arc.nom}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[11px] tracking-[0.1em] text-tres-doux uppercase">
                Fois / semaine
              </span>
              <input
                type="number"
                min={1}
                max={7}
                value={frequence}
                onChange={(e) => setFrequence(Number(e.target.value))}
                className="min-h-11 rounded-xl border border-bordure bg-surface px-3 text-[14px] text-texte outline-none"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[11px] tracking-[0.1em] text-tres-doux uppercase">
                Minutes
              </span>
              <input
                type="number"
                min={0}
                max={240}
                value={duree}
                onChange={(e) => setDuree(Number(e.target.value))}
                className="min-h-11 rounded-xl border border-bordure bg-surface px-3 text-[14px] text-texte outline-none"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPromotion(false)}
              className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={enAttente || arcId === null}
              onClick={() =>
                demarrer(async () => {
                  if (arcId !== null) {
                    await actionPromouvoirTache(tache.id, arcId, frequence, duree);
                  }
                })
              }
              className="min-h-11 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[13px] text-texte disabled:opacity-40"
            >
              {enAttente ? "…" : "Créer la quête"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Menus pièces ───────────────────────────── */

function Coche({ cochee }: { cochee: boolean }) {
  return (
    <span
      aria-hidden
      className="flex size-[21px] shrink-0 items-center justify-center rounded-md border transition-colors duration-200"
      style={{
        borderColor: cochee ? "var(--color-bordure-vive)" : "var(--color-bordure-vive)",
        backgroundColor: cochee ? "var(--color-surface-haut)" : "transparent",
      }}
    >
      {cochee && (
        <svg viewBox="0 0 24 24" className="size-[13px] text-doux" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
      )}
    </span>
  );
}

function Pastille({ pilier }: { pilier: Pilier }) {
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] tracking-[0.06em]"
      style={{
        backgroundColor: `${COULEURS_PILIERS[pilier]}1f`,
        color: COULEURS_PILIERS[pilier],
      }}
    >
      {LIBELLES_PILIERS[pilier]}
    </span>
  );
}
