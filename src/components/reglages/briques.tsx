"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import type { Retour } from "@/app/(app)/reglages/actions";

export const champ =
  "min-h-12 w-full rounded-xl border border-bordure bg-surface px-4 text-[15px] text-texte outline-none transition-colors duration-300 placeholder:text-tres-doux focus:border-bordure-vive";

export const etiquette = "text-[12px] tracking-[0.1em] text-tres-doux uppercase";

/** Repli d'une section ou d'une fiche : rien n'est ouvert par défaut. */
export function Depliant({
  titre,
  detail,
  children,
  attenue = false,
}: {
  titre: string;
  detail?: string;
  children: React.ReactNode;
  attenue?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-bordure bg-surface"
      style={{ opacity: attenue ? 0.6 : 1 }}
    >
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors duration-300 active:bg-surface-haut"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] leading-snug text-texte">{titre}</span>
          {detail && <span className="text-[12px] text-tres-doux">{detail}</span>}
        </span>
        <span
          aria-hidden
          className="shrink-0 text-[16px] text-tres-doux transition-transform duration-300"
          style={{ transform: ouvert ? "rotate(45deg)" : "none" }}
        >
          +
        </span>
      </button>

      {ouvert && <div className="border-t border-bordure px-5 py-4">{children}</div>}
    </div>
  );
}

export function Envoyer({ libelle = "Enregistrer" }: { libelle?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl border border-bordure-vive bg-surface-haut text-[15px] text-texte transition-colors duration-300 active:bg-bordure disabled:opacity-50"
    >
      {pending ? "…" : libelle}
    </button>
  );
}

export function Retourner({ etat }: { etat: Retour }) {
  if (!etat.erreur && !etat.message) return <p className="min-h-4" aria-live="polite" />;
  return (
    <p
      aria-live="polite"
      className="min-h-4 text-[12.5px]"
      style={{ color: etat.erreur ? "var(--color-doux)" : "var(--color-tres-doux)" }}
    >
      {etat.erreur ?? etat.message}
    </p>
  );
}

/**
 * Suppression en deux temps. Pas de fenêtre modale : le bouton devient sa
 * propre confirmation, et se rétracte si on n'y revient pas.
 */
export function BoutonSupprimer({
  action,
  libelle = "Supprimer",
  avertissement,
}: {
  action: () => Promise<void>;
  libelle?: string;
  avertissement: string;
}) {
  const [confirme, setConfirme] = useState(false);
  const [enAttente, demarrer] = useTransition();

  if (!confirme) {
    return (
      <button
        type="button"
        onClick={() => setConfirme(true)}
        className="min-h-12 w-full rounded-xl border border-bordure text-[14px] text-doux transition-colors duration-300 active:bg-surface-haut"
      >
        {libelle}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-bordure-vive p-3">
      <p className="text-[12.5px] leading-relaxed text-doux">{avertissement}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirme(false)}
          className="min-h-12 flex-1 rounded-xl border border-bordure text-[14px] text-doux transition-colors duration-300 active:bg-surface"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={enAttente}
          onClick={() => demarrer(async () => { await action(); })}
          className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte transition-colors duration-300 active:bg-bordure disabled:opacity-50"
        >
          {enAttente ? "…" : "Confirmer"}
        </button>
      </div>
    </div>
  );
}

/** Interrupteur sobre, réutilisé pour « actif / en sommeil ». */
export function Bascule({
  actif,
  libelleActif,
  libelleInactif,
  action,
}: {
  actif: boolean;
  libelleActif: string;
  libelleInactif: string;
  action: (suivant: boolean) => Promise<void>;
}) {
  const [local, setLocal] = useState(actif);
  const [enAttente, demarrer] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={local}
      disabled={enAttente}
      onClick={() => {
        const suivant = !local;
        setLocal(suivant);
        demarrer(async () => { await action(suivant); });
      }}
      className="flex min-h-12 w-full items-center justify-between rounded-xl border border-bordure px-4 text-left transition-colors duration-300 active:bg-surface-haut disabled:opacity-60"
    >
      <span className="text-[14px] text-doux">
        {local ? libelleActif : libelleInactif}
      </span>
      <span
        aria-hidden
        className="relative h-[24px] w-[42px] shrink-0 rounded-full border transition-colors duration-500 ease-calme"
        style={{
          borderColor: local ? "var(--color-bordure-vive)" : "var(--color-bordure)",
          backgroundColor: local ? "var(--color-surface-haut)" : "transparent",
        }}
      >
        <span
          className="absolute top-1/2 size-[16px] -translate-y-1/2 rounded-full transition-all duration-500 ease-calme"
          style={{
            left: local ? "21px" : "3px",
            backgroundColor: local ? "var(--color-doux)" : "var(--color-tres-doux)",
          }}
        />
      </span>
    </button>
  );
}
