import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";

import { EcranInstallation } from "@/components/ecran-installation";
import {
  FormulaireEvenement,
  FormulaireRecurrent,
} from "@/components/formulaires-semaine";
import { Donnees } from "@/components/reglages/donnees";
import {
  AjoutQuete,
  EditeurArc,
  EditeurCreneau,
  EditeurEvenement,
  EditeurQuete,
} from "@/components/reglages/editeurs";
import { db } from "@/db";
import {
  arcs as tableArcs,
  creneauxRecurrents,
  evenements as tableEvenements,
  quetes as tableQuetes,
} from "@/db/schema";
import { COULEURS_PILIERS, LIBELLES_PILIERS, PILIERS } from "@/lib/constantes";
import { aujourdhui, jourDeLaSemaine } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Réglages" };
export const dynamic = "force-dynamic";

function Section({
  titre,
  aide,
  children,
}: {
  titre: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">{titre}</h2>
      {aide && <p className="-mt-1 text-[12px] leading-relaxed text-tres-doux">{aide}</p>}
      {children}
    </section>
  );
}

export default async function PageReglages() {
  let arcs, quetes, creneaux, evenements;

  try {
    [arcs, quetes, creneaux, evenements] = await Promise.all([
      db.select().from(tableArcs).orderBy(asc(tableArcs.id)),
      db.select().from(tableQuetes).orderBy(asc(tableQuetes.id)),
      db
        .select()
        .from(creneauxRecurrents)
        .orderBy(asc(creneauxRecurrents.jourSemaine), asc(creneauxRecurrents.debut)),
      db
        .select()
        .from(tableEvenements)
        .orderBy(asc(tableEvenements.date), asc(tableEvenements.debut)),
    ]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const cejour = aujourdhui();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-9 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10">
      <header className="apparait flex flex-col gap-2.5">
        <Link
          href="/jour"
          className="text-[12px] tracking-[0.14em] text-tres-doux uppercase transition-colors duration-300 active:text-doux"
        >
          ← Jour
        </Link>
        <h1 className="police-titre text-[34px] leading-none">Réglages</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Tout ce qui est ici se modifie et se supprime. Chaque suppression demande une
          confirmation.
        </p>
      </header>

      {PILIERS.map((pilier) => {
        const duPilier = arcs.filter((a) => a.pilier === pilier);
        if (duPilier.length === 0) return null;

        return (
          <Section key={pilier} titre={LIBELLES_PILIERS[pilier]}>
            <div className="-mt-2 mb-1 flex items-center gap-2">
              <span
                aria-hidden
                className="h-px flex-1"
                style={{ backgroundColor: COULEURS_PILIERS[pilier], opacity: 0.35 }}
              />
            </div>

            {duPilier.map((arc) => (
              <EditeurArc key={arc.id} arc={arc}>
                {quetes
                  .filter((q) => q.arcId === arc.id)
                  .map((quete) => (
                    <EditeurQuete key={quete.id} quete={quete} />
                  ))}
                <AjoutQuete arcId={arc.id} />
              </EditeurArc>
            ))}
          </Section>
        );
      })}

      <Section
        titre="Créneaux récurrents"
        aide="La trame de la semaine. Un créneau dont la fin précède le début passe minuit."
      >
        {creneaux.map((creneau) => (
          <EditeurCreneau key={creneau.id} creneau={creneau} />
        ))}
        <div className="mt-2 rounded-2xl border border-bordure px-5 py-4">
          <FormulaireRecurrent jourParDefaut={jourDeLaSemaine(cejour)} />
        </div>
      </Section>

      <Section
        titre="Événements ponctuels"
        aide="Posés sur une date, ils écrasent le récurrent qu'ils recouvrent."
      >
        {evenements.length === 0 && (
          <p className="rounded-2xl border border-bordure/60 px-5 py-5 text-center text-[13.5px] text-doux">
            Aucun événement enregistré.
          </p>
        )}
        {evenements.map((evenement) => (
          <EditeurEvenement key={evenement.id} evenement={evenement} />
        ))}
        <div className="mt-2 rounded-2xl border border-bordure px-5 py-4">
          <FormulaireEvenement dateParDefaut={cejour} />
        </div>
      </Section>

      <Section titre="Données">
        <Donnees />
      </Section>
    </main>
  );
}
