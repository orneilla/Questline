"use client";

import { useActionState, useState, useTransition } from "react";

import {
  actionAccomplirArc,
  actionAjouterEtape,
  actionArchiverArc,
  actionCreerArc,
  actionDeplacerEtape,
  actionFranchirEtape,
  actionModifierArc,
  actionModifierEtape,
  actionSupprimerEtape,
  type Retour,
} from "@/app/(app)/arcs/actions";
import { Envoyer, Retourner, champ, etiquette } from "@/components/reglages/briques";
import { COULEURS_PILIERS, LIBELLES_PILIERS, PILIERS } from "@/lib/constantes";
import { formaterDateLongue } from "@/lib/dates";
import type { Pilier } from "@/db/schema";
import type { EtapeAffichee } from "@/lib/arcs";

/**
 * Création et édition d'un arc.
 *
 * Un arc reste ce qu'il est : une progression longue avec des étapes. Ce qui se
 * saisit ici, c'est le chemin — le nom, le pilier, la vision, puis les étapes
 * dans l'ordre. Les quêtes, elles, restent le geste quotidien et se règlent
 * ailleurs : mélanger les deux ferait de l'arc une liste de courses.
 */

/* ───────────────────────────── Formulaire ───────────────────────────── */

export function FormulaireArc({
  arc,
}: {
  /** Absent : on crée. Présent : on modifie, y compris un arc du catalogue. */
  arc?: { id: number; nom: string; pilier: Pilier; vision: string };
}) {
  const [etat, action] = useActionState<Retour, FormData>(
    arc
      ? actionModifierArc.bind(null, arc.id)
      : actionCreerArc,
    {},
  );
  const [pilier, setPilier] = useState<Pilier>(arc?.pilier ?? "deen");

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Nom de l'arc</span>
        <input
          name="nom"
          defaultValue={arc?.nom ?? ""}
          placeholder="Terminer le mémoire"
          required
          className={champ}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className={etiquette}>Pilier de rattachement</span>
        <input type="hidden" name="pilier" value={pilier} />
        <div className="flex flex-wrap gap-1.5">
          {PILIERS.map((p) => {
            const choisi = pilier === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPilier(p)}
                aria-pressed={choisi}
                className="min-h-10 rounded-full border px-3.5 text-[12.5px] transition-colors duration-200"
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
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Vision</span>
        <textarea
          name="vision"
          defaultValue={arc?.vision ?? ""}
          rows={3}
          placeholder="Ce que cet arc cherche à obtenir, en une ou deux phrases."
          className={`${champ} min-h-24 py-3 leading-relaxed`}
        />
      </label>

      <Envoyer libelle={arc ? "Enregistrer" : "Créer l'arc"} />
      <Retourner etat={etat} />
    </form>
  );
}

/* ───────────────────────────── Étapes ───────────────────────────── */

export function EtapesArc({
  arcId,
  etapes,
  modifiable,
}: {
  arcId: number;
  etapes: EtapeAffichee[];
  modifiable: boolean;
}) {
  const [texte, setTexte] = useState("");
  const [enAttente, demarrer] = useTransition();

  const faites = etapes.filter((e) => e.atteinteLe !== null).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Étapes</h2>
        {etapes.length > 0 && (
          <span className="text-[12px] text-tres-doux tabular-nums">
            {faites} sur {etapes.length}
          </span>
        )}
      </div>

      {etapes.length === 0 ? (
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          Aucune étape pour l'instant. Ce sont les jalons du chemin — pas les gestes
          quotidiens, qui restent les quêtes.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {etapes.map((etape, rang) => (
            <LigneEtape
              key={etape.id}
              arcId={arcId}
              etape={etape}
              premier={rang === 0}
              dernier={rang === etapes.length - 1}
              modifiable={modifiable}
            />
          ))}
        </ol>
      )}

      {modifiable && (
        <div className="flex items-center gap-2 rounded-xl border border-bordure bg-surface px-3">
          <input
            value={texte}
            onChange={(evenement) => setTexte(evenement.target.value)}
            onKeyDown={(evenement) => {
              if (evenement.key !== "Enter") return;
              evenement.preventDefault();
              const propre = texte.trim();
              if (propre.length === 0 || enAttente) return;
              setTexte("");
              demarrer(async () => await actionAjouterEtape(arcId, propre));
            }}
            enterKeyHint="done"
            placeholder="Ajouter une étape"
            aria-label="Nouvelle étape"
            className="min-h-12 flex-1 bg-transparent text-[14.5px] text-texte outline-none placeholder:text-tres-doux"
          />
        </div>
      )}
    </section>
  );
}

function LigneEtape({
  arcId,
  etape,
  premier,
  dernier,
  modifiable,
}: {
  arcId: number;
  etape: EtapeAffichee;
  premier: boolean;
  dernier: boolean;
  modifiable: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [titre, setTitre] = useState(etape.titre);
  const [detail, setDetail] = useState(etape.detail);
  const [enAttente, demarrer] = useTransition();

  const franchie = etape.atteinteLe !== null;

  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-bordure bg-surface px-3 py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            demarrer(async () => await actionFranchirEtape(arcId, etape.id, !franchie))
          }
          aria-label={franchie ? "Revenir sur cette étape" : "Franchir cette étape"}
          className="-ml-1 flex size-11 shrink-0 items-center justify-center"
        >
          <span
            aria-hidden
            className="flex size-[19px] items-center justify-center rounded-full border transition-colors duration-200"
            style={{
              borderColor: "var(--color-bordure-vive)",
              backgroundColor: franchie ? "var(--color-surface-haut)" : "transparent",
            }}
          >
            {franchie && (
              <svg viewBox="0 0 24 24" className="size-[11px] text-doux" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7" />
              </svg>
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOuvert(!ouvert)}
          className="min-w-0 flex-1 py-1.5 text-left"
        >
          <span
            className="block text-[14.5px] leading-snug"
            style={{ color: franchie ? "var(--color-tres-doux)" : "var(--color-texte)" }}
          >
            {etape.titre}
          </span>
          {franchie && etape.atteinteLe && (
            <span className="block text-[11.5px] text-tres-doux">
              franchie le {formaterDateLongue(etape.atteinteLe)}
            </span>
          )}
          {!franchie && etape.detail && (
            <span className="block truncate text-[11.5px] text-tres-doux">
              {etape.detail}
            </span>
          )}
        </button>

        {modifiable && (
          <span className="flex shrink-0">
            <button
              type="button"
              disabled={premier || enAttente}
              onClick={() =>
                demarrer(async () => await actionDeplacerEtape(arcId, etape.id, -1))
              }
              aria-label="Monter"
              className="flex size-10 items-center justify-center text-tres-doux disabled:opacity-25"
            >
              <svg viewBox="0 0 24 24" className="size-[15px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m6 14 6-6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              disabled={dernier || enAttente}
              onClick={() =>
                demarrer(async () => await actionDeplacerEtape(arcId, etape.id, 1))
              }
              aria-label="Descendre"
              className="flex size-10 items-center justify-center text-tres-doux disabled:opacity-25"
            >
              <svg viewBox="0 0 24 24" className="size-[15px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m6 10 6 6 6-6" />
              </svg>
            </button>
          </span>
        )}
      </div>

      {ouvert && modifiable && (
        <div className="flex flex-col gap-2 border-t border-bordure pt-2.5 pb-1">
          <input
            value={titre}
            onChange={(evenement) => setTitre(evenement.target.value)}
            aria-label="Titre de l'étape"
            className={champ}
          />
          <textarea
            value={detail}
            onChange={(evenement) => setDetail(evenement.target.value)}
            rows={2}
            placeholder="Précision, facultative"
            aria-label="Détail de l'étape"
            className={`${champ} min-h-20 py-2.5 leading-relaxed`}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                demarrer(async () => {
                  await actionSupprimerEtape(arcId, etape.id);
                  setOuvert(false);
                })
              }
              className="min-h-11 rounded-xl border border-bordure px-4 text-[13px] text-doux"
            >
              Supprimer
            </button>
            <button
              type="button"
              disabled={enAttente}
              onClick={() =>
                demarrer(async () => {
                  await actionModifierEtape(arcId, etape.id, titre, detail);
                  setOuvert(false);
                })
              }
              className="min-h-11 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[13px] text-texte disabled:opacity-40"
            >
              {enAttente ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/* ───────────────────── Archiver, accomplir ───────────────────── */

export function EtatDeLArc({
  id,
  archive,
  accompliLe,
}: {
  id: number;
  archive: boolean;
  accompliLe: string | null;
}) {
  const [enAttente, demarrer] = useTransition();
  const [confirme, setConfirme] = useState(false);

  if (accompliLe) {
    return (
      <section className="flex flex-col gap-2.5 rounded-2xl border border-bordure bg-surface p-4">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Accompli</h2>
        <p className="text-[13px] leading-relaxed text-doux">
          Déclaré accompli le {formaterDateLongue(accompliLe)}. Il figure parmi les
          arcs accomplis et ne sort plus dans la sélection du jour.
        </p>
        <button
          type="button"
          disabled={enAttente}
          onClick={() => demarrer(async () => await actionAccomplirArc(id, false))}
          className="min-h-12 rounded-xl border border-bordure text-[13.5px] text-doux disabled:opacity-40"
        >
          Le rouvrir
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border border-bordure bg-surface p-4">
      <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
        État de l'arc
      </h2>
      <p className="text-[12.5px] leading-relaxed text-tres-doux">
        Archiver le met en sommeil : ses quêtes cessent de sortir, tout le reste
        demeure — validations, historique, seuils franchis. Rien n'est effacé dans
        un cas comme dans l'autre.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={enAttente}
          onClick={() => demarrer(async () => await actionArchiverArc(id, !archive))}
          className="min-h-12 flex-1 rounded-xl border border-bordure px-4 text-[13.5px] text-doux disabled:opacity-40"
        >
          {archive ? "Le réveiller" : "L'archiver"}
        </button>

        {!confirme ? (
          <button
            type="button"
            onClick={() => setConfirme(true)}
            className="min-h-12 flex-1 rounded-xl border border-bordure px-4 text-[13.5px] text-doux"
          >
            Le déclarer accompli
          </button>
        ) : (
          <button
            type="button"
            disabled={enAttente}
            onClick={() => demarrer(async () => await actionAccomplirArc(id, true))}
            className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut px-4 text-[13.5px] text-texte disabled:opacity-40"
          >
            {enAttente ? "…" : "Confirmer"}
          </button>
        )}
      </div>
    </section>
  );
}
