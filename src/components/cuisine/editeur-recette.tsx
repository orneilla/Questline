"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  actionAjouterIngredient,
  actionChercherAliment,
  actionCuisinee,
  actionDupliquer,
  actionModifierIngredient,
  actionModifierRecette,
  actionRetirerIngredient,
  actionSupprimerRecette,
  type Retour,
} from "@/app/(app)/cuisine/recettes/actions";
import {
  AIDES_ROLE,
  LIBELLES_ROLE,
  MODES_CUISSON,
} from "@/lib/cuisine/nutrition";
import { CATEGORIES } from "@/lib/cuisine/categories";
import type { IngredientCalcul } from "@/lib/cuisine/nutrition";
import type { Recette, RoleIngredient } from "@/db/cuisine";

/**
 * Édition d'une recette et de ses ingrédients.
 *
 * Les grammages sont crus, toujours, et le formulaire le répète : c'est la
 * seule règle qui, mal comprise, rend tout le reste faux sans que rien ne le
 * signale.
 */

/**
 * La boîte d'un champ, sans largeur.
 *
 * `champ` y ajoute `w-full`. Les deux existent séparément parce que poser
 * `w-full` puis le contredire par une largeur fixe laissait la victoire à la
 * dernière règle du fichier CSS, pas à la plus proche : dans la ligne d'ajout
 * d'un ingrédient, le champ des grammes prenait 255 px et celui du nom se
 * réduisait à 26. Une largeur ne se surcharge pas, elle se choisit.
 */
const boite =
  "min-h-12 rounded-xl border border-bordure bg-surface px-3 text-[15px] text-texte placeholder:text-tres-doux";
const champ = `${boite} w-full`;
const etiquette = "text-[11.5px] tracking-[0.1em] text-tres-doux uppercase";

const ROLES: RoleIngredient[] = ["essentiel", "optionnel", "substituable"];

type Trouve = {
  id: number;
  nom: string;
  etat: "cru" | "cuit";
  source: string;
  kcal100g: number | null;
};

/* ─────────────────────── Un ingrédient ─────────────────────── */

function LigneIngredient({
  recetteId,
  ingredient,
}: {
  recetteId: number;
  ingredient: IngredientCalcul;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [quantite, setQuantite] = useState(String(ingredient.quantiteG));
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<Trouve[]>([]);
  const [enAttente, demarrer] = useTransition();

  const sansFiche = ingredient.fiche === null;
  const manuel = ingredient.fiche?.source === "manuel";
  const cuit = ingredient.fiche?.etat === "cuit";

  function chercher(texte: string) {
    setRecherche(texte);
    if (texte.trim().length < 2) {
      setTrouves([]);
      return;
    }
    demarrer(async () => setTrouves((await actionChercherAliment(texte)) as Trouve[]));
  }

  return (
    <li className="overflow-hidden rounded-2xl border border-bordure bg-surface">
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        aria-expanded={ouvert}
        className="flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors duration-300 active:bg-surface-haut"
      >
        <span className="w-16 shrink-0 text-[14px] text-doux tabular-nums">
          {Math.round(ingredient.quantiteG)} g
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] text-texte">{ingredient.nomLibre}</span>
          <span className="truncate text-[11.5px] text-tres-doux">
            {LIBELLES_ROLE[ingredient.role]}
            {ingredient.role === "substituable" && ingredient.categorieSubstitution
              ? ` · ${ingredient.categorieSubstitution}`
              : ""}
            {sansFiche
              ? " · sans fiche"
              : ` · ${ingredient.fiche?.nom}${manuel ? " ⚠ manuel" : ""}${cuit ? " ⚠ cuit" : ""}`}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-[16px] text-tres-doux">
          {ouvert ? "×" : "+"}
        </span>
      </button>

      {ouvert && (
        <div className="flex flex-col gap-3 border-t border-bordure px-4 py-3">
          <label className="flex flex-col gap-1.5">
            <span className={etiquette}>Quantité, en poids cru</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              onBlur={() =>
                demarrer(async () => {
                  await actionModifierIngredient(recetteId, ingredient.id, {
                    quantiteG: Number(quantite),
                  });
                })
              }
              className={champ}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={etiquette}>Rôle</span>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((role) => {
                const choisi = role === ingredient.role;
                return (
                  <button
                    key={role}
                    type="button"
                    disabled={enAttente}
                    onClick={() =>
                      demarrer(async () => {
                        await actionModifierIngredient(recetteId, ingredient.id, { role });
                      })
                    }
                    aria-pressed={choisi}
                    className="min-h-9 rounded-full border px-3 text-[12px] transition-colors duration-200"
                    style={{
                      borderColor: choisi
                        ? "var(--color-bordure-vive)"
                        : "var(--color-bordure)",
                      backgroundColor: choisi ? "var(--color-surface-haut)" : "transparent",
                      color: choisi ? "var(--color-texte)" : "var(--color-tres-doux)",
                    }}
                  >
                    {LIBELLES_ROLE[role]}
                  </button>
                );
              })}
            </div>
            <span className="text-[11.5px] leading-relaxed text-tres-doux">
              {AIDES_ROLE[ingredient.role]}
            </span>
          </div>

          {ingredient.role === "substituable" && (
            <label className="flex flex-col gap-1.5">
              <span className={etiquette}>Remplaçable par</span>
              <select
                defaultValue={ingredient.categorieSubstitution ?? ""}
                onChange={(e) =>
                  demarrer(async () => {
                    await actionModifierIngredient(recetteId, ingredient.id, {
                      categorieSubstitution: e.target.value || null,
                    });
                  })
                }
                className={champ}
              >
                <option value="">Sans catégorie</option>
                {CATEGORIES.map((c) => (
                  <option key={c.cle} value={c.cle}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-col gap-1.5">
            <span className={etiquette}>
              {sansFiche ? "Relier au catalogue" : "Changer de fiche"}
            </span>
            <input
              value={recherche}
              onChange={(e) => chercher(e.target.value)}
              placeholder="Chercher un aliment…"
              className={champ}
            />
            {trouves.length > 0 && (
              <ul className="flex flex-col gap-1">
                {trouves.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() =>
                        demarrer(async () => {
                          await actionModifierIngredient(recetteId, ingredient.id, {
                            alimentId: t.id,
                          });
                          setRecherche("");
                          setTrouves([]);
                        })
                      }
                      className="w-full rounded-lg border border-bordure px-3 py-2 text-left text-[12.5px] text-doux transition-colors duration-200 active:bg-surface-haut"
                    >
                      {t.nom}
                      <span className="text-tres-doux">
                        {" "}
                        · {t.etat}
                        {t.kcal100g !== null ? ` · ${Math.round(t.kcal100g)} kcal/100 g` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            disabled={enAttente}
            onClick={() =>
              demarrer(async () => actionRetirerIngredient(recetteId, ingredient.id))
            }
            className="min-h-11 rounded-xl border border-bordure text-[13px] text-tres-doux transition-colors duration-300 active:bg-surface-haut"
          >
            Retirer cet ingrédient
          </button>
        </div>
      )}
    </li>
  );
}

/* ─────────────────────── La liste ─────────────────────── */

export function Ingredients({
  recetteId,
  ingredients,
  catalogueVide,
}: {
  recetteId: number;
  ingredients: IngredientCalcul[];
  /** Aucun aliment de référence : chercher ne rendrait jamais rien. */
  catalogueVide: boolean;
}) {
  const [nom, setNom] = useState("");
  const [grammes, setGrammes] = useState("");
  const [trouves, setTrouves] = useState<Trouve[]>([]);
  const [enAttente, demarrer] = useTransition();

  const orphelins = ingredients.filter((i) => i.fiche === null && i.quantiteG > 0);

  /**
   * Le champ du nom cherche dans le catalogue en même temps qu'on écrit.
   *
   * C'était la marche manquante : on tapait « Oeuf », on obtenait un
   * ingrédient sans fiche, et la recette ne chiffrait rien. Relier était
   * possible, mais deux écrans plus loin, dans un repli qu'on n'ouvre que si
   * on sait déjà qu'il faut l'ouvrir.
   */
  function saisir(texte: string) {
    setNom(texte);
    if (catalogueVide || texte.trim().length < 2) {
      setTrouves([]);
      return;
    }
    demarrer(async () => setTrouves((await actionChercherAliment(texte)) as Trouve[]));
  }

  function ajouter(fiche: Trouve | null) {
    const propre = fiche ? fiche.nom : nom.trim();
    if (propre.length === 0 || enAttente) return;
    setNom("");
    setGrammes("");
    setTrouves([]);
    demarrer(async () => {
      await actionAjouterIngredient(recetteId, {
        nomLibre: propre,
        alimentId: fiche?.id ?? null,
        quantiteG: Number(grammes) || 0,
        role: "essentiel",
        categorieSubstitution: null,
      });
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Ingrédients ({ingredients.length})
        </h2>
        <span className="text-[11.5px] text-tres-doux">poids crus</span>
      </div>

      {/*
        Un ingrédient sans fiche ne pèse dans aucun total. Dit ici, en tête, et
        non sous un tableau de tirets : c'est là qu'on peut encore y remédier.
      */}
      {orphelins.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-bordure-vive px-4 py-3">
          <p className="text-[12.5px] leading-relaxed text-doux">
            {orphelins.length === ingredients.length
              ? "Aucun ingrédient n'est relié au catalogue"
              : `${orphelins.length} ingrédient${orphelins.length > 1 ? "s ne sont pas reliés" : " n'est pas relié"} au catalogue`}{" "}
            : {orphelins.map((i) => i.nomLibre).join(", ")}. Leur poids ne compte dans
            aucun nutriment, et cette recette ne chiffrera rien tant qu&apos;ils
            n&apos;ont pas de fiche.
          </p>
          <p className="text-[11.5px] leading-relaxed text-tres-doux">
            {catalogueVide ? (
              <>
                Le catalogue est vide : il n&apos;y a encore rien à quoi les relier.{" "}
                <Link
                  href="/cuisine/ciqual"
                  className="underline underline-offset-4"
                >
                  Déposer la table Ciqual
                </Link>
                .
              </>
            ) : (
              "Ouvre l'ingrédient, cherche son nom sous « Relier au catalogue », et choisis la fiche."
            )}
          </p>
        </div>
      )}

      {ingredients.length > 0 && (
        <ul className="flex flex-col gap-2">
          {ingredients.map((i) => (
            <LigneIngredient key={i.id} recetteId={recetteId} ingredient={i} />
          ))}
        </ul>
      )}

      {trouves.length > 0 && (
        <ul className="flex flex-col gap-1">
          {trouves.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => ajouter(t)}
                className="w-full rounded-xl border border-bordure px-4 py-2.5 text-left text-[13px] text-doux transition-colors duration-200 active:bg-surface-haut"
              >
                {t.nom}
                <span className="text-tres-doux">
                  {" "}
                  · {t.etat}
                  {t.kcal100g !== null ? ` · ${Math.round(t.kcal100g)} kcal/100 g` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/*
        Le nom prend toute une ligne : c'est le champ où l'on écrit le plus, et
        c'est lui qui cherche dans le catalogue. Le partager avec les grammes le
        réduisait à la largeur de deux lettres.
      */}
      <div className="flex flex-col gap-2">
        <input
          value={nom}
          onChange={(e) => saisir(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            ajouter(null);
          }}
          placeholder={catalogueVide ? "Ingrédient" : "Chercher un aliment…"}
          aria-label="Nom de l'ingrédient"
          className={champ}
        />
        <div className="flex gap-2">
          <input
            value={grammes}
            onChange={(e) => setGrammes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              ajouter(null);
            }}
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="grammes, poids cru"
            aria-label="Quantité en grammes, poids cru"
            className={`${boite} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={() => ajouter(null)}
            disabled={enAttente || nom.trim().length === 0}
            className="min-h-12 w-28 shrink-0 rounded-xl border border-bordure text-[13px] text-doux disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
      </div>

      {!catalogueVide && (
        <p className="text-[11.5px] leading-relaxed text-tres-doux">
          Choisis une fiche dans la liste pour que l&apos;ingrédient compte dans les
          totaux. Le bouton + l&apos;ajoute sans fiche — utile pour ce que le catalogue
          ne connaît pas, mais son poids ne sera compté nulle part.
        </p>
      )}
    </section>
  );
}

/* ─────────────────────── La fiche ─────────────────────── */

export function FicheRecette({ recette }: { recette: Recette }) {
  const router = useRouter();
  const [etat, setEtat] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();
  const [confirme, setConfirme] = useState(false);

  const [valeurs, setValeurs] = useState({
    nom: recette.nom,
    instructions: recette.instructions,
    tempsMinutes: String(recette.tempsMinutes),
    modeCuisson: recette.modeCuisson,
    nbPortions: String(recette.nbPortions),
    poidsTotalCuitG: recette.poidsTotalCuitG === null ? "" : String(recette.poidsTotalCuitG),
    jeReferai: recette.jeReferai,
  });

  function enregistrer() {
    demarrer(async () => {
      setEtat(
        await actionModifierRecette(recette.id, {
          nom: valeurs.nom,
          instructions: valeurs.instructions,
          tempsMinutes: Number(valeurs.tempsMinutes) || 0,
          modeCuisson: valeurs.modeCuisson,
          nbPortions: Number(valeurs.nbPortions) || 1,
          poidsTotalCuitG:
            valeurs.poidsTotalCuitG.trim() === "" ? null : Number(valeurs.poidsTotalCuitG),
          jeReferai: valeurs.jeReferai,
        }),
      );
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Nom</span>
        <input
          value={valeurs.nom}
          onChange={(e) => setValeurs({ ...valeurs, nom: e.target.value })}
          className={champ}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Portions</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={valeurs.nbPortions}
            onChange={(e) => setValeurs({ ...valeurs, nbPortions: e.target.value })}
            className={champ}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Minutes</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={valeurs.tempsMinutes}
            onChange={(e) => setValeurs({ ...valeurs, tempsMinutes: e.target.value })}
            className={champ}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Cuisson</span>
        <select
          value={valeurs.modeCuisson}
          onChange={(e) => setValeurs({ ...valeurs, modeCuisson: e.target.value })}
          className={champ}
        >
          {MODES_CUISSON.map((m) => (
            <option key={m.cle} value={m.cle}>
              {m.nom}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Poids du plat fini, pesé</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={valeurs.poidsTotalCuitG}
          onChange={(e) => setValeurs({ ...valeurs, poidsTotalCuitG: e.target.value })}
          placeholder="laisse vide si tu ne l'as pas pesé"
          className={champ}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Instructions</span>
        <textarea
          value={valeurs.instructions}
          onChange={(e) => setValeurs({ ...valeurs, instructions: e.target.value })}
          rows={6}
          placeholder="Markdown accepté."
          className={`${champ} resize-none py-3 leading-relaxed`}
        />
      </label>

      <label className="flex items-center gap-3 rounded-xl border border-bordure px-4 py-3">
        <input
          type="checkbox"
          checked={valeurs.jeReferai}
          onChange={(e) => setValeurs({ ...valeurs, jeReferai: e.target.checked })}
          className="size-5 shrink-0 accent-[#8fa37e]"
        />
        <span className="text-[14px] text-texte">Je la referai</span>
      </label>

      <button
        type="button"
        onClick={enregistrer}
        disabled={enAttente}
        className="min-h-12 rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte disabled:opacity-50"
      >
        {enAttente ? "…" : "Enregistrer"}
      </button>

      <p
        aria-live="polite"
        className="min-h-4 text-[12.5px]"
        style={{ color: etat.erreur ? "var(--color-doux)" : "var(--color-tres-doux)" }}
      >
        {etat.erreur ?? etat.message ?? ""}
      </p>

      <div className="mt-1 flex flex-col gap-2 border-t border-bordure pt-3">
        {!confirme ? (
          <button
            type="button"
            onClick={() => setConfirme(true)}
            className="min-h-11 self-start text-left text-[12.5px] text-tres-doux transition-colors duration-300 active:text-doux"
          >
            Supprimer cette recette
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-bordure-vive p-3">
            <p className="text-[12.5px] leading-relaxed text-doux">
              La recette et ses ingrédients partent définitivement. Le journal et
              l'inventaire ne sont pas touchés.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirme(false)}
                className="min-h-12 flex-1 rounded-xl border border-bordure text-[13.5px] text-doux"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={enAttente}
                onClick={() =>
                  demarrer(async () => {
                    const r = await actionSupprimerRecette(recette.id);
                    if (r.erreur) {
                      setEtat(r);
                      setConfirme(false);
                      return;
                    }
                    router.replace("/cuisine/recettes");
                    router.refresh();
                  })
                }
                className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[13.5px] text-texte disabled:opacity-50"
              >
                Supprimer
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────── Refaire ─────────────────────── */

/**
 * Les deux gestes d'après-cuisine.
 *
 * « J'ai cuisiné » compte une fois de plus sur la même recette. « Refaire »
 * en fait une copie, grammages compris, pour n'ajuster que ce qui change —
 * c'est le chemin principal, il est donc au même niveau que l'autre et pas
 * caché derrière un menu.
 */
export function ApresCuisine({ recette }: { recette: Recette }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [enAttente, demarrer] = useTransition();

  return (
    <section className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={enAttente}
          onClick={() =>
            demarrer(async () => {
              await actionCuisinee(recette.id);
              setMessage("Comptée une fois de plus.");
            })
          }
          className="min-h-12 flex-1 rounded-xl border border-bordure text-[13.5px] text-doux transition-colors duration-300 active:bg-surface-haut disabled:opacity-40"
        >
          J&apos;ai cuisiné
        </button>
        <button
          type="button"
          disabled={enAttente}
          onClick={() =>
            demarrer(async () => {
              const r = await actionDupliquer(recette.id);
              if (r.id) {
                router.push(`/cuisine/recettes/${r.id}`);
                router.refresh();
              } else setMessage(r.erreur ?? null);
            })
          }
          className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[13.5px] text-texte disabled:opacity-40"
        >
          Refaire — copier
        </button>
      </div>
      <p aria-live="polite" className="min-h-4 text-[12px] text-tres-doux">
        {message ??
          (recette.nbFoisCuisinee > 0
            ? `Cuisinée ${recette.nbFoisCuisinee} fois${recette.derniereFois ? `, la dernière le ${recette.derniereFois}` : ""}.`
            : "Jamais cuisinée pour l'instant.")}
      </p>
    </section>
  );
}
