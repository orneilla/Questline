import type { Metadata } from "next";

import { Televerseur } from "@/components/coran/televerseur";
import { Retour } from "@/components/retour";
import { GLOSE_DEPOSEE } from "@/lib/coran/sources";

/**
 * Dépôt d'une ressource.
 *
 * La page est volontairement vide de données : tout ce qu'elle affiche vient du
 * fichier choisi, lu dans le navigateur. Rien n'est demandé à la base avant que
 * le dépôt ne soit confirmé — ouvrir cette page n'écrit jamais rien.
 */

export const metadata: Metadata = { title: "Questline — Déposer une ressource" };
export const dynamic = "force-dynamic";

export default function PageTeleverser() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/coran/reglages" libelle="Réglages du Coran" />
        <h1 className="police-titre text-[34px] leading-none">Déposer une ressource</h1>
        <p className="text-[13px] leading-relaxed text-doux">
          Pour les ressources qui ne s'obtiennent pas par une adresse. Le fichier est
          lu ici, sur l'appareil ; ce qu'il contient t'est montré avant que la
          moindre ligne ne soit écrite.
        </p>
      </header>

      <Televerseur />

      <section className="flex flex-col gap-2 rounded-2xl border border-bordure bg-surface p-4">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Ce qui est reconnu
        </h2>
        <ul className="flex flex-col gap-1.5 text-[12.5px] leading-relaxed text-doux">
          <li>
            <span className="text-texte">Traduction mot à mot</span> — clés{" "}
            <code className="text-[11.5px]">sourate:verset:mot</code>. Remplit le sens
            du panneau mot à mot.
          </li>
          <li>
            <span className="text-texte">Traduction de versets</span> — clés{" "}
            <code className="text-[11.5px]">sourate:verset</code>. Devient une édition
            affichable en lecture.
          </li>
          <li>
            <span className="text-texte">Analyse morphologique</span> — texte tabulé,
            quatre colonnes. Remplit racine, lemme et grammaire.
          </li>
        </ul>
        <p className="text-[11.5px] leading-relaxed text-tres-doux">
          En JSON — objet à clés, objet imbriqué ou tableau — ou en base SQLite. Le
          type est déduit du contenu, jamais du nom du fichier.
        </p>
      </section>

      <p className="text-[11.5px] leading-relaxed text-tres-doux">
        {GLOSE_DEPOSEE.note} {GLOSE_DEPOSEE.fournisseur} : {GLOSE_DEPOSEE.lienFournisseur}.{" "}
        {GLOSE_DEPOSEE.origine} : {GLOSE_DEPOSEE.lienOrigine}.
      </p>
    </main>
  );
}
