import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EcranRevision } from "@/components/cartes/ecran-revision";
import { EcranInstallation } from "@/components/ecran-installation";
import { chargerPaquets, chargerSession } from "@/lib/cartes/donnees";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Révision" };
export const dynamic = "force-dynamic";

export default async function PageRevision({
  params,
}: {
  params: Promise<{ paquetId: string }>;
}) {
  const { paquetId } = await params;
  const tout = paquetId === "tout";
  const numero = tout ? null : Number(paquetId);
  if (!tout && !Number.isInteger(numero)) notFound();

  try {
    const [session, paquets] = await Promise.all([
      chargerSession(numero),
      chargerPaquets(),
    ]);

    const paquet = tout ? null : paquets.find((p) => p.id === numero);
    if (!tout && !paquet) notFound();

    if (session.cartes.length === 0) {
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-7 text-center">
          <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
            {paquet?.nom ?? "Tous les paquets"}
          </p>
          <h1 className="police-titre text-[30px] leading-tight">Rien à réviser</h1>
          <p className="max-w-sm text-[15px] leading-relaxed text-doux">
            Aucune carte n'est due aujourd'hui. Les échéances reviendront d'elles-mêmes.
          </p>
          <Link
            href="/cartes"
            className="mt-4 flex min-h-14 w-full max-w-xs items-center justify-center rounded-2xl border border-bordure-vive bg-surface-haut text-[16px] text-texte"
          >
            Revenir aux paquets
          </Link>
        </main>
      );
    }

    return (
      <EcranRevision
        cartes={session.cartes.map((c) => ({
          id: c.id,
          recto: c.recto,
          verso: c.verso,
          notes: c.notes,
          etat: c.etat,
          stabilite: c.stabilite,
          difficulte: c.difficulte,
          rechutes: c.rechutes,
          derniereRevision: c.derniereRevision,
          passages: c.passages,
        }))}
        paquetId={numero}
        paquetNom={paquet?.nom ?? "Tous les paquets"}
        reglages={{
          delaiEncoreMin: session.reglages.delaiEncoreMin,
          delaiDifficileMin: session.reglages.delaiDifficileMin,
          retentionCible: session.reglages.retentionCible,
          poidsFsrs: session.reglages.poidsFsrs,
        }}
      />
    );
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }
}
