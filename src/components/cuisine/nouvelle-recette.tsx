"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { actionCreerRecette } from "@/app/(app)/cuisine/recettes/actions";
import { MODES_CUISSON } from "@/lib/cuisine/nutrition";

/**
 * Création d'une recette.
 *
 * Le strict minimum : un nom, un nombre de portions, une cuisson. Le reste —
 * ingrédients, grammages, poids du plat fini — se remplit sur la fiche, au fur
 * et à mesure qu'on cuisine. Demander tout d'un coup ferait renoncer avant la
 * première ligne.
 */
export function NouvelleRecette() {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [portions, setPortions] = useState("2");
  const [cuisson, setCuisson] = useState("poele");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enAttente, demarrer] = useTransition();

  const champ =
    "min-h-12 w-full rounded-xl border border-bordure bg-surface px-3 text-[15px] text-texte placeholder:text-tres-doux";

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex min-h-14 items-center justify-center rounded-2xl border border-bordure-vive bg-surface-haut text-[15px] text-texte transition-colors duration-300 active:bg-bordure"
      >
        Nouvelle recette
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-bordure-vive p-4">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Nom du plat"
        aria-label="Nom du plat"
        autoFocus
        className={champ}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={portions}
          onChange={(e) => setPortions(e.target.value)}
          type="number"
          inputMode="numeric"
          min={1}
          aria-label="Nombre de portions"
          className={champ}
        />
        <select
          value={cuisson}
          onChange={(e) => setCuisson(e.target.value)}
          aria-label="Mode de cuisson"
          className={champ}
        >
          {MODES_CUISSON.map((m) => (
            <option key={m.cle} value={m.cle}>
              {m.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="min-h-12 flex-1 rounded-xl border border-bordure text-[13.5px] text-doux"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={enAttente || nom.trim().length === 0}
          onClick={() =>
            demarrer(async () => {
              const r = await actionCreerRecette({
                nom,
                instructions: "",
                tempsMinutes: 0,
                modeCuisson: cuisson,
                nbPortions: Number(portions) || 1,
                poidsTotalCuitG: null,
                jeReferai: true,
              });
              if (r.id) {
                router.push(`/cuisine/recettes/${r.id}`);
                router.refresh();
              } else setErreur(r.erreur ?? null);
            })
          }
          className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[13.5px] text-texte disabled:opacity-40"
        >
          {enAttente ? "…" : "Créer"}
        </button>
      </div>

      {erreur && <p className="text-[12.5px] text-doux">{erreur}</p>}
    </div>
  );
}
