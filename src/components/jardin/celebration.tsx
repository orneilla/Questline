"use client";

import { useEffect, useState } from "react";

import { mesurerPaquet } from "@/app/(app)/cartes/actions";
import {
  especePour,
  LIBELLES_STADES,
  Plante,
  prochainSeuil,
  stadePour,
  type Espece,
} from "./plante";

/**
 * Fin de session.
 *
 * Une plante qui pousse, une phrase, rien de plus. Pas de score, pas de série,
 * pas de comparaison : ce qu'on montre, c'est l'état réel du paquet après le
 * travail qui vient d'être fait. Quand un stade est franchi, on le dit ; sinon
 * on se tait sur le sujet plutôt que d'annoncer ce qui manque.
 */

export function Celebration({
  paquetId,
  paquetNom,
  espaceId,
  teinte,
  maitriseAvant,
  cartesVues,
}: {
  paquetId: number | null;
  paquetNom: string;
  espaceId: number | null;
  teinte?: string;
  /** Maîtrise relevée à l'ouverture de la session. */
  maitriseAvant: number;
  cartesVues: number;
}) {
  const [maitrise, setMaitrise] = useState<number | null>(null);

  // La maîtrise se relit après coup : les écritures de la session viennent
  // seulement d'être vidées, et c'est le nouvel état qui a de l'intérêt.
  useEffect(() => {
    let vivant = true;
    void mesurerPaquet(paquetId).then((mesure) => {
      if (vivant) setMaitrise(mesure.maitrise);
    });
    return () => {
      vivant = false;
    };
  }, [paquetId]);

  const valeur = maitrise ?? maitriseAvant;
  const stade = stadePour(valeur);
  const stadeAvant = stadePour(maitriseAvant);
  const franchi = maitrise !== null && stade !== stadeAvant;
  const espece: Espece = espaceId === null ? "fleurie" : especePour(espaceId);
  const seuil = prochainSeuil(stade);

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] flex-col items-center justify-center gap-5 px-7 text-center lg:landscape:min-h-dvh">
      <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
        {paquetNom}
      </p>

      <Plante
        stade={stade}
        espece={espece}
        taille={150}
        teinte={teinte}
        anime
        titre={`${paquetNom} — ${LIBELLES_STADES[stade]}`}
      />

      <h1 className="police-titre text-[30px] leading-tight">
        {franchi ? LIBELLES_STADES[stade] : "File vide"}
      </h1>

      <p className="max-w-sm text-[15px] leading-relaxed text-doux">
        {cartesVues} carte{cartesVues > 1 ? "s" : ""} vue{cartesVues > 1 ? "s" : ""}.
        {franchi
          ? ` Le paquet passe de ${LIBELLES_STADES[stadeAvant].toLowerCase()} à ${LIBELLES_STADES[stade].toLowerCase()}.`
          : " Rien ne reste en attente."}
      </p>

      {maitrise !== null && (
        <p className="text-[13px] text-tres-doux tabular-nums">
          {valeur} % maîtrisé
          {seuil !== null && !franchi ? ` · stade suivant à ${seuil} %` : ""}
        </p>
      )}

      <a
        href="/cartes"
        className="mt-3 flex min-h-14 w-full max-w-xs items-center justify-center rounded-2xl border border-bordure-vive bg-surface-haut text-[16px] text-texte"
      >
        Revenir aux paquets
      </a>
    </div>
  );
}
