"use client";

import { useEffect, useState, useTransition } from "react";

import {
  actionChercherPourJournal,
  actionCorrigerEntree,
  actionNoterAliment,
  actionNoterRecette,
  actionResynchroniser,
  actionRetirerEntree,
  type Retour,
} from "@/app/(app)/cuisine/journal/actions";
import { champ, etiquette } from "@/components/reglages/briques";
import { nutrimentsSansValeur, plafondFiche } from "@/lib/cuisine/instantane";
import { LIBELLES, formater } from "@/lib/cuisine/nutrition";
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
 * Noter un repas, et corriger ce qui a été noté.
 *
 * Deux chemins de saisie, ceux du modèle : une part d'une recette, ou un
 * aliment seul en grammes. Rien qui ressemble à un formulaire de suivi — on
 * note ce qu'on a mangé, on ne se justifie pas.
 *
 * Une entrée déjà posée reste corrigeable : ouvrir, changer le chiffre,
 * valider. Le recalcul se fait sur son propre instantané, jamais sur la
 * recette d'aujourd'hui — rejoindre celle-ci demande un geste explicite, le
 * bouton de resynchronisation.
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

/** « dim 6 » — assez pour se repérer, assez court pour tenir sur une ligne. */
function jourCourt(date: string): string {
  const [jour, numero] = formaterDateLongue(date).split(" ");
  return `${jour.slice(0, 3)} ${numero}`;
}

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

function ChoixRepas({
  valeur,
  surChoix,
}: {
  valeur: Repas;
  surChoix: (repas: Repas) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={etiquette}>Repas</span>
      <div className="flex flex-wrap gap-1.5">
        {ORDRE_REPAS.map((cle) => (
          <Pastille
            key={cle}
            libelle={LIBELLES_REPAS[cle]}
            choisi={valeur === cle}
            surClic={() => surChoix(cle)}
          />
        ))}
      </div>
    </div>
  );
}

function ChoixPrecision({
  valeur,
  surChoix,
  aide,
}: {
  valeur: PrecisionSaisie;
  surChoix: (precision: PrecisionSaisie) => void;
  aide: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={etiquette}>Ce chiffre est</span>
      <div className="flex gap-1.5">
        {(["pese", "estime"] as PrecisionSaisie[]).map((cle) => (
          <Pastille
            key={cle}
            libelle={LIBELLES_PRECISION[cle]}
            choisi={valeur === cle}
            surClic={() => surChoix(cle)}
          />
        ))}
      </div>
      <span className="text-[11.5px] leading-relaxed text-tres-doux">{aide}</span>
    </div>
  );
}

/* ────────────────────── Une entrée déjà notée ────────────────────── */

/**
 * Ce que la couverture d'une entrée mérite qu'on en dise, ou rien.
 *
 * Deux causes, dites séparément. Un ingrédient sans fiche retire son poids à
 * tous les nutriments d'un coup : le nommer suffit, et répéter le même
 * pourcentage sur les huit lignes n'apprendrait rien. Une fiche qui existe
 * mais ne donne pas une valeur ne touche que celle-là — c'est le cas qui ne se
 * voyait nulle part, et c'est lui qu'on détaille.
 */
function Couverture({ entree }: { entree: EntreeJournal }) {
  const plafond = plafondFiche(entree.couverture);
  const muettes = nutrimentsSansValeur(entree.couverture);

  if (muettes.length === 0 && entree.sansFiche.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-bordure px-3 py-2.5">
      {entree.sansFiche.length > 0 && (
        <p className="text-[11.5px] leading-relaxed text-tres-doux">
          Sans fiche : {entree.sansFiche.join(", ")}. Leur poids ne compte dans aucun
          nutriment — tous plafonnent à {Math.round(plafond * 100)} % du poids.
          {plafond < 0.01 && entree.recetteId !== null
            ? " C'est pourquoi cette entrée n'affiche aucun chiffre : ouvre la recette, relie ses ingrédients au catalogue, puis reviens resynchroniser ici."
            : ""}
        </p>
      )}
      {muettes.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
          {muettes.map((cle) => (
            <li key={cle} className="text-[11.5px] text-tres-doux tabular-nums">
              {LIBELLES[cle]} : {Math.round((entree.couverture[cle] ?? 1) * 100)} % du
              poids couvert
            </li>
          ))}
        </ul>
      )}
      {muettes.length > 0 && (
        <p className="text-[11.5px] leading-relaxed text-tres-doux">
          Ces valeurs-là manquent dans la fiche elle-même, pas faute de lien.
        </p>
      )}
    </div>
  );
}

function FicheEntree({
  entree,
  dates,
}: {
  entree: EntreeJournal;
  dates: string[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [date, setDate] = useState(entree.date);
  const [repas, setRepas] = useState<Repas>(entree.repas);
  const [precision, setPrecision] = useState<PrecisionSaisie>(entree.precision);
  const [poids, setPoids] = useState(
    entree.origine === "recette"
      ? (entree.poidsAssietteG?.toString() ?? "")
      : (entree.quantiteG?.toString() ?? ""),
  );
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();

  const recette = entree.origine === "recette";
  const peseImpossible = recette && entree.poidsTotalCuitG === null;

  function enregistrer() {
    demarrer(async () => {
      const nombre = poids.trim() === "" ? null : Number(poids);
      setRetour(
        await actionCorrigerEntree(entree.id, {
          date,
          repas,
          precision,
          poidsAssietteG: recette ? nombre : undefined,
          quantiteG: recette ? undefined : (nombre ?? undefined),
        }),
      );
    });
  }

  return (
    <li className="overflow-hidden rounded-xl border border-bordure">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-300 active:bg-surface-haut"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[14px] text-texte">{entree.libelle}</span>
          <span className="text-[11.5px] text-tres-doux">
            {LIBELLES_REPAS[entree.repas]}
            {entree.origine === "recette"
              ? entree.poidsAssietteG
                ? ` · assiette ${Math.round(entree.poidsAssietteG)} g`
                : ` · 1 part sur ${entree.nbPortions}`
              : entree.quantiteG
                ? ` · ${Math.round(entree.quantiteG)} g`
                : ""}{" "}
            · {formater("kcal100g", entree.valeurs.kcal100g ?? undefined)} ·{" "}
            {entree.precision === "estime" ? "estimé" : "pesé"}
            {entree.dateModification !== null ? " · corrigée" : ""}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-[16px] text-tres-doux">
          {ouvert ? "×" : "+"}
        </span>
      </button>

      {ouvert && (
        <div className="flex flex-col gap-3 border-t border-bordure px-4 py-3">
          <Couverture entree={entree} />

          <label className="flex flex-col gap-1.5">
            <span className={etiquette}>
              {recette ? "Poids de l'assiette, en grammes" : "Quantité, en grammes"}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={poids}
              onChange={(e) => setPoids(e.target.value)}
              placeholder={recette ? "vide = part théorique" : ""}
              className={champ}
            />
            <span className="text-[11.5px] leading-relaxed text-tres-doux">
              {recette
                ? entree.poidsTotalCuitG
                  ? `Rapporté aux ${Math.round(entree.poidsTotalCuitG)} g du plat entier, tels qu'ils étaient à la saisie.`
                  : `Aucun poids total cuit n'avait été noté : la part reste théorique — le plat divisé par ${entree.nbPortions}.`
                : "Recalculé sur les teneurs figées à la saisie, pas sur la fiche d'aujourd'hui."}
            </span>
          </label>

          <ChoixJour dates={dates} valeur={date} surChoix={setDate} />
          <ChoixRepas valeur={repas} surChoix={setRepas} />
          <ChoixPrecision
            valeur={precision}
            surChoix={setPrecision}
            aide={
              peseImpossible
                ? "Sans poids total cuit, cette entrée restera estimée quoi qu'on choisisse ici."
                : recette
                  ? "« Pesé » demande le poids de l'assiette et celui du plat entier."
                  : "Le grammage vient de la balance : « pesé » suffit. Bascule en estimé si tu as saisi au jugé."
            }
          />

          <button
            type="button"
            disabled={enAttente}
            onClick={enregistrer}
            className="min-h-12 rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte transition-colors duration-300 active:bg-bordure disabled:opacity-50"
          >
            {enAttente ? "…" : "Enregistrer"}
          </button>

          {entree.recetteId !== null && (
            <button
              type="button"
              disabled={enAttente}
              onClick={() =>
                demarrer(async () => setRetour(await actionResynchroniser(entree.id)))
              }
              className="min-h-11 rounded-xl border border-bordure text-[13px] text-doux transition-colors duration-300 active:bg-surface-haut disabled:opacity-40"
            >
              Resynchroniser depuis la recette
            </button>
          )}

          <p className="text-[11.5px] leading-relaxed text-tres-doux">
            {entree.recetteId !== null
              ? "Resynchroniser refait l'instantané à partir de la recette telle qu'elle est aujourd'hui. C'est le seul chemin par lequel une correction de recette rejoint le journal, et il se prend entrée par entrée."
              : entree.origine === "recette"
                ? "La recette d'origine n'existe plus. L'entrée reste calculable : son instantané se suffit."
                : ""}
            {entree.dateModification !== null
              ? ` Corrigée le ${formaterDateLongue(entree.dateModification)}.`
              : ""}
          </p>

          <button
            type="button"
            disabled={enAttente}
            onClick={() =>
              demarrer(async () => setRetour(await actionRetirerEntree(entree.id)))
            }
            className="min-h-11 self-start text-left text-[12.5px] text-tres-doux transition-colors duration-300 active:text-doux disabled:opacity-40"
          >
            Retirer cette entrée
          </button>

          <p aria-live="polite" className="min-h-4 text-[12px] text-tres-doux">
            {retour.erreur ?? retour.message ?? ""}
          </p>
        </div>
      )}
    </li>
  );
}

function EntreesDuJour({
  date,
  entrees,
  dates,
}: {
  date: string;
  entrees: EntreeJournal[];
  dates: string[];
}) {
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
            <FicheEntree key={entree.id} entree={entree} dates={dates} />
          )),
      )}
    </ul>
  );
}

/* ────────────────────── Le formulaire d'ajout ────────────────────── */

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

  // Côté recette
  const [recetteId, setRecetteId] = useState<number | null>(null);
  const [poidsAssiette, setPoidsAssiette] = useState("");

  // Côté aliment
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<Trouve[]>([]);
  const [aliment, setAliment] = useState<Trouve | null>(null);
  const [grammes, setGrammes] = useState("");

  const recette = recettes.find((r) => r.id === recetteId) ?? null;

  // Un aliment seul se pèse à la balance : c'est le cas ordinaire. Une part de
  // recette suppose un rapport, qui n'existe pas toujours : l'estimé y est le
  // point de départ honnête.
  useEffect(() => {
    setPrecision(mode === "aliment" ? "pese" : "estime");
  }, [mode]);

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
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Noter</h2>

        <ChoixJour dates={dates} valeur={date} surChoix={setDate} />
        <ChoixRepas valeur={repas} surChoix={setRepas} />

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

        <ChoixPrecision
          valeur={precision}
          surChoix={setPrecision}
          aide={
            mode === "aliment"
              ? "Un aliment posé sur la balance est pesé, sans autre condition. Bascule en estimé si tu saisis au jugé."
              : "Une part de recette n'est « pesée » que si le poids de l'assiette et celui du plat entier sont connus tous les deux. Sinon elle sera notée estimée, et l'écran te le dira."
          }
        />

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
        <EntreesDuJour date={date} entrees={entrees} dates={dates} />
      </section>
    </div>
  );
}
