import type { Metadata } from "next";
import Link from "next/link";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { Suggestions } from "@/components/cuisine/suggestions";
import { calculerPropositions, type Propositions } from "@/lib/cuisine/suggestions";
import { FENETRE_ANTI_REPETITION_JOURS } from "@/lib/cuisine/moteur";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Que cuisiner" };
export const dynamic = "force-dynamic";

export default async function PageSuggestions() {
  let propositions: Propositions;

  try {
    propositions = await calculerPropositions();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/cuisine" libelle="Cuisine" />
        <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
          {propositions.nbDisponibles} article
          {propositions.nbDisponibles > 1 ? "s" : ""} disponible
          {propositions.nbDisponibles > 1 ? "s" : ""}
        </p>
        <h1 className="police-titre text-[34px] leading-none">Que cuisiner</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Calculé à partir de ton inventaire, rien d&apos;autre. Ce qui a été
          proposé ou cuisiné dans les {FENETRE_ANTI_REPETITION_JOURS} derniers jours
          ne revient pas.
        </p>
      </header>

      <Suggestions
        recettes={propositions.recettes}
        patrons={propositions.patrons}
        repetitionAssumee={propositions.repetitionAssumee}
        nbDisponibles={propositions.nbDisponibles}
      />

      <p className="border-t border-bordure pt-5 text-[12.5px] leading-relaxed text-tres-doux">
        Les combinaisons viennent de patrons de plat — des structures, pas des
        recettes. Si elles ne ressemblent pas à ta cuisine,{" "}
        <Link href="/cuisine/patrons" className="underline underline-offset-4">
          règle les patrons
        </Link>
        .
      </p>
    </main>
  );
}
