"use client";

import { useActionState } from "react";

import {
  ajouterQuete,
  basculerArc,
  basculerQuete,
  modifierArc,
  modifierCreneauRecurrent,
  modifierEvenement,
  modifierQuete,
  supprimerCreneauRecurrent,
  supprimerEvenement,
  supprimerQuete,
  type Retour,
} from "@/app/(app)/reglages/actions";
import type { Arc, CreneauRecurrent, Evenement, Quete } from "@/db/schema";
import { JOURS_SEMAINE, LIBELLES_CRENEAUX } from "@/lib/constantes";
import {
  Bascule,
  BoutonSupprimer,
  Depliant,
  Envoyer,
  Retourner,
  champ,
  etiquette,
} from "./briques";

const CATEGORIES = ["cours", "travail", "priere", "autre"] as const;
const ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0];

function majuscule(mot: string): string {
  return mot.charAt(0).toUpperCase() + mot.slice(1);
}

function ChoixType({ defaut }: { defaut: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={etiquette}>Type</span>
      <select name="type" defaultValue={defaut} className={champ}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {LIBELLES_CRENEAUX[c]}
          </option>
        ))}
      </select>
    </label>
  );
}

/* --------------------------------- Créneaux -------------------------------- */

export function EditeurCreneau({ creneau }: { creneau: CreneauRecurrent }) {
  const [etat, action] = useActionState<Retour, FormData>(modifierCreneauRecurrent, {});

  return (
    <Depliant
      titre={creneau.titre}
      detail={`${majuscule(JOURS_SEMAINE[creneau.jourSemaine])} · ${creneau.debut.slice(0, 5)} – ${creneau.fin.slice(0, 5)} · ${LIBELLES_CRENEAUX[creneau.type]}`}
    >
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={creneau.id} />

        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Titre</span>
          <input name="titre" defaultValue={creneau.titre} required maxLength={80} className={champ} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Jour</span>
          <select name="jourSemaine" defaultValue={creneau.jourSemaine} className={champ}>
            {ORDRE_JOURS.map((j) => (
              <option key={j} value={j}>
                {majuscule(JOURS_SEMAINE[j])}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={etiquette}>Début</span>
            <input type="time" name="debut" defaultValue={creneau.debut.slice(0, 5)} required className={champ} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={etiquette}>Fin</span>
            <input type="time" name="fin" defaultValue={creneau.fin.slice(0, 5)} required className={champ} />
          </label>
        </div>

        <ChoixType defaut={creneau.type} />
        <Envoyer />
        <Retourner etat={etat} />
      </form>

      <BoutonSupprimer
        action={async () => supprimerCreneauRecurrent(creneau.id)}
        avertissement="Ce créneau disparaît de toutes les semaines, passées comme à venir. Le temps disponible des jours concernés sera recalculé."
      />
    </Depliant>
  );
}

/* -------------------------------- Événements ------------------------------- */

export function EditeurEvenement({ evenement }: { evenement: Evenement }) {
  const [etat, action] = useActionState<Retour, FormData>(modifierEvenement, {});
  const annulation = evenement.debut === evenement.fin;

  return (
    <Depliant
      titre={evenement.titre}
      detail={
        annulation
          ? `${evenement.date} · annulation`
          : `${evenement.date} · ${evenement.debut.slice(0, 5)} – ${evenement.fin.slice(0, 5)}`
      }
    >
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={evenement.id} />

        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Titre</span>
          <input name="titre" defaultValue={evenement.titre} required maxLength={80} className={champ} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Date</span>
          <input type="date" name="date" defaultValue={evenement.date} required className={champ} />
        </label>

        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={etiquette}>Début</span>
            <input type="time" name="debut" defaultValue={evenement.debut.slice(0, 5)} required className={champ} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={etiquette}>Fin</span>
            <input type="time" name="fin" defaultValue={evenement.fin.slice(0, 5)} required className={champ} />
          </label>
        </div>

        <ChoixType defaut={evenement.type} />

        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Note</span>
          <input name="note" defaultValue={evenement.note} maxLength={500} className={champ} />
        </label>

        {annulation && (
          <p className="text-[12px] leading-relaxed text-tres-doux">
            Début et fin identiques : cet événement annule le créneau récurrent qu'il
            recouvre, sans rien occuper.
          </p>
        )}

        <Envoyer />
        <Retourner etat={etat} />
      </form>

      <BoutonSupprimer
        action={async () => supprimerEvenement(evenement.id)}
        avertissement="Cet événement disparaît. S'il annulait un créneau récurrent, celui-ci reprendra sa place ce jour-là."
      />
    </Depliant>
  );
}

/* ---------------------------------- Quêtes --------------------------------- */

function ChampsQuete({ quete }: { quete?: Quete }) {
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Titre</span>
        <input
          name="titre"
          defaultValue={quete?.titre ?? ""}
          required
          maxLength={120}
          placeholder="Le geste, formulé simplement"
          className={champ}
        />
      </label>

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className={etiquette}>Poids</span>
          <input
            type="number"
            name="poids"
            defaultValue={quete?.poids ?? 3}
            min={1}
            max={10}
            required
            className={champ}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className={etiquette}>Durée</span>
          <input
            type="number"
            name="dureeMin"
            defaultValue={quete?.dureeMin ?? 20}
            min={0}
            max={600}
            step={5}
            required
            className={champ}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className={etiquette}>Par sem.</span>
          <input
            type="number"
            name="frequenceSem"
            defaultValue={quete?.frequenceSem ?? 7}
            min={1}
            max={7}
            required
            className={champ}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={etiquette}>Jours exclus</legend>
        <div className="flex flex-wrap gap-1.5">
          {ORDRE_JOURS.map((jour) => (
            <label
              key={jour}
              className="flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border border-bordure px-2 text-[12px] text-doux has-checked:border-bordure-vive has-checked:bg-surface-haut has-checked:text-texte"
            >
              <input
                type="checkbox"
                name="joursExclus"
                value={jour}
                defaultChecked={quete?.joursExclus.includes(jour) ?? false}
                className="sr-only"
              />
              {JOURS_SEMAINE[jour].slice(0, 3)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-bordure px-4">
        <span className="text-[14px] text-doux">Version minimale</span>
        <input
          type="checkbox"
          name="minimale"
          defaultChecked={quete?.minimale ?? false}
          className="size-5 accent-[var(--color-doux)]"
        />
      </label>
    </>
  );
}

export function EditeurQuete({ quete }: { quete: Quete }) {
  const [etat, action] = useActionState<Retour, FormData>(modifierQuete, {});

  return (
    <Depliant
      titre={quete.titre}
      attenue={!quete.actif}
      detail={`poids ${quete.poids} · ${quete.dureeMin > 0 ? `${quete.dureeMin} min` : "au fil du jour"} · ${quete.frequenceSem}×/sem${quete.minimale ? " · minimale" : ""}${quete.actif ? "" : " · désactivée"}`}
    >
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={quete.id} />
        <ChampsQuete quete={quete} />
        <Envoyer />
        <Retourner etat={etat} />
      </form>

      <div className="mt-3 flex flex-col gap-2">
        <Bascule
          actif={quete.actif}
          libelleActif="Active — elle peut sortir"
          libelleInactif="Désactivée — elle ne sort plus"
          action={async (suivant) => basculerQuete(quete.id, suivant)}
        />
        <BoutonSupprimer
          action={async () => supprimerQuete(quete.id)}
          avertissement="La quête et toutes ses validations passées sont supprimées définitivement. Pour la retirer sans perdre son histoire, préfère la désactiver."
        />
      </div>
    </Depliant>
  );
}

export function AjoutQuete({ arcId }: { arcId: number }) {
  const [etat, action] = useActionState<Retour, FormData>(ajouterQuete, {});

  return (
    <Depliant titre="Ajouter une quête" detail="à cet arc">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="arcId" value={arcId} />
        <ChampsQuete />
        <Envoyer libelle="Ajouter" />
        <Retourner etat={etat} />
      </form>
    </Depliant>
  );
}

/* ----------------------------------- Arcs ---------------------------------- */

export function EditeurArc({
  arc,
  children,
}: {
  arc: Arc;
  children?: React.ReactNode;
}) {
  const [etat, action] = useActionState<Retour, FormData>(modifierArc, {});

  return (
    <Depliant
      titre={arc.nom}
      attenue={!arc.actif}
      detail={arc.actif ? undefined : "en sommeil"}
    >
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={arc.id} />

        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Nom</span>
          <input name="nom" defaultValue={arc.nom} required maxLength={120} className={champ} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Vision</span>
          <textarea
            name="vision"
            defaultValue={arc.vision}
            rows={4}
            maxLength={1000}
            className={`${champ} resize-none py-3 leading-relaxed`}
          />
        </label>

        <Envoyer />
        <Retourner etat={etat} />
      </form>

      <div className="mt-3">
        <Bascule
          actif={arc.actif}
          libelleActif="Actif — ses quêtes peuvent sortir"
          libelleInactif="En sommeil — ses quêtes ne sortent plus"
          action={async (suivant) => basculerArc(arc.id, suivant)}
        />
      </div>

      {children && <div className="mt-4 flex flex-col gap-2">{children}</div>}
    </Depliant>
  );
}
