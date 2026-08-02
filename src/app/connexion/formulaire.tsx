"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { connecter, type EtatConnexion } from "./actions";

function Bouton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-2xl border border-bordure-vive bg-surface-haut px-6 text-[17px] tracking-wide text-texte transition-colors duration-300 active:bg-bordure disabled:opacity-50"
    >
      {pending ? "Un instant…" : "Entrer"}
    </button>
  );
}

export function Formulaire() {
  const [etat, action] = useActionState<EtatConnexion, FormData>(connecter, {});

  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <label htmlFor="motDePasse" className="sr-only">
        Mot de passe
      </label>
      <input
        id="motDePasse"
        name="motDePasse"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        className="min-h-14 w-full rounded-2xl border border-bordure bg-surface px-5 text-[17px] text-texte outline-none transition-colors duration-300 placeholder:text-tres-doux focus:border-bordure-vive"
        placeholder="Mot de passe"
      />
      <Bouton />
      <p
        aria-live="polite"
        className="min-h-5 px-1 text-center text-[13px] text-doux"
      >
        {etat.erreur ?? ""}
      </p>
    </form>
  );
}
