import type { Metadata } from "next";

import { FormulaireArc } from "@/components/arcs/edition";
import { Retour } from "@/components/retour";

/**
 * Création d'un arc.
 *
 * Trois champs, et rien de plus : le reste — les étapes, les quêtes — se pose
 * après, sur la page de l'arc. Demander tout d'un coup ferait renoncer avant
 * d'avoir commencé.
 */

export const metadata: Metadata = { title: "Questline — Nouvel arc" };
export const dynamic = "force-dynamic";

export default function PageNouvelArc() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/arcs" libelle="Arcs" />
        <h1 className="police-titre text-[34px] leading-none">Nouvel arc</h1>
        <p className="text-[13px] leading-relaxed text-doux">
          Un arc est une progression longue, pas une tâche. Ses étapes et ses quêtes
          s'ajoutent ensuite, sur sa page.
        </p>
      </header>

      <FormulaireArc />
    </main>
  );
}
