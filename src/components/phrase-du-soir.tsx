"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { actionPhrase } from "@/app/(app)/jour/actions";

type Props = { valeurInitiale: string };

const DELAI_AUTOSAVE_MS = 900;

/**
 * Champ libre du soir, enregistré tout seul. Aucun bouton « valider » : on
 * écrit, on ferme, c'est gardé.
 */
export function PhraseDuSoir({ valeurInitiale }: Props) {
  const [texte, setTexte] = useState(valeurInitiale);
  const [etat, setEtat] = useState<"repos" | "saisie" | "enregistre">("repos");
  const champ = useRef<HTMLTextAreaElement>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dernierEnregistre = useRef(valeurInitiale);

  const enregistrer = useCallback(async (valeur: string) => {
    if (valeur === dernierEnregistre.current) return;
    dernierEnregistre.current = valeur;
    await actionPhrase(valeur);
    setEtat("enregistre");
  }, []);

  const ajusterHauteur = useCallback(() => {
    const el = champ.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    ajusterHauteur();
  }, [ajusterHauteur]);

  // Filet de sécurité : on n'attend pas le debounce si l'app passe en arrière-plan.
  useEffect(() => {
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
  }, [enregistrer]);

  function changer(valeur: string) {
    setTexte(valeur);
    setEtat("saisie");
    ajusterHauteur();
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => void enregistrer(valeur), DELAI_AUTOSAVE_MS);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Phrase du soir
        </h2>
        <span
          aria-live="polite"
          className="text-[11.5px] text-tres-doux transition-opacity duration-700"
          style={{ opacity: etat === "enregistre" ? 1 : 0 }}
        >
          enregistré
        </span>
      </div>

      <textarea
        ref={champ}
        value={texte}
        onChange={(e) => changer(e.target.value)}
        onBlur={() => void enregistrer(texte)}
        rows={2}
        maxLength={2000}
        placeholder="Ce qui restera de cette journée…"
        className="w-full resize-none rounded-2xl border border-bordure bg-surface px-5 py-4 text-[16px] leading-relaxed text-texte outline-none transition-colors duration-500 ease-calme placeholder:text-tres-doux focus:border-bordure-vive"
      />
    </section>
  );
}
