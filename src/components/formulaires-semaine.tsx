"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  ajouterCreneauRecurrent,
  ajouterEvenement,
  type Retour,
} from "@/app/semaine/actions";
import { JOURS_SEMAINE, LIBELLES_CRENEAUX } from "@/lib/constantes";
import type { CategorieCreneau } from "@/db/schema";

const CATEGORIES: CategorieCreneau[] = ["cours", "travail", "priere", "autre"];

const champ =
  "min-h-12 w-full rounded-xl border border-bordure bg-surface px-4 text-[15px] text-texte outline-none transition-colors duration-300 placeholder:text-tres-doux focus:border-bordure-vive";

function Envoyer({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl border border-bordure-vive bg-surface-haut text-[15px] text-texte transition-colors duration-300 active:bg-bordure disabled:opacity-50"
    >
      {pending ? "…" : libelle}
    </button>
  );
}

/** Le type a une valeur par défaut : on peut l'ignorer et ne remplir que trois champs. */
function ChoixType({ defaut }: { defaut: CategorieCreneau }) {
  const [choisi, setChoisi] = useState<CategorieCreneau>(defaut);
  return (
    <div className="flex gap-1.5">
      <input type="hidden" name="type" value={choisi} />
      {CATEGORIES.map((categorie) => (
        <button
          key={categorie}
          type="button"
          onClick={() => setChoisi(categorie)}
          aria-pressed={choisi === categorie}
          className="min-h-9 flex-1 rounded-lg border text-[12px] transition-colors duration-300"
          style={{
            borderColor:
              choisi === categorie ? "var(--color-bordure-vive)" : "var(--color-bordure)",
            backgroundColor: choisi === categorie ? "var(--color-surface)" : "transparent",
            color: choisi === categorie ? "var(--color-texte)" : "var(--color-tres-doux)",
          }}
        >
          {LIBELLES_CRENEAUX[categorie]}
        </button>
      ))}
    </div>
  );
}

function Horaire({ debut, fin }: { debut: string; fin: string }) {
  return (
    <div className="flex items-center gap-2">
      <input type="time" name="debut" defaultValue={debut} required className={champ} />
      <span className="shrink-0 text-[13px] text-tres-doux">à</span>
      <input type="time" name="fin" defaultValue={fin} required className={champ} />
    </div>
  );
}

function Erreur({ etat }: { etat: Retour }) {
  return (
    <p aria-live="polite" className="min-h-4 text-[12.5px] text-doux">
      {etat.erreur ?? ""}
    </p>
  );
}

export function FormulaireRecurrent({ jourParDefaut }: { jourParDefaut: number }) {
  const [etat, action] = useActionState<Retour, FormData>(ajouterCreneauRecurrent, {});
  const formulaire = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formulaire}
      action={async (donnees) => {
        await action(donnees);
        formulaire.current?.reset();
      }}
      className="flex flex-col gap-2.5"
    >
      <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
        Créneau récurrent
      </h2>

      <input
        name="titre"
        required
        maxLength={80}
        placeholder="Titre — cours, shift, sport…"
        className={champ}
      />

      <select name="jourSemaine" defaultValue={jourParDefaut} className={champ}>
        {[1, 2, 3, 4, 5, 6, 0].map((jour) => (
          <option key={jour} value={jour}>
            {JOURS_SEMAINE[jour].charAt(0).toUpperCase() + JOURS_SEMAINE[jour].slice(1)}
          </option>
        ))}
      </select>

      <Horaire debut="09:00" fin="12:00" />
      <ChoixType defaut="cours" />
      <Envoyer libelle="Ajouter à la semaine" />
      <Erreur etat={etat} />
    </form>
  );
}

export function FormulaireEvenement({ dateParDefaut }: { dateParDefaut: string }) {
  const [etat, action] = useActionState<Retour, FormData>(ajouterEvenement, {});
  const formulaire = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formulaire}
      action={async (donnees) => {
        await action(donnees);
        formulaire.current?.reset();
      }}
      className="flex flex-col gap-2.5"
    >
      <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
        Événement ponctuel
      </h2>
      <p className="-mt-1 text-[12px] leading-relaxed text-tres-doux">
        Posé sur une date, il remplace le créneau récurrent qu'il recouvre.
      </p>

      <input
        name="titre"
        required
        maxLength={80}
        placeholder="Titre — remplacement, rendez-vous…"
        className={champ}
      />
      <input name="date" type="date" defaultValue={dateParDefaut} required className={champ} />
      <Horaire debut="14:00" fin="17:00" />
      <ChoixType defaut="autre" />
      <Envoyer libelle="Ajouter à cette date" />
      <Erreur etat={etat} />
    </form>
  );
}
