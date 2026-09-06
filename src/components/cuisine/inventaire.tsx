"use client";

import { useState, useTransition } from "react";

import {
  actionAjouterStock,
  actionCategorieStock,
  actionPeremption,
  actionRacheter,
  actionRetirerStock,
  actionTournerNiveau,
} from "@/app/(app)/cuisine/actions";
import { CATEGORIES, couleurCategorie, nomCategorie } from "@/lib/cuisine/categories";
import type { LigneInventaire } from "@/lib/cuisine/donnees";
import type { NiveauCuisine } from "@/db/cuisine";

/**
 * L'inventaire.
 *
 * Deux gestes, pas plus. Ajouter : on écrit le nom, on valide — la catégorie
 * est devinée. Mettre à jour : un tap sur l'article fait tourner son niveau,
 * beaucoup → un peu → épuisé → beaucoup. Tout le reste (catégorie, péremption,
 * suppression) est replié derrière un second tap, parce que c'est rare.
 *
 * Un inventaire qui demande de peser ou de choisir dans un menu à chaque
 * ajout n'est pas tenu une semaine. Celui-ci accepte d'être approximatif.
 */

const LIBELLES_NIVEAU: Record<NiveauCuisine, string> = {
  beaucoup: "beaucoup",
  un_peu: "un peu",
  epuise: "épuisé",
};

/** Trois barres pleines, deux, une : le niveau se lit sans lire le mot. */
function Jauge({ niveau, couleur }: { niveau: NiveauCuisine; couleur: string }) {
  const pleines = niveau === "beaucoup" ? 3 : niveau === "un_peu" ? 2 : 1;

  return (
    <span aria-hidden className="flex shrink-0 items-end gap-[3px]">
      {[0, 1, 2].map((rang) => (
        <span
          key={rang}
          className="w-[3px] rounded-full transition-all duration-300"
          style={{
            height: `${8 + rang * 4}px`,
            backgroundColor: rang < pleines ? couleur : "var(--color-bordure)",
            opacity: niveau === "epuise" ? 0.5 : 1,
          }}
        />
      ))}
    </span>
  );
}

function Article({ article }: { article: LigneInventaire }) {
  const [ouvert, setOuvert] = useState(false);
  const [enAttente, demarrer] = useTransition();
  const couleur = couleurCategorie(article.categorie);
  const epuise = article.niveau === "epuise";

  return (
    <li className="overflow-hidden rounded-2xl border border-bordure bg-surface">
      <div className="flex items-stretch">
        <button
          type="button"
          disabled={enAttente}
          onClick={() => demarrer(async () => actionTournerNiveau(article.id))}
          aria-label={`${article.nomLibre} — ${LIBELLES_NIVEAU[article.niveau]}, changer`}
          className="flex min-h-14 flex-1 items-center gap-3 px-4 text-left transition-colors duration-300 active:bg-surface-haut disabled:opacity-50"
          style={{ opacity: epuise ? 0.6 : 1 }}
        >
          <Jauge niveau={article.niveau} couleur={couleur} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15px] text-texte">{article.nomLibre}</span>
            <span className="text-[11.5px] text-tres-doux">
              {nomCategorie(article.categorie)} · {LIBELLES_NIVEAU[article.niveau]}
              {article.datePeremption ? ` · avant le ${article.datePeremption}` : ""}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOuvert(!ouvert)}
          aria-expanded={ouvert}
          aria-label={`Régler ${article.nomLibre}`}
          className="flex w-11 shrink-0 items-center justify-center text-[16px] text-tres-doux transition-colors duration-300 active:text-doux"
        >
          {ouvert ? "×" : "+"}
        </button>
      </div>

      {ouvert && (
        <div className="flex flex-col gap-3 border-t border-bordure px-4 py-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] tracking-[0.1em] text-tres-doux uppercase">
              Catégorie
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const choisi = c.cle === article.categorie;
                return (
                  <button
                    key={c.cle}
                    type="button"
                    disabled={enAttente}
                    onClick={() =>
                      demarrer(async () => actionCategorieStock(article.id, c.cle))
                    }
                    aria-pressed={choisi}
                    className="min-h-9 rounded-full border px-3 text-[12px] transition-colors duration-200"
                    style={{
                      borderColor: choisi ? c.couleur : "var(--color-bordure)",
                      backgroundColor: choisi ? `${c.couleur}1f` : "transparent",
                      color: choisi ? "var(--color-texte)" : "var(--color-tres-doux)",
                    }}
                  >
                    {c.nom}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] tracking-[0.1em] text-tres-doux uppercase">
              À consommer avant
            </span>
            <input
              type="date"
              defaultValue={article.datePeremption ?? ""}
              onChange={(e) =>
                demarrer(async () => actionPeremption(article.id, e.target.value))
              }
              className="min-h-11 rounded-xl border border-bordure bg-surface px-3 text-[14px] text-texte"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={enAttente}
              onClick={() =>
                demarrer(async () => {
                  await actionRacheter(article.nomLibre, article.categorie);
                })
              }
              className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux transition-colors duration-300 active:bg-surface-haut"
            >
              Aux courses
            </button>
            <button
              type="button"
              disabled={enAttente}
              onClick={() => demarrer(async () => actionRetirerStock(article.id))}
              className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-tres-doux transition-colors duration-300 active:bg-surface-haut"
            >
              Retirer
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function Inventaire({ articles }: { articles: LigneInventaire[] }) {
  const [texte, setTexte] = useState("");
  const [retour, setRetour] = useState<string | null>(null);
  const [enAttente, demarrer] = useTransition();

  function ajouter() {
    const propre = texte.trim();
    if (propre.length === 0 || enAttente) return;
    setTexte("");
    demarrer(async () => {
      const r = await actionAjouterStock(propre);
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
          placeholder="Courgettes, riz, yaourts…"
          aria-label="Ajouter à l'inventaire"
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
          Rien pour l'instant. Écris ce que tu as sous la main — approximatif suffit,
          c'est même le but.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {articles.map((article) => (
            <Article key={article.id} article={article} />
          ))}
        </ul>
      )}
    </section>
  );
}
