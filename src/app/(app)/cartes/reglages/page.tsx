import type { Metadata } from "next";
import Link from "next/link";

import { CourbeRetention } from "@/components/cartes/courbe-retention";
import { EcranInstallation } from "@/components/ecran-installation";
import type { PaquetChoix } from "@/components/cartes/editeur-carte";
import {
  Echanges,
  FormulaireReglages,
  PlaceOccupee,
} from "@/components/cartes/reglages-cartes";
import { chargerReglages, retention } from "@/lib/cartes/donnees";
import {
  chargerArborescence,
  etatBase,
  QUOTA_NEON_OCTETS,
  type EtatBase,
} from "@/lib/cartes/edition";
import { aujourdhui, decalerJours } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Réglages des cartes" };
export const dynamic = "force-dynamic";

/** Un an d'historique détaillé suffit largement à FSRS. */
const ARCHIVAGE_JOURS = 365;

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

export default async function PageReglagesCartes() {
  let reglages: Awaited<ReturnType<typeof chargerReglages>>;
  let courbe: Awaited<ReturnType<typeof retention>>;
  let base: EtatBase;
  let paquets: PaquetChoix[];

  try {
    const [lus, jours, etat, arbre] = await Promise.all([
      chargerReglages(),
      retention(30),
      etatBase(),
      chargerArborescence(),
    ]);
    reglages = lus;
    courbe = jours;
    base = etat;
    paquets = arbre.flatMap((espace) =>
      espace.paquets.map((p) => ({
        id: p.id,
        nom: p.nom,
        espaceNom: espace.nom,
        couleur: espace.couleur,
      })),
    );
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-9 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Link
          href="/cartes"
          className="text-[12px] tracking-[0.14em] text-tres-doux uppercase transition-colors duration-300 active:text-doux"
        >
          ← Cartes
        </Link>
        <h1 className="police-titre text-[34px] leading-none">Réglages des cartes</h1>
      </header>

      <Section
        titre="Rétention"
        aide="Trente derniers jours. La ligne pointillée est la rétention visée."
      >
        <CourbeRetention
          jours={courbe}
          cible={Math.round(reglages.retentionCible * 100)}
        />
      </Section>

      <Section
        titre="Ordonnancement"
        aide="Ces réglages gouvernent FSRS. Les modifier ne recalcule pas le passé : ils s'appliquent aux révisions à venir."
      >
        <FormulaireReglages reglages={reglages} />
      </Section>

      <Section titre="Place occupée">
        <PlaceOccupee
          base={base}
          quota={QUOTA_NEON_OCTETS}
          archivageParDefaut={decalerJours(aujourdhui(), -ARCHIVAGE_JOURS)}
        />
      </Section>

      <Section titre="Export et import">
        <Echanges paquets={paquets} />
      </Section>
    </main>
  );
}
