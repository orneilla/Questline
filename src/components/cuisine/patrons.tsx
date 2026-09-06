"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import {
  actionBasculerPatron,
  actionCreerPatron,
  actionDeplacerPatron,
  actionModifierPatron,
  actionSupprimerPatron,
  type Retour,
} from "@/app/(app)/cuisine/patrons/actions";
import { Depliant, Envoyer, Retourner, champ, etiquette } from "@/components/reglages/briques";
import { CATEGORIES, couleurCategorie, nomCategorie } from "@/lib/cuisine/categories";
import { MODES_CUISSON, nomCuisson } from "@/lib/cuisine/nutrition";
import type { EtatPatron } from "@/lib/cuisine/patrons";

/**
 * Réglage des patrons de plat.
 *
 * Un patron ne nomme aucun aliment : il dit une structure — « un féculent, une
 * protéine, un légume, à la poêle, sans laitage » — et l'inventaire remplit
 * ses places. Les huit posés à l'installation décrivent une cuisine générique ;
 * cet écran existe pour qu'ils décrivent la sienne.
 *
 * Chaque fiche annonce ce que l'inventaire du jour en fait : un patron dont
 * une place reste vide ne produit rien, et mieux vaut le lire ici que
 * s'étonner de son absence dans les suggestions.
 */

/* ────────────────────── Sélecteurs ────────────────────── */

function Pastille({
  libelle,
  choisi,
  couleur,
  surClic,
}: {
  libelle: string;
  choisi: boolean;
  couleur?: string;
  surClic: () => void;
}) {
  return (
    <button
      type="button"
      onClick={surClic}
      aria-pressed={choisi}
      className="min-h-10 rounded-full border px-3.5 text-[13px] transition-colors duration-300"
      style={{
        borderColor: choisi
          ? (couleur ?? "var(--color-bordure-vive)")
          : "var(--color-bordure)",
        backgroundColor: choisi ? "var(--color-surface-haut)" : "transparent",
        color: choisi ? "var(--color-texte)" : "var(--color-tres-doux)",
      }}
    >
      {libelle}
    </button>
  );
}

/**
 * Les places du patron, dans l'ordre où on les coche.
 *
 * Pas de doublon possible : deux places « légume » ne donneraient pas deux
 * légumes différents mais deux fois le même article, le moteur choisissant par
 * rang dans une liste identique.
 */
function ChoixCategories({
  valeurs,
  surChangement,
}: {
  valeurs: string[];
  surChangement: (suivant: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={etiquette}>Les places à pourvoir</span>
      {valeurs.map((cle) => (
        <input key={cle} type="hidden" name="categories" value={cle} />
      ))}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((categorie) => {
          const rang = valeurs.indexOf(categorie.cle);
          return (
            <Pastille
              key={categorie.cle}
              libelle={rang < 0 ? categorie.nom : `${rang + 1}. ${categorie.nom}`}
              choisi={rang >= 0}
              couleur={categorie.couleur}
              surClic={() =>
                surChangement(
                  rang < 0
                    ? [...valeurs, categorie.cle]
                    : valeurs.filter((v) => v !== categorie.cle),
                )
              }
            />
          );
        })}
      </div>
      <p className="text-[12px] leading-relaxed text-tres-doux">
        {valeurs.length === 0
          ? "Sans place, le patron ne propose rien."
          : `${valeurs.length} place${valeurs.length > 1 ? "s" : ""} : ${valeurs
              .map((c) => nomCategorie(c).toLowerCase())
              .join(", ")}. Chacune doit trouver un article disponible, sinon le patron ne tient pas.`}
      </p>
    </div>
  );
}

function ChoixCuisson({
  valeur,
  surChangement,
}: {
  valeur: string;
  surChangement: (cle: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={etiquette}>Cuisson</span>
      <input type="hidden" name="modeCuisson" value={valeur} />
      <div className="flex flex-wrap gap-1.5">
        {MODES_CUISSON.map((mode) => (
          <Pastille
            key={mode.cle}
            libelle={mode.nom}
            choisi={valeur === mode.cle}
            surClic={() => surChangement(mode.cle)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Les exclusions, dites en deux langues.
 *
 * Une catégorie entière — « ce patron ne va pas avec les laitages » — ou un mot
 * cherché dans le nom des articles — « pas de fromage ». Sans le premier cas il
 * faudrait énumérer tous les fromages du monde pour écarter le parmesan ; sans
 * le second, on ne pourrait pas écarter une seule chose d'une catégorie qu'on
 * garde par ailleurs.
 */
function ChoixExclusions({
  categories,
  mots,
  surCategories,
}: {
  categories: string[];
  mots: string;
  surCategories: (suivant: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={etiquette}>Ce qui ne va pas avec</span>
      {categories.map((cle) => (
        <input key={cle} type="hidden" name="exclutCategorie" value={cle} />
      ))}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((categorie) => (
          <Pastille
            key={categorie.cle}
            libelle={categorie.nom}
            choisi={categories.includes(categorie.cle)}
            surClic={() =>
              surCategories(
                categories.includes(categorie.cle)
                  ? categories.filter((v) => v !== categorie.cle)
                  : [...categories, categorie.cle],
              )
            }
          />
        ))}
      </div>
      <input
        name="exclutMots"
        defaultValue={mots}
        maxLength={200}
        placeholder="fromage, crème, poisson"
        className={`${champ} mt-1`}
      />
      <p className="text-[12px] leading-relaxed text-tres-doux">
        Les catégories cochées sont écartées en entier. Les mots, eux, sont
        cherchés dans le nom des articles — accents et majuscules n&apos;y changent
        rien. Sépare-les par des virgules.
      </p>
    </div>
  );
}

/* ────────────────────── Le corps d'un formulaire ────────────────────── */

type Depart = {
  nom: string;
  categories: string[];
  profil: string;
  modeCuisson: string;
  exclut: string[];
};

const CLES_CATEGORIES = CATEGORIES.map((c) => c.cle);

/** Sépare une liste d'exclusions en catégories cochées et mots libres. */
function demeler(exclut: string[]): { categories: string[]; mots: string } {
  return {
    categories: exclut.filter((e) => CLES_CATEGORIES.includes(e)),
    mots: exclut.filter((e) => !CLES_CATEGORIES.includes(e)).join(", "),
  };
}

function CorpsPatron({ depart }: { depart: Depart }) {
  const separe = demeler(depart.exclut);
  const [categories, setCategories] = useState(depart.categories);
  const [cuisson, setCuisson] = useState(depart.modeCuisson);
  const [exclutCategories, setExclutCategories] = useState(separe.categories);

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Nom</span>
        <input
          name="nom"
          defaultValue={depart.nom}
          required
          maxLength={60}
          placeholder="Sauté complet"
          className={champ}
        />
      </label>

      <ChoixCategories valeurs={categories} surChangement={setCategories} />
      <ChoixCuisson valeur={cuisson} surChangement={setCuisson} />
      <ChoixExclusions
        categories={exclutCategories}
        mots={separe.mots}
        surCategories={setExclutCategories}
      />

      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Note de profil</span>
        <input
          name="profil"
          defaultValue={depart.profil}
          maxLength={40}
          placeholder="méditerranéen"
          className={champ}
        />
        <span className="text-[12px] leading-relaxed text-tres-doux">
          Un mot pour toi, à titre indicatif. Il n&apos;entre pas dans le calcul :
          seules les places, les exclusions et l&apos;état du patron changent ce qui
          est proposé.
        </span>
      </label>
    </>
  );
}

/* ────────────────────── Une fiche ────────────────────── */

/** Ce que l'inventaire du jour fait de ce patron, en une ligne. */
function resume(etat: EtatPatron): string {
  if (!etat.patron.actif) return "en sommeil";

  if (etat.categoriesVides.length > 0) {
    const noms = etat.categoriesVides.map((c) => nomCategorie(c).toLowerCase()).join(", ");
    return `ne tient pas aujourd'hui — rien en ${noms}`;
  }

  const base = `tient avec ton placard · ${nomCuisson(etat.patron.modeCuisson)}`;
  if (etat.nbEcartes === 0) return base;
  return `${base} · ${etat.nbEcartes} article${etat.nbEcartes > 1 ? "s" : ""} écarté${
    etat.nbEcartes > 1 ? "s" : ""
  }`;
}

function FichePatron({
  etat,
  ids,
  premier,
  dernier,
}: {
  etat: EtatPatron;
  ids: number[];
  premier: boolean;
  dernier: boolean;
}) {
  const { patron } = etat;
  const [retourForm, action] = useActionState<Retour, FormData>(
    actionModifierPatron.bind(null, patron.id),
    {},
  );
  const [retour, setRetour] = useState<Retour>({});
  const [actif, setActif] = useState(patron.actif);
  const [enAttente, demarrer] = useTransition();

  return (
    <Depliant titre={patron.nom} detail={resume(etat)} attenue={!actif}>
      <form action={action} className="flex flex-col gap-4">
        <CorpsPatron
          depart={{
            nom: patron.nom,
            categories: patron.categories,
            profil: patron.profil,
            modeCuisson: patron.modeCuisson,
            exclut: patron.exclut,
          }}
        />
        <Envoyer />
        <Retourner etat={retourForm} />
      </form>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={premier || enAttente}
          onClick={() =>
            demarrer(async () => setRetour(await actionDeplacerPatron(ids, patron.id, -1)))
          }
          className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux disabled:opacity-30"
        >
          Monter
        </button>
        <button
          type="button"
          disabled={dernier || enAttente}
          onClick={() =>
            demarrer(async () => setRetour(await actionDeplacerPatron(ids, patron.id, 1)))
          }
          className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux disabled:opacity-30"
        >
          Descendre
        </button>
      </div>

      <button
        type="button"
        disabled={enAttente}
        onClick={() =>
          demarrer(async () => {
            const suivant = !actif;
            setActif(suivant);
            setRetour(await actionBasculerPatron(patron.id, suivant));
          })
        }
        className="mt-2 min-h-11 w-full rounded-xl border border-bordure text-[13px] text-doux transition-colors duration-300 active:bg-surface-haut disabled:opacity-40"
      >
        {actif ? "Mettre en sommeil" : "Remettre en service"}
      </button>

      <Retourner etat={retour} />

      <SuppressionPatron id={patron.id} nom={patron.nom} />
    </Depliant>
  );
}

/**
 * Suppression en deux temps.
 *
 * Rien ne dépend d'un patron : les recettes qu'il a servi à créer vivent leur
 * vie depuis la conversion. Ce qui se perd, c'est la structure elle-même — d'où
 * le rappel que le sommeil fait la même chose sans effacer.
 */
function SuppressionPatron({ id, nom }: { id: number; nom: string }) {
  const [confirme, setConfirme] = useState(false);
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-bordure pt-3">
      {!confirme ? (
        <button
          type="button"
          onClick={() => setConfirme(true)}
          className="min-h-11 self-start text-left text-[12.5px] text-tres-doux transition-colors duration-300 active:text-doux"
        >
          Supprimer ce patron
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-bordure-vive p-3">
          <p className="text-[12.5px] leading-relaxed text-doux">
            « {nom} » disparaît. Tes recettes et ton historique ne bougent pas : rien
            d&apos;autre ne dépend de lui. Mais la structure est perdue — le sommeil
            l&apos;écarte des suggestions sans l&apos;effacer.
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
                  setRetour(await actionSupprimerPatron(id));
                  setConfirme(false);
                })
              }
              className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[13.5px] text-texte disabled:opacity-50"
            >
              {enAttente ? "…" : "Supprimer"}
            </button>
          </div>
        </div>
      )}

      <Retourner etat={retour} />
    </div>
  );
}

/* ────────────────────── Ajout ────────────────────── */

function AjoutPatron() {
  const [etat, action] = useActionState<Retour, FormData>(actionCreerPatron, {});
  const [rang, setRang] = useState(0);

  // Après un ajout réussi, le formulaire repart vierge. Sans cela les pastilles
  // garderaient l'état du patron précédent, et le suivant se créerait par
  // inadvertance à son image.
  useEffect(() => {
    if (etat.message) setRang((r) => r + 1);
  }, [etat]);

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-bordure px-5 py-4">
      <span className={etiquette}>Nouveau patron</span>
      <form key={rang} action={action} className="flex flex-col gap-4">
        <CorpsPatron
          depart={{
            nom: "",
            categories: [],
            profil: "",
            modeCuisson: MODES_CUISSON[0].cle,
            exclut: [],
          }}
        />
        <Envoyer libelle="Ajouter" />
      </form>
      <Retourner etat={etat} />
    </div>
  );
}

/* ────────────────────── L'écran ────────────────────── */

export function Patrons({ etats }: { etats: EtatPatron[] }) {
  const ids = etats.map((e) => e.patron.id);

  return (
    <div className="flex flex-col gap-2">
      {etats.length === 0 && (
        <p className="rounded-2xl border border-bordure/60 px-5 py-6 text-center text-[13.5px] leading-relaxed text-doux">
          Aucun patron. Sans eux, « Que cuisiner » ne propose que tes recettes
          existantes.
        </p>
      )}

      {etats.map((etat, rang) => (
        <FichePatron
          key={etat.patron.id}
          etat={etat}
          ids={ids}
          premier={rang === 0}
          dernier={rang === etats.length - 1}
        />
      ))}

      <AjoutPatron />
    </div>
  );
}
