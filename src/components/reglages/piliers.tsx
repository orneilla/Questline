"use client";

import { useActionState, useState, useTransition } from "react";

import {
  actionCreerPilier,
  actionDeplacerPilier,
  actionModifierPilier,
  actionPertePilier,
  actionSupprimerPilier,
  type Retour,
} from "@/app/(app)/reglages/piliers-actions";
import { Depliant, Envoyer, Retourner, champ, etiquette } from "@/components/reglages/briques";
import { TEINTES_PILIERS, type PilierAffiche } from "@/lib/piliers-partage";
import type { PertePilier } from "@/lib/piliers";

/**
 * Gestion des piliers.
 *
 * Ils étaient six, gravés dans le schéma. Ils se renomment, se recolorient, se
 * réordonnent, s'ajoutent et se suppriment. La clé, elle, ne bouge jamais : les
 * arcs, l'élan et les tâches la portent, et la changer pour une correction
 * d'orthographe casserait tout ce qui s'y rattache.
 */

function ChoixCouleur({
  valeur,
  surChoix,
}: {
  valeur: string;
  surChoix: (couleur: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={etiquette}>Teinte</span>
      <input type="hidden" name="couleur" value={valeur} />
      <div className="flex flex-wrap gap-2">
        {TEINTES_PILIERS.map((teinte) => (
          <button
            key={teinte}
            type="button"
            onClick={() => surChoix(teinte)}
            aria-label={`Teinte ${teinte}`}
            aria-pressed={valeur === teinte}
            className="size-9 rounded-full border-2 transition-colors duration-200"
            style={{
              backgroundColor: teinte,
              borderColor:
                valeur === teinte ? "var(--color-texte)" : "var(--color-bordure)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function EditeurPilier({
  pilier,
  cles,
  premier,
  dernier,
}: {
  pilier: PilierAffiche;
  /** L'ordre courant, pour savoir où le déplacer. */
  cles: string[];
  premier: boolean;
  dernier: boolean;
}) {
  const [etat, action] = useActionState<Retour, FormData>(
    actionModifierPilier.bind(null, pilier.cle),
    {},
  );
  const [couleur, setCouleur] = useState(pilier.couleur);
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();

  return (
    <Depliant titre={pilier.nom} detail={pilier.cle}>
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Nom</span>
          <input
            name="nom"
            defaultValue={pilier.nom}
            required
            maxLength={40}
            className={champ}
          />
        </label>

        <ChoixCouleur valeur={couleur} surChoix={setCouleur} />

        <Envoyer />
        <Retourner etat={etat} />
      </form>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={premier || enAttente}
          onClick={() =>
            demarrer(async () => setRetour(await actionDeplacerPilier(cles, pilier.cle, -1)))
          }
          className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux disabled:opacity-30"
        >
          Monter
        </button>
        <button
          type="button"
          disabled={dernier || enAttente}
          onClick={() =>
            demarrer(async () => setRetour(await actionDeplacerPilier(cles, pilier.cle, 1)))
          }
          className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux disabled:opacity-30"
        >
          Descendre
        </button>
      </div>

      <Retourner etat={retour} />

      <SuppressionPilier cle={pilier.cle} />
    </Depliant>
  );
}

/**
 * Suppression d'un pilier.
 *
 * Deux temps, avec les nombres réels : un pilier emmène ses arcs, et avec eux
 * leurs quêtes et leurs validations. C'est de loin la suppression la plus
 * lourde de l'application — elle doit se lire avant de se faire.
 */
function SuppressionPilier({ cle }: { cle: string }) {
  const [perte, setPerte] = useState<PertePilier | null>(null);
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-bordure pt-3">
      {perte === null ? (
        <button
          type="button"
          disabled={enAttente}
          onClick={() =>
            demarrer(async () => {
              const retour = await actionPertePilier(cle);
              if (retour.perte) setPerte(retour.perte);
              else setRetour({ erreur: retour.erreur });
            })
          }
          className="min-h-11 self-start text-left text-[12.5px] text-tres-doux transition-colors duration-300 active:text-doux disabled:opacity-40"
        >
          {enAttente ? "…" : "Supprimer ce pilier"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-bordure-vive p-3">
          <p className="text-[12.5px] leading-relaxed text-doux">
            « {perte.nom} » et tout ce qui n'existe que par lui :
          </p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[12.5px]">
            <dt className="text-tres-doux">Arcs</dt>
            <dd className="text-right text-doux tabular-nums">{perte.arcs}</dd>
            <dt className="text-tres-doux">Quêtes</dt>
            <dd className="text-right text-doux tabular-nums">{perte.quetes}</dd>
            <dt className="text-tres-doux">Validations</dt>
            <dd className="text-right text-doux tabular-nums">{perte.validations}</dd>
            <dt className="text-tres-doux">Quêtes rares faites</dt>
            <dd className="text-right text-doux tabular-nums">{perte.quetesRares}</dd>
          </dl>
          <p className="text-[12.5px] leading-relaxed text-tres-doux">
            Son élan et sa plante au jardin partent aussi. Rien de tout cela ne se
            récupère.
            {perte.taches > 0 && (
              <>
                {" "}
                {perte.taches > 1
                  ? `${perte.taches} tâches perdent seulement leur étiquette et restent dans ta liste.`
                  : "1 tâche perd seulement son étiquette et reste dans ta liste."}
              </>
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPerte(null)}
              className="min-h-12 flex-1 rounded-xl border border-bordure text-[13.5px] text-doux"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={enAttente}
              onClick={() =>
                demarrer(async () => {
                  setRetour(await actionSupprimerPilier(cle));
                  setPerte(null);
                })
              }
              className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[13.5px] text-texte disabled:opacity-50"
            >
              {enAttente ? "…" : "Supprimer"}
            </button>
          </div>
        </div>
      )}

      <Retourner etat={retour} />
    </div>
  );
}

function AjoutPilier() {
  const [etat, action] = useActionState<Retour, FormData>(actionCreerPilier, {});
  const [couleur, setCouleur] = useState(TEINTES_PILIERS[0]);

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-bordure px-5 py-4">
      <span className={etiquette}>Nouveau pilier</span>
      <form action={action} className="flex flex-col gap-3">
        <input
          name="nom"
          placeholder="Nom du pilier"
          required
          maxLength={40}
          className={champ}
        />
        <ChoixCouleur valeur={couleur} surChoix={setCouleur} />
        <Envoyer libelle="Ajouter" />
        <Retourner etat={etat} />
      </form>
    </div>
  );
}

export function Piliers({
  liste,
  tableAbsente,
}: {
  liste: PilierAffiche[];
  /** La migration n'a pas encore été appliquée : rien n'est modifiable. */
  tableAbsente: boolean;
}) {
  const cles = liste.map((p) => p.cle);

  if (tableAbsente) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-bordure-vive p-4">
        <p className="text-[13.5px] leading-relaxed text-doux">
          La base n'est pas encore à jour : la table des piliers n'existe pas. Les six
          piliers ci-dessous fonctionnent, mais ils ne peuvent être ni renommés, ni
          réordonnés, ni supprimés tant que la migration n'a pas tourné.
        </p>
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          Ouvre l'adresse d'installation une fois, dans un onglet, puis reviens ici.
          Rien n'est réécrit : tes arcs, ton élan et ton historique restent en place.
        </p>
        <p className="rounded-xl border border-bordure bg-surface px-4 py-3 text-[12.5px] break-all text-tres-doux">
          /api/setup?key=…
        </p>
        <ul className="mt-1 flex flex-wrap gap-2">
          {liste.map((pilier) => (
            <li
              key={pilier.cle}
              className="rounded-full border px-3 py-1 text-[12.5px]"
              style={{ borderColor: pilier.couleur, color: "var(--color-doux)" }}
            >
              {pilier.nom}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {liste.map((pilier, rang) => (
        <EditeurPilier
          key={pilier.cle}
          pilier={pilier}
          cles={cles}
          premier={rang === 0}
          dernier={rang === liste.length - 1}
        />
      ))}
      <AjoutPilier />
    </div>
  );
}
