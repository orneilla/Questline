"use client";

import { useEffect } from "react";

/**
 * Dernier filet. Les pannes prévisibles — base absente, tables manquantes —
 * sont traitées en amont par les pages ; ce qui arrive ici est inattendu.
 * Autant le dire calmement, avec de quoi réessayer.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-7 pb-[env(safe-area-inset-bottom)]">
      <div className="apparait flex flex-col gap-5">
        <span
          aria-hidden
          className="block h-9 w-px bg-linear-to-b from-transparent to-bordure-vive"
        />
        <h1 className="police-titre text-[30px] leading-tight">Quelque chose a cédé</h1>
        <p className="text-[15px] leading-relaxed text-doux">
          L'écran n'a pas pu se charger. Rien n'est perdu — tes validations et ton
          momentum sont en base, intacts.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-2 min-h-14 w-full rounded-2xl border border-bordure-vive bg-surface-haut px-6 text-[16px] text-texte transition-colors duration-300 active:bg-bordure"
        >
          Réessayer
        </button>

        {error.digest && (
          <p className="text-[12px] text-tres-doux">Référence : {error.digest}</p>
        )}
      </div>
    </main>
  );
}
