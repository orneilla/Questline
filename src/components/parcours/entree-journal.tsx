"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  actionCorrigerPhrase,
  actionCorrigerSaison,
  actionRafraichirJournal,
} from "@/app/(app)/parcours/actions";

/**
 * Une entrée du journal, relisible et corrigeable.
 *
 * Par défaut elle se lit, simplement. « Corriger » la rouvre dans le même
 * esprit que le champ du soir : on écrit, ça s'enregistre tout seul, il n'y a
 * pas de bouton « valider ». Une faute de frappe ne mérite pas une cérémonie.
 *
 * Le texte reste celui qui a été écrit : rien n'est reformulé, rien n'est
 * corrigé automatiquement.
 */

const DELAI_AUTOSAVE_MS = 900;

export function EntreeJournal({
  texte: initial,
  cle,
  limite,
}: {
  texte: string;
  /** Ce que la correction vise : un jour daté, ou une saison numérotée. */
  cle: { type: "phrase"; date: string } | { type: "saison"; numero: number };
  limite: number;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState(initial);
  const [etat, setEtat] = useState<"repos" | "saisie" | "enregistre">("repos");
  const champ = useRef<HTMLTextAreaElement>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dernierEnregistre = useRef(initial);

  const enregistrer = useCallback(
    async (valeur: string) => {
      if (valeur === dernierEnregistre.current) return;
      dernierEnregistre.current = valeur;
      if (cle.type === "phrase") await actionCorrigerPhrase(cle.date, valeur);
      else await actionCorrigerSaison(cle.numero, valeur);
      setEtat("enregistre");
    },
    [cle],
  );

  const ajusterHauteur = useCallback(() => {
    const el = champ.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (ouvert) ajusterHauteur();
  }, [ouvert, ajusterHauteur]);

  // Filet de sécurité : ne rien perdre si l'app passe en arrière-plan.
  useEffect(() => {
    if (!ouvert) return;
    const vider = () => {
      if (minuteur.current) clearTimeout(minuteur.current);
      void enregistrer(champ.current?.value ?? "");
    };
    document.addEventListener("visibilitychange", vider);
    window.addEventListener("pagehide", vider);
    return () => {
      document.removeEventListener("visibilitychange", vider);
      window.removeEventListener("pagehide", vider);
    };
  }, [ouvert, enregistrer]);

  function changer(valeur: string) {
    setTexte(valeur);
    setEtat("saisie");
    ajusterHauteur();
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => void enregistrer(valeur), DELAI_AUTOSAVE_MS);
  }

  async function terminer() {
    if (minuteur.current) clearTimeout(minuteur.current);
    await enregistrer(texte);
    setOuvert(false);
    setEtat("repos");
    // La liste ne se réordonne pas, mais une entrée vidée doit disparaître.
    await actionRafraichirJournal();
    router.refresh();
  }

  if (!ouvert) {
    return (
      <div className="flex flex-col gap-1">
        <p className="border-l border-bordure-vive pl-4 text-[15px] leading-relaxed whitespace-pre-wrap text-texte">
          {texte}
        </p>
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="min-h-9 self-start pl-4 text-left text-[11.5px] text-tres-doux transition-colors duration-300 active:text-doux"
        >
          Corriger
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={champ}
        value={texte}
        autoFocus
        onChange={(e) => changer(e.target.value)}
        onBlur={() => void enregistrer(texte)}
        rows={2}
        maxLength={limite}
        placeholder="Vider le champ retire cette entrée du journal."
        className="w-full resize-none rounded-2xl border border-bordure-vive bg-surface px-5 py-4 text-[16px] leading-relaxed text-texte outline-none transition-colors duration-500 ease-calme placeholder:text-tres-doux"
      />
      <div className="flex items-center justify-between gap-3">
        <span
          aria-live="polite"
          className="text-[11.5px] text-tres-doux transition-opacity duration-700"
          style={{ opacity: etat === "enregistre" ? 1 : 0 }}
        >
          enregistré
        </span>
        <button
          type="button"
          onClick={() => void terminer()}
          className="min-h-9 rounded-lg border border-bordure px-4 text-[12.5px] text-doux transition-colors duration-300 active:bg-surface-haut"
        >
          Terminé
        </button>
      </div>
    </div>
  );
}
