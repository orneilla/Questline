import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { ReglagesCoran } from "@/components/coran/reglages";
import { chargerReglagesCoran, type ReglagesCoranComplets } from "@/lib/coran/donnees";
import { etatImport, poidsCoran, TOTAL_VERSETS } from "@/lib/coran/import";
import { EDITION_ARABE } from "@/lib/coran/sources";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Réglages du Coran" };
export const dynamic = "force-dynamic";

/** Même clé que le reste de l'installation : une seule à retenir. */
const CLE_PAR_DEFAUT = "25afa9c6e7a8d65abf3f5e6f0b57ec8f";

function poids(octets: number | null): string {
  if (octets === null) return "taille inconnue";
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export default async function PageReglagesCoran() {
  let reglages: ReglagesCoranComplets;
  let etat: Awaited<ReturnType<typeof etatImport>>;
  let place: Awaited<ReturnType<typeof poidsCoran>>;

  try {
    [reglages, etat, place] = await Promise.all([
      chargerReglagesCoran(),
      etatImport(),
      poidsCoran(),
    ]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/coran" libelle="Coran" />
        <h1 className="police-titre text-[34px] leading-none">Réglages du Coran</h1>
      </header>

      <section className="flex flex-col gap-2 rounded-2xl border border-bordure bg-surface p-4">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Texte arabe
        </h2>
        <p className="text-[13px] leading-relaxed text-doux">
          {EDITION_ARABE.riwaya}, graphie {EDITION_ARABE.graphie}. {etat.versetsArabe} versets
          sur {TOTAL_VERSETS}.
        </p>
        <p className="text-[12px] leading-relaxed text-tres-doux">
          {EDITION_ARABE.source}.<br />
          {EDITION_ARABE.licence}
        </p>
        <p className="text-[12px] text-tres-doux tabular-nums">
          Le module occupe {poids(place.octets)} en base, sur les 512 Mo du palier
          gratuit de Neon.
        </p>
      </section>

      <ReglagesCoran
        reglages={reglages}
        installees={etat.editions.map((e) => ({
          cle: e.cle,
          versets: e.versets,
          complete: e.complete,
        }))}
        cleInstallation={process.env.SETUP_KEY ?? CLE_PAR_DEFAUT}
      />
    </main>
  );
}
