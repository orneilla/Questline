"use client";

import { Fragment, useActionState, useState, useTransition } from "react";

import {
  archiver,
  importerCsv,
  purgerImages,
  sauverReglages,
  type Retour,
} from "@/app/(app)/cartes/edition-actions";
import type { EtatBase } from "@/lib/cartes/edition";
import type { Poste as PosteBase, Repartition } from "@/lib/place";
import type { PaquetChoix } from "./editeur-carte";
import { Envoyer, Retourner, champ, etiquette } from "@/components/reglages/briques";

/**
 * Réglages du module cartes : ordonnancement, place occupée, échanges.
 *
 * Rien n'est caché derrière un « avancé ». Les nombres qui gouvernent la
 * mémoire méritent d'être visibles, et chacun est expliqué en une phrase.
 */

export type ReglagesAffiches = {
  delaiEncoreMin: number;
  delaiDifficileMin: number;
  retentionCible: number;
  nouvellesParJour: number;
  maximumParJour: number;
};

function poids(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

function Champ({
  nom,
  libelle,
  aide,
  defaut,
  pas,
  min,
  max,
}: {
  nom: string;
  libelle: string;
  aide: string;
  defaut: number;
  pas?: string;
  min: number;
  max: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={etiquette}>{libelle}</span>
      <input
        name={nom}
        type="number"
        inputMode="decimal"
        step={pas ?? "1"}
        min={min}
        max={max}
        defaultValue={defaut}
        className={champ}
      />
      <span className="text-[11.5px] leading-relaxed text-tres-doux">{aide}</span>
    </label>
  );
}

export function FormulaireReglages({ reglages }: { reglages: ReglagesAffiches }) {
  const [etat, action] = useActionState<Retour, FormData>(sauverReglages, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <Champ
        nom="retentionCible"
        libelle="Rétention visée (%)"
        aide="La part de cartes que tu veux retrouver du premier coup. Plus haut, les intervalles raccourcissent et le travail augmente. 90 % est l'équilibre habituel."
        defaut={Math.round(reglages.retentionCible * 100)}
        min={70}
        max={97}
      />
      <Champ
        nom="nouvellesParJour"
        libelle="Nouvelles cartes par jour"
        aide="Le robinet d'entrée. Chaque nouvelle carte revient ensuite des dizaines de fois : ce nombre décide de la charge des mois à venir."
        defaut={reglages.nouvellesParJour}
        min={0}
        max={500}
      />
      <Champ
        nom="maximumParJour"
        libelle="Maximum de cartes par jour"
        aide="Plafond de sécurité les jours où beaucoup d'échéances tombent ensemble. Le report se résorbe de lui-même."
        defaut={reglages.maximumParJour}
        min={1}
        max={2000}
      />
      <Champ
        nom="delaiEncoreMin"
        libelle="Retour après « Encore » (min)"
        aide="Combien de minutes avant qu'une carte ratée revienne dans la même session."
        defaut={reglages.delaiEncoreMin}
        pas="0.5"
        min={0.5}
        max={60}
      />
      <Champ
        nom="delaiDifficileMin"
        libelle="Retour après « Difficile » (min)"
        aide="Même chose pour une carte retrouvée péniblement."
        defaut={reglages.delaiDifficileMin}
        pas="0.5"
        min={0.5}
        max={240}
      />

      <Envoyer />
      <Retourner etat={etat} />
    </form>
  );
}

/** Une ligne de poste : son nom, son poids, sa part du total. */
function Poste({
  poste,
  total,
  teinte,
}: {
  poste: PosteBase;
  total: number;
  teinte: string;
}) {
  const part = total > 0 ? poste.octets / total : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-doux">{poste.nom}</span>
        <span className="shrink-0 text-texte tabular-nums">{poids(poste.octets)}</span>
      </div>
      <span
        aria-hidden
        className="flex h-1 w-full overflow-hidden rounded-full bg-bordure"
      >
        <span
          style={{ width: `${Math.max(0.5, Math.min(100, part * 100))}%`, backgroundColor: teinte }}
        />
      </span>
      <p className="text-[11.5px] leading-relaxed text-tres-doux">{poste.aide}</p>
      {poste.lignes.length > 0 && (
        <dl className="mt-0.5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-l border-bordure pl-3 text-[12px]">
          {poste.lignes.map((ligne) => (
            <Fragment key={ligne.nom}>
              <dt className="text-tres-doux">{ligne.nom}</dt>
              <dd className="text-right text-doux tabular-nums">{poids(ligne.octets)}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}

function Bloc({
  titre,
  aide,
  total,
  postes,
  reference,
  teinte,
}: {
  titre: string;
  aide: string;
  total: number;
  postes: PosteBase[];
  /** Total de la base, pour dimensionner les barres à la même échelle. */
  reference: number;
  teinte: string;
}) {
  if (postes.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-bordure p-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className={etiquette}>{titre}</span>
          <span className="shrink-0 text-[14px] text-texte tabular-nums">
            {poids(total)}
          </span>
        </div>
        <p className="text-[11.5px] leading-relaxed text-tres-doux">{aide}</p>
      </div>
      {postes.map((poste) => (
        <Poste key={poste.cle} poste={poste} total={reference} teinte={teinte} />
      ))}
    </div>
  );
}

export function PlaceOccupee({
  base,
  repartition,
  quota,
  archivageParDefaut,
}: {
  base: EtatBase;
  repartition: Repartition;
  quota: number;
  /** Date proposée : tout ce qui précède est archivable. */
  archivageParDefaut: string;
}) {
  const [avant, setAvant] = useState(archivageParDefaut);
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();
  const [confirme, setConfirme] = useState(false);

  const part = base.octetsBase === null ? null : base.octetsBase / quota;
  // Les barres se comparent entre elles, à l'échelle du plus gros poste.
  const reference = Math.max(1, ...repartition.postes.map((p) => p.octets));
  const fixes = repartition.postes.filter((p) => p.fixe);
  const vivants = repartition.postes.filter((p) => !p.fixe);

  return (
    <div className="flex flex-col gap-4">
      {part !== null ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-doux">
              {poids(base.octetsBase ?? 0)} occupés sur {poids(quota)}
            </span>
            <span className="text-tres-doux tabular-nums">
              {Math.round(part * 100)} %
            </span>
          </div>
          <span
            aria-hidden
            className="flex h-1.5 w-full overflow-hidden rounded-full bg-bordure"
          >
            <span
              style={{
                width: `${Math.min(100, part * 100)}%`,
                // Une seule couleur : l'écran informe, il n'alarme pas.
                backgroundColor: part > 0.85 ? "#c2a567" : "#8fa37e",
              }}
            />
          </span>
          {part > 0.75 && repartition.totalVivant > repartition.totalFixe && (
            <p className="text-[12px] leading-relaxed text-doux">
              La base approche du palier gratuit de Neon. Archiver l'historique ancien
              libère le plus gros — c'est la table des révisions qui grossit.
            </p>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-tres-doux">
          La base ne dit pas sa taille. La répartition ci-dessous reste juste.
        </p>
      )}

      <Bloc
        titre="Fixe"
        aide="Importé une fois. Ne grandira plus, quoi que vous fassiez dans l'app."
        total={repartition.totalFixe}
        postes={fixes}
        reference={reference}
        teinte="#7d8ea8"
      />

      <Bloc
        titre="Grandit avec l'usage"
        aide="Ce que chaque journée ajoute."
        total={repartition.totalVivant}
        postes={vivants}
        reference={reference}
        teinte="#8fa37e"
      />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <dt className="text-tres-doux">Cartes</dt>
        <dd className="text-right text-doux tabular-nums">{base.cartes}</dd>
        <dt className="text-tres-doux">Révisions gardées</dt>
        <dd className="text-right text-doux tabular-nums">{base.revisions}</dd>
        <dt className="text-tres-doux">Images</dt>
        <dd className="text-right text-doux tabular-nums">
          {base.medias} · {poids(base.octetsMedias)}
        </dd>
        <dt className="text-tres-doux">Plus ancienne révision</dt>
        <dd className="text-right text-doux tabular-nums">
          {base.plusAncienneRevision ?? "—"}
        </dd>
      </dl>

      {repartition.reste !== null && repartition.reste > 0 && (
        <p className="text-[11.5px] leading-relaxed text-tres-doux">
          {poids(repartition.mesure)} tenus par les tables ci-dessus, sur{" "}
          {poids(base.octetsBase ?? 0)} annoncés par la base. L'écart —{" "}
          {poids(repartition.reste)} — est le catalogue interne de Postgres et la
          place libérée qu'il n'a pas encore rendue.
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-bordure p-4">
        <span className={etiquette}>Archiver l'historique</span>
        <p className="text-[12px] leading-relaxed text-tres-doux">
          Efface les révisions antérieures à la date choisie, en gardant toujours la
          dernière de chaque carte. Les échéances ne bougent pas d'un jour : ce qui se
          perd, c'est la matière d'une réoptimisation future des poids FSRS.
        </p>
        <input
          type="date"
          value={avant}
          onChange={(evenement) => setAvant(evenement.target.value)}
          className={champ}
        />

        {!confirme ? (
          <button
            type="button"
            onClick={() => setConfirme(true)}
            className="min-h-12 rounded-xl border border-bordure text-[14px] text-doux transition-colors duration-300 active:bg-surface-haut"
          >
            Archiver
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirme(false)}
              className="min-h-12 flex-1 rounded-xl border border-bordure text-[14px] text-doux"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={enAttente}
              onClick={() =>
                demarrer(async () => {
                  setRetour(await archiver(avant));
                  setConfirme(false);
                })
              }
              className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte disabled:opacity-50"
            >
              {enAttente ? "…" : "Confirmer"}
            </button>
          </div>
        )}

        {base.imagesOrphelines > 0 && (
          <button
            type="button"
            disabled={enAttente}
            onClick={() => demarrer(async () => setRetour(await purgerImages()))}
            className="min-h-12 rounded-xl border border-bordure text-[14px] text-doux transition-colors duration-300 active:bg-surface-haut"
          >
            Effacer les {base.imagesOrphelines} image(s) qu'aucune carte ne cite
          </button>
        )}

        <Retourner etat={retour} />
      </div>
    </div>
  );
}

export function Echanges({ paquets }: { paquets: PaquetChoix[] }) {
  const [etat, action] = useActionState<Retour, FormData>(importerCsv, {});

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <a
          href="/api/cartes/export?format=json"
          className="flex min-h-12 items-center justify-center rounded-xl border border-bordure text-[14px] text-doux transition-colors duration-300 active:bg-surface-haut"
        >
          Exporter en JSON — sauvegarde complète
        </a>
        <a
          href="/api/cartes/export?format=csv"
          className="flex min-h-12 items-center justify-center rounded-xl border border-bordure text-[14px] text-doux transition-colors duration-300 active:bg-surface-haut"
        >
          Exporter en CSV — lisible par Anki
        </a>
        <p className="text-[11.5px] leading-relaxed text-tres-doux">
          Le JSON garde la mémoire FSRS de chaque carte ; le CSV ne garde que le texte
          et les étiquettes. Dans Anki, choisis la virgule comme séparateur à l'import.
          Les images ne voyagent dans aucun des deux : elles restent servies par
          l'application.
        </p>
      </div>

      {paquets.length > 0 && (
        <form
          action={action}
          className="flex flex-col gap-3 rounded-xl border border-bordure p-4"
        >
          <span className={etiquette}>Importer un CSV</span>
          <p className="text-[12px] leading-relaxed text-tres-doux">
            Colle le contenu du fichier. Une ligne par carte : recto, verso, étiquettes.
            La virgule, le point-virgule et la tabulation sont reconnus, l'en-tête est
            facultatif. Les cartes arrivent à l'état neuf.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className={etiquette}>Paquet d'arrivée</span>
            <select name="paquetId" className={champ} defaultValue={paquets[0]?.id}>
              {paquets.map((paquet) => (
                <option key={paquet.id} value={paquet.id}>
                  {paquet.espaceNom} · {paquet.nom}
                </option>
              ))}
            </select>
          </label>

          <textarea
            name="csv"
            rows={6}
            placeholder={"recto,verso,tags\nAlcane,CnH2n+2,chimie nomenclature"}
            className="w-full resize-y rounded-xl border border-bordure bg-surface px-4 py-3 font-mono text-[13px] text-texte outline-none focus:border-bordure-vive"
          />

          <Envoyer libelle="Importer" />
          <Retourner etat={etat} />
        </form>
      )}
    </div>
  );
}
