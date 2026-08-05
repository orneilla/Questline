"use client";

import { useState, useTransition } from "react";

import {
  compterRemise,
  remettreAZeroVie,
  type Retour,
} from "@/app/(app)/reglages/actions";
import type { Apercu } from "@/lib/remise-a-zero";
import { LIBELLES_PILIERS, PILIERS } from "@/lib/constantes";

/**
 * Remise à zéro de l'élan, des quêtes validées et des tâches faites.
 *
 * Deux temps, comme pour le Coran : on choisit, puis on lit exactement ce qui
 * va partir — avec les nombres réels, comptés en base — avant de confirmer.
 * Ce qui reste est écrit aussi noir sur blanc : les cartes, leur historique et
 * la lecture du Coran ne sont pas concernés.
 */

const champ =
  "min-h-12 w-full rounded-xl border border-bordure bg-surface px-3 text-[15px] text-texte";

function Case({
  coche,
  basculer,
  titre,
  detail,
}: {
  coche: boolean;
  basculer: () => void;
  titre: string;
  detail: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-bordure px-4 py-3">
      <input
        type="checkbox"
        checked={coche}
        onChange={basculer}
        className="mt-0.5 size-5 shrink-0 accent-[#8fa37e]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-[14.5px] text-texte">{titre}</span>
        <span className="text-[12px] leading-relaxed text-tres-doux">{detail}</span>
      </span>
    </label>
  );
}

export function RemiseAZeroVie() {
  const [portee, setPortee] = useState("");
  const [elan, setElan] = useState(true);
  const [quetesCochees, setQuetes] = useState(false);
  const [tachesCochees, setTaches] = useState(false);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();

  const rienDeCoche = !elan && !quetesCochees && !tachesCochees;
  const cible = portee === "" ? "les six piliers" : LIBELLES_PILIERS[portee as never];

  /** Toute modification invalide la confirmation en cours : on recompte. */
  function changer(action: () => void) {
    action();
    setApercu(null);
    setRetour({});
  }

  function demanderApercu() {
    demarrer(async () => setApercu(await compterRemise(portee)));
  }

  function confirmer() {
    demarrer(async () => {
      setRetour(
        await remettreAZeroVie(portee, {
          elan,
          quetes: quetesCochees,
          taches: tachesCochees,
        }),
      );
      setApercu(null);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-bordure p-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] tracking-[0.1em] text-tres-doux uppercase">
          Portée
        </span>
        <select
          value={portee}
          onChange={(e) => changer(() => setPortee(e.target.value))}
          className={champ}
        >
          <option value="">Tous les piliers</option>
          {PILIERS.map((pilier) => (
            <option key={pilier} value={pilier}>
              {LIBELLES_PILIERS[pilier]}
            </option>
          ))}
        </select>
      </label>

      <Case
        coche={elan}
        basculer={() => changer(() => setElan(!elan))}
        titre="L'élan des piliers"
        detail="La valeur retombe à zéro et l'état repart de « en attente »."
      />
      <Case
        coche={quetesCochees}
        basculer={() => changer(() => setQuetes(!quetesCochees))}
        titre="Les quêtes validées"
        detail="Les validations, les quêtes rares faites et les seuils d'arcs franchis. Les quêtes elles-mêmes restent."
      />
      <Case
        coche={tachesCochees}
        basculer={() => changer(() => setTaches(!tachesCochees))}
        titre="Les tâches accomplies"
        detail="Effacées. Les tâches encore ouvertes ne bougent pas."
      />

      {apercu === null ? (
        <button
          type="button"
          disabled={enAttente || rienDeCoche}
          onClick={demanderApercu}
          className="min-h-12 rounded-xl border border-bordure text-[14px] text-doux transition-colors duration-300 active:bg-surface-haut disabled:opacity-40"
        >
          {enAttente ? "…" : "Remettre à zéro"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-bordure-vive p-3">
          <p className="text-[12.5px] leading-relaxed text-doux">
            Portée : {cible}. Ce qui sera effacé :
          </p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[12.5px]">
            {elan && (
              <>
                <dt className="text-tres-doux">Élan remis à zéro</dt>
                <dd className="text-right text-doux tabular-nums">
                  {apercu.piliers} pilier(s)
                </dd>
              </>
            )}
            {quetesCochees && (
              <>
                <dt className="text-tres-doux">Validations de quêtes</dt>
                <dd className="text-right text-doux tabular-nums">{apercu.validations}</dd>
                <dt className="text-tres-doux">Quêtes rares faites</dt>
                <dd className="text-right text-doux tabular-nums">{apercu.quetesRares}</dd>
                <dt className="text-tres-doux">Seuils d'arcs franchis</dt>
                <dd className="text-right text-doux tabular-nums">{apercu.seuils}</dd>
              </>
            )}
            {tachesCochees && (
              <>
                <dt className="text-tres-doux">Tâches accomplies</dt>
                <dd className="text-right text-doux tabular-nums">{apercu.taches}</dd>
              </>
            )}
          </dl>
          <p className="text-[12.5px] leading-relaxed text-tres-doux">
            Ce qui reste : tes arcs, tes quêtes et tes créneaux ; toutes tes cartes et
            leur historique de révision ; toute la progression du Coran. Les tâches
            encore ouvertes restent ouvertes.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setApercu(null)}
              className="min-h-12 flex-1 rounded-xl border border-bordure text-[14px] text-doux"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={enAttente}
              onClick={confirmer}
              className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte disabled:opacity-50"
            >
              {enAttente ? "…" : "Confirmer"}
            </button>
          </div>
        </div>
      )}

      <p
        aria-live="polite"
        className="min-h-4 text-[12.5px] leading-relaxed"
        style={{ color: retour.erreur ? "var(--color-doux)" : "var(--color-tres-doux)" }}
      >
        {retour.erreur ?? retour.message ?? ""}
      </p>
    </div>
  );
}
