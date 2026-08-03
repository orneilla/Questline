"use client";

import { useActionState, useState, useTransition } from "react";

import {
  choisirEdition,
  desinstallerEdition,
  sauverReglagesCoran,
  type Retour,
} from "@/app/(app)/coran/actions";
import {
  EDITIONS_PROPOSEES,
  POLICES,
  RECITEURS,
  type EditionProposee,
} from "@/lib/coran/sources";
import type { ReglagesCoranComplets } from "@/lib/coran/donnees";
import { Envoyer, Retourner, champ, etiquette } from "@/components/reglages/briques";

/**
 * Réglages du module.
 *
 * La partie qui compte est celle des éditions : rien n'est importé sans que ses
 * conditions aient été affichées telles que leur source les énonce. C'est la
 * seule façon de ne rien présumer d'une licence que ce projet n'accorde pas.
 */

export type EtatEdition = {
  cle: string;
  versets: number;
  complete: boolean;
};

function FicheEdition({
  proposee,
  installee,
  choisie,
  cleInstallation,
}: {
  proposee: EditionProposee;
  installee: EtatEdition | undefined;
  choisie: boolean;
  cleInstallation: string;
}) {
  const [enAttente, demarrer] = useTransition();
  const [retour, setRetour] = useState<Retour>({});
  const [conditionsLues, setConditionsLues] = useState(false);

  const adresseImport = `/api/setup/coran?key=${cleInstallation}&edition=${proposee.cle}`;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-bordure bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] leading-snug text-texte">{proposee.nom}</h3>
        <span className="shrink-0 text-[11px] text-tres-doux uppercase">
          {proposee.type === "traduction" ? proposee.langue : "translittération"}
        </span>
      </div>

      <p className="text-[12.5px] text-doux">{proposee.auteur}</p>

      <div className="flex flex-col gap-1.5 rounded-xl border border-bordure-vive p-3">
        <span className="text-[11px] tracking-[0.14em] text-tres-doux uppercase">
          Conditions, telles que la source les énonce
        </span>
        <p className="text-[12.5px] leading-relaxed text-doux">{proposee.licence}</p>
        {proposee.avertissement && (
          <p className="text-[12px] leading-relaxed text-tres-doux">
            {proposee.avertissement}
          </p>
        )}
        <a
          href={proposee.lien}
          target="_blank"
          rel="noreferrer"
          className="text-[12px] text-tres-doux underline underline-offset-4"
        >
          {proposee.lien}
        </a>
      </div>

      {installee ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-tres-doux tabular-nums">
            {installee.versets} versets en base
            {installee.complete ? "" : " — import incomplet, relance l'adresse"}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={enAttente}
              onClick={() =>
                demarrer(async () =>
                  setRetour(
                    await choisirEdition(choisie ? null : proposee.cle, proposee.type),
                  ),
                )
              }
              className="min-h-11 flex-1 rounded-xl border px-3 text-[13px] transition-colors duration-200"
              style={{
                borderColor: choisie
                  ? "var(--color-bordure-vive)"
                  : "var(--color-bordure)",
                backgroundColor: choisie ? "var(--color-surface-haut)" : "transparent",
                color: choisie ? "var(--color-texte)" : "var(--color-doux)",
              }}
            >
              {choisie ? "Affichée à la lecture" : "Afficher à la lecture"}
            </button>

            {!installee.complete && (
              <a
                href={adresseImport}
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-bordure px-3 text-[13px] text-doux"
              >
                Reprendre l'import
              </a>
            )}

            <button
              type="button"
              disabled={enAttente}
              onClick={() =>
                demarrer(async () => setRetour(await desinstallerEdition(proposee.cle)))
              }
              className="min-h-11 rounded-xl border border-bordure px-3 text-[13px] text-doux"
            >
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-doux">
            <input
              type="checkbox"
              checked={conditionsLues}
              onChange={(evenement) => setConditionsLues(evenement.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[#6fa396]"
            />
            J'ai lu ces conditions et je les accepte pour mon usage personnel.
          </label>

          {conditionsLues ? (
            <a
              href={adresseImport}
              className="flex min-h-12 items-center justify-center rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte"
            >
              Importer cette édition
            </a>
          ) : (
            <span className="flex min-h-12 items-center justify-center rounded-xl border border-bordure text-[14px] text-tres-doux">
              Importer cette édition
            </span>
          )}
        </div>
      )}

      <Retourner etat={retour} />
    </article>
  );
}

export function ReglagesCoran({
  reglages,
  installees,
  cleInstallation,
}: {
  reglages: ReglagesCoranComplets;
  installees: EtatEdition[];
  cleInstallation: string;
}) {
  const [etat, action] = useActionState<Retour, FormData>(sauverReglagesCoran, {});

  return (
    <div className="flex flex-col gap-9">
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Traduction et translittération
        </h2>
        <p className="-mt-1 text-[12px] leading-relaxed text-tres-doux">
          Le texte arabe — Hafs ‘an ‘Asim, graphie uthmanienne, projet Tanzil — est
          importé d'office : sa licence Creative Commons Attribution 3.0 est claire et
          n'exige qu'une mention de la source. Les éditions ci-dessous sont d'un autre
          ordre : chacune se lit et se choisit.
        </p>

        {EDITIONS_PROPOSEES.map((proposee) => (
          <FicheEdition
            key={proposee.cle}
            proposee={proposee}
            installee={installees.find((i) => i.cle === proposee.cle)}
            choisie={
              proposee.type === "traduction"
                ? reglages.traduction === proposee.cle
                : reglages.translitteration === proposee.cle
            }
            cleInstallation={cleInstallation}
          />
        ))}
      </section>

      <form action={action} className="flex flex-col gap-4">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Lecture</h2>

        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Récitateur</span>
          <select name="reciteur" defaultValue={reglages.reciteur} className={champ}>
            {RECITEURS.map((r) => (
              <option key={r.cle} value={r.cle}>
                {r.nom}
              </option>
            ))}
          </select>
          <span className="text-[11.5px] text-tres-doux">
            L'audio est diffusé depuis islamic.network, jamais copié en base.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Police du texte arabe</span>
          <select name="policeArabe" defaultValue={reglages.policeArabe} className={champ}>
            {POLICES.map((p) => (
              <option key={p.cle} value={p.cle}>
                {p.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Taille du texte arabe (px)</span>
          <input
            name="tailleArabe"
            type="number"
            min={18}
            max={64}
            defaultValue={reglages.tailleArabe}
            className={champ}
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className={etiquette}>Afficher par défaut</span>
          {(
            [
              ["afficherArabe", "Le texte arabe", reglages.afficherArabe],
              [
                "afficherTranslitteration",
                "La translittération",
                reglages.afficherTranslitteration,
              ],
              ["afficherTraduction", "La traduction", reglages.afficherTraduction],
            ] as const
          ).map(([nom, libelle, defaut]) => (
            <label
              key={nom}
              className="flex items-center gap-2.5 text-[14px] text-doux"
            >
              <input
                type="checkbox"
                name={nom}
                defaultChecked={defaut}
                className="size-4 accent-[#6fa396]"
              />
              {libelle}
            </label>
          ))}
        </div>

        <h2 className="mt-3 text-[13px] tracking-[0.14em] text-doux uppercase">
          Objectif quotidien
        </h2>
        <p className="-mt-2 text-[12px] leading-relaxed text-tres-doux">
          Il sert à savoir où l'on en est, pas à mesurer une valeur. Les jours où il
          n'est pas atteint ne laissent aucune trace négative.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Compté en</span>
          <select
            name="uniteObjectif"
            defaultValue={reglages.uniteObjectif}
            className={champ}
          >
            <option value="versets">Versets</option>
            <option value="pages">Pages du moushaf</option>
            <option value="minutes">Minutes</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Quantité</span>
          <input
            name="objectifQuotidien"
            type="number"
            min={1}
            max={6236}
            defaultValue={reglages.objectifQuotidien}
            className={champ}
          />
        </label>

        <Envoyer />
        <Retourner etat={etat} />
      </form>
    </div>
  );
}
