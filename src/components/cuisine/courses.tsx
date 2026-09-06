"use client";

import { useState, useTransition } from "react";

import {
  actionAjouterCourse,
  actionCocherCourse,
  actionRangerCourses,
  actionRetirerCourse,
} from "@/app/(app)/cuisine/actions";
import { couleurCategorie, nomCategorie } from "@/lib/cuisine/categories";
import type { ArticleCourses } from "@/db/cuisine";

/**
 * La liste de courses.
 *
 * Cocher un article le verse dans l'inventaire — c'est le seul geste qui tient
 * l'inventaire à jour sans jamais avoir à le remplir. Décocher ne le retire pas
 * de l'inventaire : une course faite reste faite, un doigt qui glisse ne doit
 * pas défaire ce qui est dans le placard.
 */

function Ligne({ article }: { article: ArticleCourses }) {
  const [enAttente, demarrer] = useTransition();
  const couleur = couleurCategorie(article.categorie);

  return (
    <li className="flex items-stretch overflow-hidden rounded-2xl border border-bordure bg-surface">
      <button
        type="button"
        disabled={enAttente}
        onClick={() => demarrer(async () => actionCocherCourse(article.id, !article.achete))}
        aria-pressed={article.achete}
        className="flex min-h-14 flex-1 items-center gap-3 px-4 text-left transition-colors duration-300 active:bg-surface-haut disabled:opacity-50"
      >
        <span
          aria-hidden
          className="grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-300"
          style={{
            borderColor: article.achete ? couleur : "var(--color-bordure-vive)",
            backgroundColor: article.achete ? couleur : "transparent",
          }}
        >
          {article.achete && (
            <svg
              viewBox="0 0 24 24"
              className="size-3"
              fill="none"
              stroke="var(--color-fond)"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className="truncate text-[15px]"
            style={{
              color: article.achete ? "var(--color-tres-doux)" : "var(--color-texte)",
              textDecoration: article.achete ? "line-through" : "none",
            }}
          >
            {article.nom}
          </span>
          <span className="text-[11.5px] text-tres-doux">
            {nomCategorie(article.categorie)}
            {article.achete ? " · versé à l'inventaire" : ""}
          </span>
        </span>
      </button>

      <button
        type="button"
        disabled={enAttente}
        onClick={() => demarrer(async () => actionRetirerCourse(article.id))}
        aria-label={`Retirer ${article.nom}`}
        className="flex w-11 shrink-0 items-center justify-center text-[16px] text-tres-doux transition-colors duration-300 active:text-doux"
      >
        ×
      </button>
    </li>
  );
}

export function Courses({ articles }: { articles: ArticleCourses[] }) {
  const [texte, setTexte] = useState("");
  const [retour, setRetour] = useState<string | null>(null);
  const [enAttente, demarrer] = useTransition();

  const aRanger = articles.filter((a) => a.achete).length;

  function ajouter() {
    const propre = texte.trim();
    if (propre.length === 0 || enAttente) return;
    setTexte("");
    demarrer(async () => {
      const r = await actionAjouterCourse(propre);
      setRetour(r.erreur ?? r.message ?? null);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-2xl border border-bordure bg-surface px-4">
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            ajouter();
          }}
          enterKeyHint="done"
          placeholder="Lait, tomates, pain…"
          aria-label="Ajouter aux courses"
          className="min-h-14 flex-1 bg-transparent text-[15px] text-texte outline-none placeholder:text-tres-doux"
        />
        {texte.trim().length > 0 && (
          <button
            type="button"
            onClick={ajouter}
            disabled={enAttente}
            className="shrink-0 text-[13px] text-doux disabled:opacity-40"
          >
            Ajouter
          </button>
        )}
      </div>

      <p aria-live="polite" className="min-h-4 text-[12px] text-tres-doux">
        {retour ?? ""}
      </p>

      {articles.length === 0 ? (
        <p className="rounded-2xl border border-bordure/60 px-5 py-6 text-center text-[14px] leading-relaxed text-doux">
          Liste vide. Ce qui est épuisé dans l'inventaire s'ajoute ici d'un tap.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {articles.map((article) => (
            <Ligne key={article.id} article={article} />
          ))}
        </ul>
      )}

      {aRanger > 0 && (
        <button
          type="button"
          disabled={enAttente}
          onClick={() =>
            demarrer(async () => {
              const r = await actionRangerCourses();
              setRetour(r.message ?? null);
            })
          }
          className="min-h-12 rounded-xl border border-bordure text-[13.5px] text-doux transition-colors duration-300 active:bg-surface-haut disabled:opacity-40"
        >
          Ranger les {aRanger} article{aRanger > 1 ? "s" : ""} achetés
        </button>
      )}
    </section>
  );
}
