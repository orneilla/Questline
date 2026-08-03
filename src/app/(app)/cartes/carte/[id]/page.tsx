import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EcranInstallation } from "@/components/ecran-installation";
import { EditeurCarte, type PaquetChoix } from "@/components/cartes/editeur-carte";
import { chargerArborescence, chargerNote } from "@/lib/cartes/edition";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Modifier une carte" };
export const dynamic = "force-dynamic";

export default async function PageCarte({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero)) notFound();

  let note: Awaited<ReturnType<typeof chargerNote>>;
  let choix: PaquetChoix[];

  try {
    const [chargee, arbre] = await Promise.all([
      chargerNote(numero),
      chargerArborescence(),
    ]);
    note = chargee;
    choix = arbre.flatMap((espace) =>
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

  if (!note) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-7 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-5xl">
      <header className="apparait flex flex-col gap-2.5">
        <Link
          href="/cartes/recherche"
          className="text-[12px] tracking-[0.14em] text-tres-doux uppercase transition-colors duration-300 active:text-doux"
        >
          ← Chercher
        </Link>
        <h1 className="police-titre text-[34px] leading-none">Modifier</h1>
        <p className="text-[13px] text-doux">
          {note.espaceNom} · {note.paquetNom}
          {note.suspendue ? " · suspendue" : ""}
        </p>
      </header>

      <EditeurCarte paquets={choix} note={note} />
    </main>
  );
}
