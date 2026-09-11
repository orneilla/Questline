"use client";

import { useActionState, useState, useTransition } from "react";

import {
  actionCreerAliment,
  actionModifierAliment,
  actionSupprimerAliment,
  type Retour,
} from "@/app/(app)/cuisine/aliments/actions";
import { Depliant, Envoyer, Retourner, champ, etiquette } from "@/components/reglages/briques";

import { CATEGORIES, couleurCategorie, nomCategorie } from "@/lib/cuisine/categories";
import type { AlimentManuel } from "@/lib/cuisine/aliments";

/**
 * La même boîte que `champ`, sans largeur.
 *
 * `champ` porte `w-full`. Lui ajouter `w-24` ne le rétrécit pas : deux règles
 * de même spécificité, et c'est l'ordre du fichier CSS qui tranche, pas
 * l'ordre des classes écrites ici. Une largeur ne se surcharge pas, elle se
 * choisit — d'où cette variante sans largeur pour les cases du tableau
 * nutritionnel.
 */
const boite =
  "min-h-12 rounded-xl border border-bordure bg-surface px-3 text-[15px] text-texte outline-none transition-colors duration-300 placeholder:text-tres-doux focus:border-bordure-vive";

/**
 * Saisir un produit emballé depuis son étiquette.
 *
 * ── L'ordre des champs suit l'emballage
 *
 * Énergie, protéines, glucides dont sucres, lipides dont acides gras saturés,
 * fibres, sel : c'est l'ordre imposé au tableau nutritionnel européen. Le
 * formulaire le reprend tel quel pour qu'on recopie ligne à ligne sans avoir à
 * chercher où va quoi.
 *
 * ── Un champ vide n'est pas un zéro
 *
 * Tous les emballages ne donnent pas les fibres. Laisser vide veut dire « pas
 * imprimé », et le journal sait déjà dire qu'un nutriment n'est pas couvert.
 * Écrire zéro serait affirmer une absence qu'on n'a pas lue.
 */

/** Les huit valeurs du tableau, dans l'ordre où elles y figurent. */
const VALEURS: { cle: string; nom: string; unite: string; retrait?: boolean }[] = [
  { cle: "kcal100g", nom: "Énergie", unite: "kcal" },
  { cle: "proteines100g", nom: "Protéines", unite: "g" },
  { cle: "glucides100g", nom: "Glucides", unite: "g" },
  { cle: "sucres100g", nom: "dont sucres", unite: "g", retrait: true },
  { cle: "lipides100g", nom: "Lipides", unite: "g" },
  { cle: "ags100g", nom: "dont saturés", unite: "g", retrait: true },
  { cle: "fibres100g", nom: "Fibres", unite: "g" },
  { cle: "sel100g", nom: "Sel", unite: "g" },
];

function Remarques({ etat }: { etat: Retour }) {
  if (!etat.remarques || etat.remarques.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 rounded-xl border border-bordure-vive p-3">
      {etat.remarques.map((remarque) => (
        <li key={remarque.champ + remarque.message} className="text-[12.5px] leading-relaxed text-doux">
          {remarque.message}
        </li>
      ))}
    </ul>
  );
}

function Champs({ aliment }: { aliment?: AlimentManuel }) {
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Nom du produit</span>
        <input
          name="nom"
          defaultValue={aliment?.nom ?? ""}
          required
          maxLength={120}
          placeholder="ex. NutBar noisette"
          className={champ}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Marque</span>
        <input
          name="marque"
          defaultValue={aliment?.marque ?? ""}
          maxLength={60}
          placeholder="ex. Knoppers"
          className={champ}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Catégorie</span>
        <select
          key={aliment?.categorie}
          name="categorie"
          defaultValue={aliment?.categorie ?? "sucre"}
          className={champ}
        >
          {CATEGORIES.map((categorie) => (
            <option key={categorie.cle} value={categorie.cle}>
              {categorie.nom}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-1 flex flex-col gap-2 rounded-xl border border-bordure p-3">
        <span className={etiquette}>Pour 100 g, comme sur l&apos;emballage</span>
        <p className="text-[12px] leading-relaxed text-tres-doux">
          Recopie la colonne « pour 100 g », pas celle de la portion. Laisse vide
          ce qui n&apos;est pas imprimé : un champ vide veut dire « non indiqué »,
          pas « zéro ».
        </p>

        {VALEURS.map((valeur) => (
          <label key={valeur.cle} className="flex items-center gap-3">
            <span
              className={`flex-1 text-[13.5px] ${
                valeur.retrait ? "pl-3 text-tres-doux" : "text-doux"
              }`}
            >
              {valeur.nom}
            </span>
            <input
              key={String(aliment?.[valeur.cle as keyof AlimentManuel] ?? "")}
              name={valeur.cle}
              defaultValue={
                (aliment?.[valeur.cle as keyof AlimentManuel] as number | null | undefined) ??
                ""
              }
              inputMode="decimal"
              placeholder="—"
              className={`${boite} w-[5.5rem] shrink-0 text-center tabular-nums`}
            />
            <span className="w-8 shrink-0 text-[12px] text-tres-doux">{valeur.unite}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-bordure p-3">
        <span className={etiquette}>Une portion</span>
        <p className="text-[12px] leading-relaxed text-tres-doux">
          Le poids net d&apos;une unité, écrit sur l&apos;emballage. Renseigné, il
          permet de noter « 1 barre » au lieu de retrouver le grammage à chaque
          fois. Laisse vide pour ce qui se pèse vraiment.
        </p>
        <div className="flex gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={etiquette}>Poids</span>
            <input
              key={String(aliment?.poidsPortionG ?? "")}
              name="poidsPortionG"
              defaultValue={aliment?.poidsPortionG ?? ""}
              inputMode="decimal"
              placeholder="40"
              className={`${boite} w-full text-center tabular-nums`}
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={etiquette}>S&apos;appelle</span>
            <input
              name="nomPortion"
              defaultValue={aliment?.nomPortion ?? ""}
              maxLength={24}
              placeholder="barre"
              className={champ}
            />
          </label>
        </div>
      </div>
    </>
  );
}

function Ajout() {
  const [etat, action] = useActionState<Retour, FormData>(actionCreerAliment, {});

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-bordure px-5 py-4">
      <span className={etiquette}>Nouveau produit</span>
      <Champs />
      <Envoyer libelle="Ajouter au catalogue" />
      <Retourner etat={etat} />
      <Remarques etat={etat} />
    </form>
  );
}

function Fiche({ aliment }: { aliment: AlimentManuel }) {
  const [etat, action] = useActionState<Retour, FormData>(
    actionModifierAliment.bind(null, aliment.id),
    {},
  );
  const [retour, setRetour] = useState<Retour>({});
  const [confirme, setConfirme] = useState(false);
  const [enAttente, demarrer] = useTransition();

  const detail = [
    aliment.marque,
    aliment.kcal100g !== null ? `${Math.round(aliment.kcal100g)} kcal / 100 g` : "sans énergie",
    aliment.poidsPortionG !== null
      ? `${aliment.poidsPortionG} g ${aliment.nomPortion || "la portion"}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Depliant titre={aliment.nom} detail={detail}>
      <div className="mb-3 flex items-center gap-2">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: couleurCategorie(aliment.categorie) }}
        />
        <span className="text-[12px] text-tres-doux">
          {nomCategorie(aliment.categorie)} · saisi le {aliment.dateVerification}
        </span>
      </div>

      <form action={action} className="flex flex-col gap-3">
        <Champs aliment={aliment} />
        <Envoyer />
        <Retourner etat={etat} />
        <Remarques etat={etat} />
      </form>

      <div className="mt-3 flex flex-col gap-2 border-t border-bordure pt-3">
        {confirme ? (
          <div className="flex flex-col gap-2 rounded-xl border border-bordure-vive p-3">
            <p className="text-[12.5px] leading-relaxed text-doux">
              « {aliment.nom} » quitte le catalogue. Les repas déjà notés ne
              bougent pas : chacun garde son propre instantané des valeurs.
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
                    setRetour(await actionSupprimerAliment(aliment.id));
                    setConfirme(false);
                  })
                }
                className="min-h-12 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[13.5px] text-texte disabled:opacity-50"
              >
                {enAttente ? "…" : "Retirer"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirme(true)}
            className="min-h-11 self-start text-left text-[12.5px] text-tres-doux transition-colors duration-300 active:text-doux"
          >
            Retirer du catalogue
          </button>
        )}
        <Retourner etat={retour} />
      </div>
    </Depliant>
  );
}

export function AlimentsEmballes({ liste }: { liste: AlimentManuel[] }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          {liste.length === 0 ? (
            <p className="rounded-2xl border border-bordure/60 px-5 py-5 text-center text-[13.5px] text-doux">
              Aucun produit saisi. Le catalogue ne contient pour l&apos;instant que
              les produits bruts de la table Ciqual.
            </p>
          ) : (
            liste.map((aliment) => <Fiche key={aliment.id} aliment={aliment} />)
          )}
        </div>
      </section>

      <Ajout />
    </div>
  );
}
