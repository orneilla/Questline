"use client";

import { useRef, useState, useTransition } from "react";

import { importerTout, type Retour } from "@/app/(app)/reglages/actions";

/**
 * Export et import de la sauvegarde complète.
 *
 * L'export passe par une route qui déclenche un téléchargement — sur tablette,
 * le fichier atterrit dans les Fichiers. L'import relit ce même fichier et
 * remplace tout : il demande donc une confirmation explicite.
 */
export function Donnees() {
  const champFichier = useRef<HTMLInputElement>(null);
  const [contenu, setContenu] = useState<{ nom: string; json: string } | null>(null);
  const [etat, setEtat] = useState<Retour>({});
  const [confirme, setConfirme] = useState(false);
  const [enAttente, demarrer] = useTransition();

  async function choisir(fichier: File | undefined) {
    setEtat({});
    setConfirme(false);
    if (!fichier) {
      setContenu(null);
      return;
    }
    setContenu({ nom: fichier.name, json: await fichier.text() });
  }

  function lancer() {
    if (!contenu) return;
    demarrer(async () => {
      const retour = await importerTout(contenu.json);
      setEtat(retour);
      setConfirme(false);
      if (!retour.erreur) {
        setContenu(null);
        if (champFichier.current) champFichier.current.value = "";
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <a
        href="/api/export"
        download
        className="flex min-h-12 items-center justify-center rounded-xl border border-bordure-vive bg-surface-haut text-[15px] text-texte transition-colors duration-300 active:bg-bordure"
      >
        Télécharger la sauvegarde
      </a>

      <p className="text-[12px] leading-relaxed text-tres-doux">
        Un fichier JSON contenant arcs, quêtes, créneaux, événements, journées,
        validations et momentum.
      </p>

      <div className="mt-2 flex flex-col gap-2 rounded-xl border border-bordure p-3">
        <span className="text-[12px] tracking-[0.1em] text-tres-doux uppercase">
          Restaurer
        </span>

        <input
          ref={champFichier}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void choisir(e.target.files?.[0])}
          className="min-h-12 w-full rounded-xl border border-bordure bg-surface px-3 py-3 text-[13px] text-doux file:mr-3 file:rounded-lg file:border-0 file:bg-surface-haut file:px-3 file:py-2 file:text-[13px] file:text-texte"
        />

        {contenu && !confirme && (
          <button
            type="button"
            onClick={() => setConfirme(true)}
            className="min-h-12 w-full rounded-xl border border-bordure text-[14px] text-doux transition-colors duration-300 active:bg-surface-haut"
          >
            Restaurer depuis {contenu.nom}
          </button>
        )}

        {contenu && confirme && (
          <div className="flex flex-col gap-2 rounded-xl border border-bordure-vive p-3">
            <p className="text-[12.5px] leading-relaxed text-doux">
              Tout le contenu actuel est remplacé par celui du fichier : arcs, quêtes,
              validations, momentum. Ce qui n'est pas dans la sauvegarde sera perdu.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirme(false)}
                className="min-h-12 flex-1 rounded-xl border border-bordure text-[14px] text-doux transition-colors duration-300 active:bg-surface"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={enAttente}
                onClick={lancer}
                className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte transition-colors duration-300 active:bg-bordure disabled:opacity-50"
              >
                {enAttente ? "…" : "Confirmer"}
              </button>
            </div>
          </div>
        )}

        <p
          aria-live="polite"
          className="min-h-4 text-[12.5px]"
          style={{ color: etat.erreur ? "var(--color-doux)" : "var(--color-tres-doux)" }}
        >
          {etat.erreur ?? etat.message ?? ""}
        </p>
      </div>
    </div>
  );
}
