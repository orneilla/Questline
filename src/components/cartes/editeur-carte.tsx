"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  basculerSuspension,
  creerCarte,
  effacerCarte,
  enregistrerCarte,
  type Retour,
} from "@/app/(app)/cartes/edition-actions";
import type { NoteChargee } from "@/lib/cartes/edition";
import { engendrer, estRtl } from "@/lib/cartes/generation";
import type { TypeCarte } from "@/db/schema";
import { ChampRiche } from "./champ-riche";
import { ContenuCarte } from "./contenu-carte";

/**
 * L'éditeur de cartes.
 *
 * Pensé pour la tablette : deux colonnes dès qu'il y a la place, la saisie à
 * gauche et ce que donneront les cartes à droite, mis à jour à la frappe. Sur
 * téléphone, l'aperçu passe simplement sous le formulaire.
 *
 * En création, le formulaire se vide après validation mais garde le paquet, le
 * type et les étiquettes : on écrit rarement une carte seule.
 */

export type PaquetChoix = {
  id: number;
  nom: string;
  espaceNom: string;
  couleur: string;
};

const TYPES: { valeur: TypeCarte; libelle: string; aide: string }[] = [
  {
    valeur: "recto_verso",
    libelle: "Recto-verso",
    aide: "Une carte, interrogée dans un seul sens.",
  },
  {
    valeur: "inversee",
    libelle: "Inversée",
    aide: "Deux cartes : une dans chaque sens.",
  },
  {
    valeur: "trous",
    libelle: "Texte à trous",
    aide: "Une carte par trou. Le bouton « trou » masque le passage choisi.",
  },
];

const CHAMP =
  "min-h-12 w-full rounded-xl border border-bordure bg-surface px-4 text-[15px] text-texte outline-none transition-colors duration-300 placeholder:text-tres-doux focus:border-bordure-vive";

const ETIQUETTE = "text-[12px] tracking-[0.1em] text-tres-doux uppercase";

function CarteApercu({
  recto,
  verso,
  rang,
  total,
}: {
  recto: string;
  verso: string;
  rang: number;
  total: number;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-bordure bg-surface p-4">
      <p className="text-[11px] tracking-[0.16em] text-tres-doux uppercase">
        Carte {rang} sur {total}
      </p>
      <div className="flex flex-col items-center gap-3 text-center">
        <ContenuCarte texte={recto} rtl={estRtl(recto)} role="recto" />
        <span aria-hidden className="h-px w-12 bg-bordure-vive" />
        <ContenuCarte texte={verso} rtl={estRtl(verso)} role="verso" />
      </div>
    </article>
  );
}

export function EditeurCarte({
  paquets,
  note,
  paquetInitial,
}: {
  paquets: PaquetChoix[];
  /** Absente en création. */
  note?: NoteChargee;
  paquetInitial?: number;
}) {
  const routeur = useRouter();
  const edition = note !== undefined;

  const [paquetId, setPaquetId] = useState<number>(
    note?.paquetId ?? paquetInitial ?? paquets[0]?.id ?? 0,
  );
  const [type, setType] = useState<TypeCarte>(note?.type ?? "recto_verso");
  const [recto, setRecto] = useState(note?.recto ?? "");
  const [verso, setVerso] = useState(note?.verso ?? "");
  const [notes, setNotes] = useState(note?.notes ?? "");
  const [etiquettes, setEtiquettes] = useState((note?.tags ?? []).join(" "));
  const [suspendue, setSuspendue] = useState(note?.suspendue ?? false);

  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);

  const engendrees = useMemo(() => {
    if (!recto.trim()) return [];
    return engendrer({
      cle: "apercu",
      recto,
      verso,
      type,
      notes,
      tags: [],
    });
  }, [recto, verso, type, notes]);

  function formulaire(): FormData {
    const donnees = new FormData();
    donnees.set("paquetId", String(paquetId));
    donnees.set("type", type);
    donnees.set("recto", recto);
    donnees.set("verso", verso);
    donnees.set("notes", notes);
    donnees.set("tags", etiquettes);
    if (note) donnees.set("carteId", String(note.carteId));
    return donnees;
  }

  function envoyer(): void {
    setRetour({});
    demarrer(async () => {
      const resultat = edition
        ? await enregistrerCarte({}, formulaire())
        : await creerCarte({}, formulaire());
      setRetour(resultat);

      if (!resultat.erreur && !edition) {
        // Création en série : le paquet, le type et les étiquettes restent.
        setRecto("");
        setVerso("");
        setNotes("");
      }
    });
  }

  const parEspace = useMemo(() => {
    const groupes = new Map<string, PaquetChoix[]>();
    for (const paquet of paquets) {
      const liste = groupes.get(paquet.espaceNom) ?? [];
      liste.push(paquet);
      groupes.set(paquet.espaceNom, liste);
    }
    return [...groupes.entries()];
  }, [paquets]);

  if (paquets.length === 0) {
    return (
      <p className="text-[14px] leading-relaxed text-doux">
        Il n'existe aucun paquet où ranger une carte. Crée d'abord un espace et un
        paquet depuis{" "}
        <Link href="/cartes/organiser" className="text-texte underline underline-offset-4">
          Organiser
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-7 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-9">
      <form
        className="flex flex-col gap-5"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          envoyer();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETTE}>Paquet</span>
          <select
            value={paquetId}
            onChange={(evenement) => setPaquetId(Number(evenement.target.value))}
            className={CHAMP}
          >
            {parEspace.map(([espace, liste]) => (
              <optgroup key={espace} label={espace}>
                {liste.map((paquet) => (
                  <option key={paquet.id} value={paquet.id}>
                    {paquet.nom}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={ETIQUETTE}>Type</span>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((choix) => (
              <button
                key={choix.valeur}
                type="button"
                aria-pressed={type === choix.valeur}
                onClick={() => setType(choix.valeur)}
                className="min-h-12 rounded-xl border px-2 text-[13px] transition-colors duration-200"
                style={{
                  borderColor:
                    type === choix.valeur
                      ? "var(--color-bordure-vive)"
                      : "var(--color-bordure)",
                  backgroundColor:
                    type === choix.valeur ? "var(--color-surface-haut)" : "transparent",
                  color:
                    type === choix.valeur ? "var(--color-texte)" : "var(--color-doux)",
                }}
              >
                {choix.libelle}
              </button>
            ))}
          </div>
          <p className="text-[11.5px] leading-relaxed text-tres-doux">
            {TYPES.find((t) => t.valeur === type)?.aide}
          </p>
        </div>

        <ChampRiche
          etiquette={type === "trous" ? "Texte" : "Recto"}
          valeur={recto}
          surChangement={setRecto}
          lignes={type === "trous" ? 7 : 5}
          avecTrous={type === "trous"}
          placeholder={
            type === "trous"
              ? "Le noyau de l'atome contient des {{c1::protons}} et des {{c2::neutrons}}."
              : "La question, telle qu'elle se posera à toi."
          }
          aide="Markdown et LaTeX acceptés. Colle ou dépose une image ici."
        />

        <ChampRiche
          etiquette={type === "trous" ? "Complément (facultatif)" : "Verso"}
          valeur={verso}
          surChangement={setVerso}
          lignes={4}
          placeholder={
            type === "trous" ? "Ajouté au dos de chaque carte du texte." : "La réponse."
          }
        />

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETTE}>Note de bas de carte</span>
          <input
            value={notes}
            onChange={(evenement) => setNotes(evenement.target.value)}
            maxLength={400}
            placeholder="Un rappel, une source. Montré après la réponse."
            className={CHAMP}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETTE}>Étiquettes</span>
          <input
            value={etiquettes}
            onChange={(evenement) => setEtiquettes(evenement.target.value)}
            placeholder="alcanes nomenclature"
            className={CHAMP}
          />
          <span className="text-[11.5px] text-tres-doux">
            Séparées par des espaces. Elles servent à la recherche.
          </span>
        </label>

        <button
          type="submit"
          disabled={enAttente || !recto.trim()}
          className="min-h-14 w-full rounded-2xl border border-bordure-vive bg-surface-haut text-[16px] text-texte transition-colors duration-300 active:bg-bordure disabled:opacity-50"
        >
          {enAttente
            ? "…"
            : edition
              ? "Enregistrer"
              : engendrees.length > 1
                ? `Créer ${engendrees.length} cartes`
                : "Créer la carte"}
        </button>

        <p
          aria-live="polite"
          className="min-h-5 text-[12.5px]"
          style={{ color: retour.erreur ? "var(--color-doux)" : "var(--color-tres-doux)" }}
        >
          {retour.erreur ?? retour.message ?? ""}
        </p>

        {edition && note && (
          <div className="flex flex-col gap-3 border-t border-bordure pt-5">
            <p className="text-[12px] leading-relaxed text-tres-doux">
              {note.heritee
                ? "Cette carte a été écrite avant l'éditeur : c'est sa face que tu modifies, pas une note."
                : note.fratrie > 1
                  ? `Cette note tient ${note.fratrie} cartes. Modifier le texte les réaccorde toutes sans effacer leur mémoire.`
                  : "Une seule carte pour cette note."}
              {note.passages > 0 &&
                ` Revue ${note.passages} fois${note.prochaineDate ? `, prochaine échéance le ${note.prochaineDate}` : ""}.`}
            </p>

            <button
              type="button"
              disabled={enAttente}
              onClick={() =>
                demarrer(async () => {
                  const suivant = !suspendue;
                  setSuspendue(suivant);
                  await basculerSuspension(note.carteId, suivant);
                })
              }
              className="min-h-12 w-full rounded-xl border border-bordure text-[14px] text-doux transition-colors duration-300 active:bg-surface-haut"
            >
              {suspendue ? "Remettre en circulation" : "Suspendre cette carte"}
            </button>

            {!confirmeSuppression ? (
              <button
                type="button"
                onClick={() => setConfirmeSuppression(true)}
                className="min-h-12 w-full rounded-xl border border-bordure text-[14px] text-doux transition-colors duration-300 active:bg-surface-haut"
              >
                Supprimer
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-bordure-vive p-3">
                <p className="text-[12.5px] leading-relaxed text-doux">
                  {note.fratrie > 1
                    ? `La note a engendré ${note.fratrie} cartes. Tu peux n'effacer que celle-ci, ou tout le groupe. L'historique de révision part avec.`
                    : "La carte et son historique de révision disparaissent."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmeSuppression(false)}
                    className="min-h-12 flex-1 rounded-xl border border-bordure text-[14px] text-doux"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={enAttente}
                    onClick={() =>
                      demarrer(async () => {
                        await effacerCarte(note.carteId, false);
                        // « Remplacer » et non « empiler » : revenir en arrière ne doit pas
                        // rouvrir l'éditeur d'une carte qui n'existe plus.
                        routeur.replace("/cartes/recherche");
                      })
                    }
                    className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte"
                  >
                    Cette carte
                  </button>
                  {note.fratrie > 1 && (
                    <button
                      type="button"
                      disabled={enAttente}
                      onClick={() =>
                        demarrer(async () => {
                          await effacerCarte(note.carteId, true);
                          // « Remplacer » et non « empiler » : revenir en arrière ne doit pas
                        // rouvrir l'éditeur d'une carte qui n'existe plus.
                        routeur.replace("/cartes/recherche");
                        })
                      }
                      className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte"
                    >
                      Tout le groupe
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </form>

      <section className="flex flex-col gap-3 lg:sticky lg:top-6">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          {engendrees.length === 0
            ? "Aperçu"
            : engendrees.length === 1
              ? "Aperçu — 1 carte"
              : `Aperçu — ${engendrees.length} cartes`}
        </h2>

        {engendrees.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-bordure px-4 py-8 text-center text-[13px] text-tres-doux">
            Ce que tu écris apparaît ici, rendu comme pendant la révision.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {engendrees.map((carte, index) => (
              <CarteApercu
                key={`${carte.index}-${index}`}
                recto={carte.recto}
                verso={carte.verso}
                rang={index + 1}
                total={engendrees.length}
              />
            ))}
            {notes.trim() && (
              <p className="px-1 text-[12.5px] leading-relaxed text-tres-doux">
                Note de bas de carte : {notes}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
