import type { Metadata } from "next";

import { Formulaire } from "./formulaire";

export const metadata: Metadata = { title: "Questline — Connexion" };

export default function PageConnexion() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-7 pb-[env(safe-area-inset-bottom)]">
      <div className="apparait flex w-full max-w-sm flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-3">
          <span
            aria-hidden
            className="block h-9 w-px bg-linear-to-b from-transparent to-bordure-vive"
          />
          <h1 className="police-titre text-[34px] leading-none">Questline</h1>
          <p className="text-[13px] tracking-[0.18em] text-tres-doux uppercase">
            Reprendre le fil
          </p>
        </div>

        <Formulaire />
      </div>
    </main>
  );
}
