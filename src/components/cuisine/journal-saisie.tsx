"use client";

import { useState, useTransition } from "react";

import {
  actionChercherPourJournal,
  actionNoterAliment,
  actionNoterRecette,
  actionRetirerEntree,
  type Retour,
} from "@/app/(app)/cuisine/journal/actions";
import { champ, etiquette } from "@/components/reglages/briques";
import { formater } from "@/lib/cuisine/nutrition";
import {
  LIBELLES_PRECISION,
  LIBELLES_REPAS,
  ORDRE_REPAS,
  type EntreeJournal,
} from "@/lib/cuisine/tendances";
import type { RecetteNotable } from "@/lib/cuisine/journal";
import type { PrecisionSaisie, Repas } from "@/db/cuisine";
import { formaterDateLongue } from "@/lib/dates";

/**
 * Noter un repas.
 *
 * Deux chemins seulement, ceux du modèle : une part d'une recette, ou un
 * aliment seul en grammes. Rien qui ressemble à un formulaire de suivi — on
 * note ce qu'on a mangé, on ne se justifie pas.
 *
 * Le choix « pesé / estimé » est demandé à chaque fois, et pas deviné : c'est
 * la seule chose qui dit après coup quels chiffres tiennent.
 */

type Trouve = {
  id: number;
  nom: string;
  etat: "cru" | "cuit";
  source: "ciqual" | "off" | "manuel";
  kcal100g: number | null;
};

function Pastille({
  libelle,
  choisi,
  surClic,
}: {
  libelle: string;
  choisi: boolean;
  surClic: () => void;
}) {
  return (
    <button
      type="button"
      onClick={surClic}
      aria-pressed={choisi}
      className="min-h-10 rounded-full border px-3.5 text-[13px] transition-colors duration-300"
      style={{
        borderColor: choisi ? "var(--color-bordure-vive)" : "var(--color-bordure)",
        backgroundColor: choisi ? "var(--color-surface-haut)" : "transparent",
        color: choisi ? "var(--color-texte)" : "var(--color-tres-doux)",
      }}
    >
      {libelle}
    </button>
  );
}

/** « dim 6 » — assez pour se repérer, assez court pour tenir sur deux lignes. */
function jourCourt(date: string): string {
  const [jour, numero] = formaterDateLongue(date).split(" ");
  return `${jour.slice(0, 3)} ${numero}`;
}

/** Les jours de la semaine affichée : on note aussi après coup. */
function ChoixJour({
  dates,
  valeur,
  surChoix,
}: {
  dates: string[];
  valeur: string;
  surChoix: (date: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={etiquette}>Jour</span>
      <div className="flex flex-wrap gap-1.5">
        {dates.map((date) => (
          <Pastille
            key={date}
            libelle={jourCourt(date)}
            choisi={date === valeur}
            surClic={() => surChoix(date)}
          />
        ))}
      </div>
    </div>
  );
}

function EntreesDuJour({
  date,
  entrees,
  surChangement,
}: {
  date: string;
  entrees: EntreeJournal[];
  surChangement: () => void;
}) {
  const [enAttente, demarrer] = useTransition();
  const duJour = entrees.filter((e) => e.date === date);

  if (duJour.length === 0) {
    return (
      <p className="text-[12.5px] leading-relaxed text-tres-doux">
        Rien de noté ce jour-là.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {ORDRE_REPAS.flatMap((repas) =>
        duJour
          .filter((e) => e.repas === repas)
          .map((entree) => (
            <li
              key={entree.id}
              className="flex items-center gap-3 rounded-xl border border-bordure px-4 py-2.5"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14px] text-texte">{entree.libelle}</span>
                <span className="text-[11.5px] text-tres-doux">
                  {LIBELLES_REPAS[entree.repas]}
                  {entree.poidsG ? ` · ${Math.round(entree.poidsG)} g` : ""} ·{" "}
                  {formater("kcal100g", entree.valeurs.kcal100g ?? undefined)}
                  {entree.precision === "estime" ? " · estimé" : " · pesé"}
                  {!entree.complet ? " · incomplet" : ""}
                </span>
              </span>
              <button
                type="button"
                disabled={enAttente}
                onClick={() =>
                  demarrer(async () => {
                    await actionRetirerEntree(entree.id);
                    surChangement();
                  })
                }
                aria-label={`Retirer ${entree.libelle}`}
                className="min-h-10 shrink-0 rounded-full border border-bordure px-3 text-[12px] text-tres-doux transition-colors duration-300 active:bg-surface-haut disabled:opacity-40"
              >
                retirer
              </button>
            </li>
          )),
      )}
    </ul>
  );
}

/* ────────────────────── Le formulaire ────────────────────── */

export function Saisie({
  dates,
  defaut,
  recettes,
  entrees,
}: {
  dates: string[];
  /** Le jour proposé d'emblée : aujourd'hui s'il est dans la semaine. */
  defaut: string;
  recettes: RecetteNotable[];
  /** Toutes les entrées de la semaine affichée. */
  entrees: EntreeJournal[];
}) {
  const [date, setDate] = useState(defaut);
  const [repas, setRepas] = useState<Repas>("midi");
  const [mode, setMode] = useState<"recette" | "aliment">("recette");
  const [precision, setPrecision] = useState<PrecisionSaisie>("estime");
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();
  const [version, setVersion] = useState(0);

  // Côté recette
  const [recetteId, setRecetteId] = useState<number | null>(null);
  const [poidsAssiette, setPoidsAssiette] = useState("");

  // Côté aliment
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<Trouve[]>([]);
  const [aliment, setAliment] = useState<Trouve | null>(null);
  const [grammes, setGrammes] = useState("");

  const recette = recettes.find((r) => r.id === recetteId) ?? null;

  function chercher(texte: string) {
    setRecherche(texte);
    if (texte.trim().length < 2) {
      setTrouves([]);
      return;
    }
    demarrer(async () => setTrouves((await actionChercherPourJournal(texte)) as Trouve[]));
  }

  function noter() {
    demarrer(async () => {
      if (mode === "recette") {
        if (recetteId === null) {
          setRetour({ erreur: "Choisis une recette." });
          return;
        }
        const poids = poidsAssiette.trim() === "" ? null : Number(poidsAssiette);
        setRetour(
          await actionNoterRecette({
            date,
            repas,
            recetteId,
            poidsAssietteG: poids,
            precision,
          }),
        );
        setPoidsAssiette("");
      } else {
        if (aliment === null) {
          setRetour({ erreur: "Choisis un aliment." });
          return;
        }
        setRetour(
          await actionNoterAliment({
            date,
            repas,
            alimentId: aliment.id,
            quantiteG: Number(grammes),
            precision,
          }),
        );
        setGrammes("");
        setAliment(null);
        setRecherche("");
        setTrouves([]);
      }
      setVersion((v) => v + 1);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Noter</h2>

        <ChoixJour dates={dates} valeur={date} surChoix={setDate} />

        <div className="flex flex-col gap-1.5">
          <span className={etiquette}>Repas</span>
          <div className="flex flex-wrap gap-1.5">
            {ORDRE_REPAS.map((cle) => (
              <Pastille
                key={cle}
                libelle={LIBELLES_REPAS[cle]}
                choisi={repas === cle}
                surClic={() => setRepas(cle)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={etiquette}>Quoi</span>
          <div className="flex gap-1.5">
            <Pastille
              libelle="Une recette"
              choisi={mode === "recette"}
              surClic={() => setMode("recette")}
            />
            <Pastille
              libelle="Un aliment seul"
              choisi={mode === "aliment"}
              surClic={() => setMode("aliment")}
            />
          </div>
        </div>

        {mode === "recette" ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className={etiquette}>Recette</span>
              <select
                value={recetteId ?? ""}
                onChange={(e) =>
                  setRecetteId(e.target.value === "" ? null : Number(e.target.value))
                }
                className={champ}
              >
                <option value="">—</option>
                {recettes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nom}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={etiquette}>Poids de l&apos;assiette, en grammes</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={poidsAssiette}
                onChange={(e) => setPoidsAssiette(e.target.value)}
                placeholder="laisser vide pour une portion théorique"
                className={champ}
              />
              <span className="text-[11.5px] leading-relaxed text-tres-doux">
                {recette === null
                  ? "Le poids de l'assiette ne sert que si la recette a un poids total cuit."
                  : recette.poidsTotalCuitG
                    ? `« ${recette.nom} » a été pesée entière (${Math.round(recette.poidsTotalCuitG)} g) : le poids de ton assiette donne la part réelle.`
                    : `« ${recette.nom} » n'a pas de poids total cuit. Sans lui, aucun rapport ne s'applique : la part restera théorique (le total divisé par ${recette.nbPortions}), et l'entrée sera notée estimée.`}
              </span>
            </label>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <span className={etiquette}>Aliment</span>
              <input
                value={recherche}
                onChange={(e) => chercher(e.target.value)}
                placeholder="riz, courgette, yaourt…"
                className={champ}
              />
            </label>

            {trouves.length > 0 && (
              <ul className="flex flex-col gap-1">
                {trouves.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setAliment(t);
                        setTrouves([]);
                        setRecherche(t.nom);
                      }}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-bordure px-4 text-left text-[13px] text-doux transition-colors duration-300 active:bg-surface-haut"
                    >
                      <span className="min-w-0 flex-1 truncate">{t.nom}</span>
                      <span className="shrink-0 text-[11.5px] text-tres-doux">
                        {t.etat === "cuit" ? "cuit · " : ""}
                        {t.source === "manuel" ? "manuel · " : ""}
                        {t.kcal100g === null ? "—" : `${Math.round(t.kcal100g)} kcal`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {aliment && (
              <label className="flex flex-col gap-1.5">
                <span className={etiquette}>Quantité, en grammes</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={grammes}
                  onChange={(e) => setGrammes(e.target.value)}
                  className={champ}
                />
                <span className="text-[11.5px] leading-relaxed text-tres-doux">
                  Fiche retenue : {aliment.nom}
                  {aliment.etat === "cuit"
                    ? " — fiche « cuit », donne le poids cuit."
                    : " — fiche « cru », donne le poids cru."}
                </span>
              </label>
            )}
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <span className={etiquette}>Ce chiffre est</span>
          <div className="flex gap-1.5">
            {(["pese", "estime"] as PrecisionSaisie[]).map((cle) => (
              <Pastille
                key={cle}
                libelle={LIBELLES_PRECISION[cle]}
                choisi={precision === cle}
                surClic={() => setPrecision(cle)}
              />
            ))}
          </div>
          <span className="text-[11.5px] leading-relaxed text-tres-doux">
            C&apos;est la seule chose qui dira, dans trois semaines, quels chiffres
            tiennent. Rien ne t&apos;oblige à peser — mais l&apos;écrire évite de lire
            une estimation comme une mesure.
          </span>
        </div>

        <button
          type="button"
          disabled={enAttente}
          onClick={noter}
          className="min-h-12 rounded-xl border border-bordure-vive bg-surface-haut text-[15px] text-texte transition-colors duration-300 active:bg-bordure disabled:opacity-50"
        >
          {enAttente ? "…" : "Noter"}
        </button>

        <p aria-live="polite" className="min-h-4 text-[12.5px] text-tres-doux">
          {retour.erreur ?? retour.message ?? ""}
        </p>
      </section>

      <section className="flex flex-col gap-3 border-t border-bordure pt-5">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          {formaterDateLongue(date)}
        </h2>
        <EntreesDuJour
          key={version}
          date={date}
          entrees={entrees}
          surChangement={() => setVersion((v) => v + 1)}
        />
      </section>
    </div>
  );
}
