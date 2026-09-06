"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  actionConvertir,
  actionManquantAuxCourses,
  actionRetenir,
  type Retour,
} from "@/app/(app)/cuisine/suggestions/actions";
import { couleurCategorie, nomCategorie } from "@/lib/cuisine/categories";
import { nomCuisson } from "@/lib/cuisine/nutrition";
import { LIBELLES_ROLE } from "@/lib/cuisine/nutrition";
import type { SuggestionPatron, SuggestionRecette } from "@/lib/cuisine/suggestions";

/**
 * Les suggestions.
 *
 * Chacune dit d'où elle vient : ce qui est là, ce qui manque, ce qui remplace
 * quoi. Rien n'est proposé sans être justifié — une suggestion qu'on ne peut
 * pas expliquer ne se suit pas, elle s'ignore.
 */

/* ────────────────────── A. Sur mes recettes ────────────────────── */

function CarteRecette({ suggestion }: { suggestion: SuggestionRecette }) {
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();

  const remplaces = suggestion.etats.filter((e) => e.statut === "remplace");

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-bordure bg-surface px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={`/cuisine/recettes/${suggestion.recette.id}`}
          className="min-w-0 flex-1 truncate text-[16px] text-texte underline decoration-transparent underline-offset-4 transition-colors duration-300 active:decoration-bordure-vive"
        >
          {suggestion.recette.nom}
        </Link>
        <span className="shrink-0 text-[12px] text-tres-doux tabular-nums">
          {suggestion.nbManquants === 0
            ? "tout est là"
            : `${suggestion.nbManquants} manque${suggestion.nbManquants > 1 ? "nt" : ""}`}
        </span>
      </div>

      <p className="text-[12px] text-tres-doux">
        {nomCuisson(suggestion.recette.modeCuisson)}
        {suggestion.recette.tempsMinutes > 0
          ? ` · ${suggestion.recette.tempsMinutes} min`
          : ""}{" "}
        · {suggestion.etats.length} ingrédient{suggestion.etats.length > 1 ? "s" : ""}
      </p>

      {remplaces.length > 0 && (
        <p className="text-[12px] leading-relaxed text-tres-doux">
          Remplacé :{" "}
          {remplaces
            .map((e) => `${e.ingredient.nomLibre} par ${e.par?.nom ?? "autre chose"}`)
            .join(" · ")}
          .
        </p>
      )}

      {suggestion.manquants.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11.5px] tracking-[0.1em] text-tres-doux uppercase">
            Il te manque
          </span>
          <ul className="flex flex-col gap-1.5">
            {suggestion.manquants.map((e) => (
              <li key={e.ingredient.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-doux">
                  {e.ingredient.nomLibre}
                  <span className="text-tres-doux">
                    {" "}
                    · {LIBELLES_ROLE[e.ingredient.role].toLowerCase()}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={enAttente}
                  onClick={() =>
                    demarrer(async () => {
                      setRetour(
                        await actionManquantAuxCourses(
                          e.ingredient.nomLibre,
                          e.ingredient.categorieSubstitution ?? "autre",
                        ),
                      );
                    })
                  }
                  className="min-h-9 shrink-0 rounded-full border border-bordure px-3 text-[11.5px] text-doux transition-colors duration-300 active:bg-surface-haut disabled:opacity-40"
                >
                  aux courses
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        disabled={enAttente}
        onClick={() =>
          demarrer(async () => {
            setRetour(await actionRetenir(suggestion.cle, suggestion.recette.nom));
          })
        }
        className="min-h-11 rounded-xl border border-bordure text-[13px] text-doux transition-colors duration-300 active:bg-surface-haut disabled:opacity-40"
      >
        Je retiens celle-ci
      </button>

      <p aria-live="polite" className="min-h-4 text-[12px] text-tres-doux">
        {retour.erreur ?? retour.message ?? ""}
      </p>
    </li>
  );
}

/* ────────────────────── B. Patrons ────────────────────── */

function CartePatron({ suggestion }: { suggestion: SuggestionPatron }) {
  const router = useRouter();
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();

  const libelle = `${suggestion.patron.nom} — ${suggestion.articles.map((a) => a.nom).join(", ")}`;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-bordure bg-surface px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 flex-1 text-[16px] text-texte">
          {suggestion.patron.nom}
        </span>
        <span className="shrink-0 text-[12px] text-tres-doux">
          {nomCuisson(suggestion.patron.modeCuisson)}
        </span>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {suggestion.articles.map((article) => (
          <li
            key={article.id}
            className="rounded-full border px-3 py-1 text-[12.5px]"
            style={{
              borderColor: couleurCategorie(article.categorie),
              color: "var(--color-doux)",
            }}
          >
            {article.nom}
            <span className="text-tres-doux"> · {nomCategorie(article.categorie)}</span>
          </li>
        ))}
      </ul>

      <p className="text-[12px] leading-relaxed text-tres-doux">
        Tout vient de ton inventaire. Le patron dit quoi associer, pas en quelle
        quantité — les grammages se pèsent en cuisinant.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={enAttente}
          onClick={() =>
            demarrer(async () => setRetour(await actionRetenir(suggestion.cle, libelle)))
          }
          className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux transition-colors duration-300 active:bg-surface-haut disabled:opacity-40"
        >
          Je retiens
        </button>
        <button
          type="button"
          disabled={enAttente}
          onClick={() =>
            demarrer(async () => {
              const r = await actionConvertir(
                suggestion.patron.id,
                suggestion.articles.map((a) => a.id),
                suggestion.cle,
                libelle,
              );
              if (r.id) {
                router.push(`/cuisine/recettes/${r.id}`);
                router.refresh();
              } else setRetour(r);
            })
          }
          className="min-h-11 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[13px] text-texte disabled:opacity-40"
        >
          En faire une recette
        </button>
      </div>

      <p aria-live="polite" className="min-h-4 text-[12px] text-tres-doux">
        {retour.erreur ?? retour.message ?? ""}
      </p>
    </li>
  );
}

/* ────────────────────── L'écran ────────────────────── */

export function Suggestions({
  recettes,
  patrons,
  repetitionAssumee,
  nbDisponibles,
}: {
  recettes: SuggestionRecette[];
  patrons: SuggestionPatron[];
  repetitionAssumee: boolean;
  nbDisponibles: number;
}) {
  if (nbDisponibles === 0) {
    return (
      <p className="rounded-2xl border border-bordure/60 px-5 py-6 text-center text-[14px] leading-relaxed text-doux">
        L&apos;inventaire est vide, ou tout y est épuisé. Ajoute ce que tu as sous la
        main : les suggestions se calculent uniquement à partir de là.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {repetitionAssumee && (
        <p className="rounded-xl border border-bordure px-4 py-3 text-[12.5px] leading-relaxed text-tres-doux">
          Tout ce qui suit a déjà été proposé ou cuisiné ces dix derniers jours. Faute
          d&apos;autre chose, on répète — c&apos;est dit plutôt que caché.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Avec tes recettes
        </h2>
        {recettes.length === 0 ? (
          <p className="rounded-2xl border border-bordure/60 px-5 py-5 text-center text-[13.5px] leading-relaxed text-doux">
            Aucune recette faisable avec ce que tu as. C&apos;est normal au début :
            les combinaisons ci-dessous prennent le relais.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {recettes.map((s) => (
              <CarteRecette key={s.cle} suggestion={s} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Combinaisons possibles
        </h2>
        {patrons.length === 0 ? (
          <p className="rounded-2xl border border-bordure/60 px-5 py-5 text-center text-[13.5px] leading-relaxed text-doux">
            Aucune structure de plat ne tient avec cet inventaire. Il manque
            probablement une catégorie entière — un féculent, une protéine.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {patrons.map((s) => (
              <CartePatron key={s.cle} suggestion={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
