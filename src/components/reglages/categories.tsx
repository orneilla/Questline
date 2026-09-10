"use client";

import { useActionState, useState, useTransition } from "react";

import {
  actionCreerCategorie,
  actionCreerRegle,
  actionDeplacerCategorie,
  actionDeplacerRegle,
  actionModifierCategorie,
  actionModifierRegle,
  actionPerteCategorie,
  actionSupprimerCategorie,
  actionSupprimerRegle,
  type Retour,
} from "@/app/(app)/reglages/categories-actions";
import { Depliant, Envoyer, Retourner, champ, etiquette } from "@/components/reglages/briques";
import {
  PALETTE_CRENEAUX,
  classer,
  fondCategorie,
  replier,
  type CategorieAffichee,
  type RegleAffichee,
} from "@/lib/categories-partage";
import type { PerteCategorie } from "@/lib/categories";

/**
 * Les catégories de créneau, et les règles qui les attribuent.
 *
 * Deux choses distinctes sur le même écran, parce qu'elles ne servent à rien
 * l'une sans l'autre : une catégorie donne une teinte, une règle dit quel
 * créneau importé la reçoit. Les créneaux saisis à la main, eux, portent la
 * leur directement — la règle ne les concerne pas.
 *
 * Rien n'est deviné : la première règle dont le mot-clé commence un mot du
 * titre gagne, et on peut donc toujours dire pourquoi un bloc a telle couleur.
 */

function ChoixCouleur({
  valeur,
  surChoix,
}: {
  valeur: string;
  surChoix: (couleur: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={etiquette}>Teinte</span>
      <input type="hidden" name="couleur" value={valeur} />
      <div className="flex flex-wrap gap-2">
        {PALETTE_CRENEAUX.map((teinte) => (
          <button
            key={teinte}
            type="button"
            onClick={() => surChoix(teinte)}
            aria-label={`Teinte ${teinte}`}
            aria-pressed={valeur === teinte}
            className="size-9 rounded-full border-2 transition-colors duration-200"
            style={{
              backgroundColor: teinte,
              borderColor:
                valeur === teinte ? "var(--color-texte)" : "var(--color-bordure)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Le rond de couleur, à la taille où on le reconnaît dans une liste. */
function Pastille({ couleur }: { couleur: string }) {
  return (
    <span
      aria-hidden
      className="size-3 shrink-0 rounded-full"
      style={{ backgroundColor: couleur }}
    />
  );
}

function EditeurCategorie({
  categorie,
  cles,
  regles,
  premier,
  dernier,
}: {
  categorie: CategorieAffichee;
  /** L'ordre courant, pour savoir où la déplacer. */
  cles: string[];
  /** Combien de règles y envoient : ce qu'on veut savoir avant de la supprimer. */
  regles: number;
  premier: boolean;
  dernier: boolean;
}) {
  const [etat, action] = useActionState<Retour, FormData>(
    actionModifierCategorie.bind(null, categorie.cle),
    {},
  );
  const [couleur, setCouleur] = useState(categorie.couleur);
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();

  return (
    <Depliant
      titre={categorie.nom}
      detail={
        regles === 0
          ? "aucun mot-clé"
          : `${regles} mot${regles > 1 ? "s" : ""}-clé${regles > 1 ? "s" : ""}`
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <Pastille couleur={couleur} />
        <span className="text-[12px] text-tres-doux tabular-nums">{couleur}</span>
      </div>

      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Nom</span>
          <input
            name="nom"
            defaultValue={categorie.nom}
            required
            maxLength={40}
            className={champ}
          />
        </label>

        <ChoixCouleur valeur={couleur} surChoix={setCouleur} />

        <Envoyer />
        <Retourner etat={etat} />
      </form>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={premier || enAttente}
          onClick={() =>
            demarrer(async () =>
              setRetour(await actionDeplacerCategorie(cles, categorie.cle, -1)),
            )
          }
          className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux disabled:opacity-30"
        >
          Monter
        </button>
        <button
          type="button"
          disabled={dernier || enAttente}
          onClick={() =>
            demarrer(async () =>
              setRetour(await actionDeplacerCategorie(cles, categorie.cle, 1)),
            )
          }
          className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux disabled:opacity-30"
        >
          Descendre
        </button>
      </div>

      <Retourner etat={retour} />

      {categorie.cle === "autre" ? (
        <p className="mt-3 border-t border-bordure pt-3 text-[12.5px] leading-relaxed text-tres-doux">
          « Autre » ne se supprime pas : c&apos;est là que retombent les créneaux
          dont la catégorie disparaît.
        </p>
      ) : (
        <SuppressionCategorie cle={categorie.cle} />
      )}
    </Depliant>
  );
}

/**
 * Suppression d'une catégorie.
 *
 * Deux temps, avec les nombres réels — mais une suppression ici ne détruit
 * rien : les créneaux concernés retombent dans « Autre ». C'est du temps
 * occupé, pas une étiquette, et il n'y a aucune raison de le perdre parce
 * qu'on renonce à une couleur.
 */
function SuppressionCategorie({ cle }: { cle: string }) {
  const [perte, setPerte] = useState<PerteCategorie | null>(null);
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-bordure pt-3">
      {perte === null ? (
        <button
          type="button"
          disabled={enAttente}
          onClick={() =>
            demarrer(async () => {
              const reponse = await actionPerteCategorie(cle);
              if (reponse.perte) setPerte(reponse.perte);
              else setRetour({ erreur: reponse.erreur });
            })
          }
          className="min-h-11 self-start text-left text-[12.5px] text-tres-doux transition-colors duration-300 active:text-doux disabled:opacity-40"
        >
          {enAttente ? "…" : "Supprimer cette catégorie"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-bordure-vive p-3">
          <p className="text-[12.5px] leading-relaxed text-doux">
            « {perte.nom} » disparaît de la liste des teintes.
          </p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[12.5px]">
            <dt className="text-tres-doux">Créneaux récurrents</dt>
            <dd className="text-right text-doux tabular-nums">{perte.recurrents}</dd>
            <dt className="text-tres-doux">Événements ponctuels</dt>
            <dd className="text-right text-doux tabular-nums">{perte.evenements}</dd>
          </dl>
          <p className="text-[12.5px] leading-relaxed text-tres-doux">
            Aucun créneau n&apos;est effacé : ceux-là passent dans « Autre » et
            gardent leur horaire. Les mots-clés qui y renvoyaient partent avec elle.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPerte(null)}
              className="min-h-12 flex-1 rounded-xl border border-bordure text-[13.5px] text-doux"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={enAttente}
              onClick={() =>
                demarrer(async () => {
                  setRetour(await actionSupprimerCategorie(cle));
                  setPerte(null);
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

function AjoutCategorie() {
  const [etat, action] = useActionState<Retour, FormData>(actionCreerCategorie, {});
  const [couleur, setCouleur] = useState<string>(PALETTE_CRENEAUX[0]);

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-bordure px-5 py-4">
      <span className={etiquette}>Nouvelle catégorie</span>
      <form action={action} className="flex flex-col gap-3">
        <input
          name="nom"
          placeholder="Nom de la catégorie"
          required
          maxLength={40}
          className={champ}
        />
        <ChoixCouleur valeur={couleur} surChoix={setCouleur} />
        <Envoyer libelle="Ajouter" />
        <Retourner etat={etat} />
      </form>
    </div>
  );
}

/* ────────────────────── Règles de classement ────────────────────── */

function ChoixCategorie({
  liste,
  defaut,
}: {
  liste: CategorieAffichee[];
  defaut: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={etiquette}>Catégorie</span>
      <select name="categorie" defaultValue={defaut} className={champ}>
        {liste.map((categorie) => (
          <option key={categorie.cle} value={categorie.cle}>
            {categorie.nom}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditeurRegle({
  regle,
  liste,
  ids,
  premier,
  dernier,
}: {
  regle: RegleAffichee;
  liste: CategorieAffichee[];
  ids: number[];
  premier: boolean;
  dernier: boolean;
}) {
  const [etat, action] = useActionState<Retour, FormData>(
    actionModifierRegle.bind(null, regle.id),
    {},
  );
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();

  const cible = liste.find((c) => c.cle === regle.categorie);

  return (
    <Depliant titre={`« ${regle.motif} »`} detail={cible?.nom ?? regle.categorie}>
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Mot à chercher dans le titre</span>
          <input
            name="motif"
            defaultValue={regle.motif}
            required
            maxLength={60}
            className={champ}
          />
        </label>

        <ChoixCategorie liste={liste} defaut={regle.categorie} />

        <Envoyer />
        <Retourner etat={etat} />
      </form>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={premier || enAttente}
          onClick={() =>
            demarrer(async () => setRetour(await actionDeplacerRegle(ids, regle.id, -1)))
          }
          className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux disabled:opacity-30"
        >
          Monter
        </button>
        <button
          type="button"
          disabled={dernier || enAttente}
          onClick={() =>
            demarrer(async () => setRetour(await actionDeplacerRegle(ids, regle.id, 1)))
          }
          className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux disabled:opacity-30"
        >
          Descendre
        </button>
      </div>

      <div className="mt-3 border-t border-bordure pt-3">
        <button
          type="button"
          disabled={enAttente}
          onClick={() =>
            demarrer(async () => setRetour(await actionSupprimerRegle(regle.id)))
          }
          className="min-h-11 self-start text-left text-[12.5px] text-tres-doux transition-colors duration-300 active:text-doux disabled:opacity-40"
        >
          {enAttente ? "…" : "Retirer ce mot-clé"}
        </button>
      </div>

      <Retourner etat={retour} />
    </Depliant>
  );
}

function AjoutRegle({ liste }: { liste: CategorieAffichee[] }) {
  const [etat, action] = useActionState<Retour, FormData>(actionCreerRegle, {});

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-bordure px-5 py-4">
      <span className={etiquette}>Nouveau mot-clé</span>
      <form action={action} className="flex flex-col gap-3">
        <input
          name="motif"
          placeholder="ex. anglais, stage, piscine"
          required
          maxLength={60}
          className={champ}
        />
        <ChoixCategorie liste={liste} defaut={liste[0]?.cle ?? "autre"} />
        <Envoyer libelle="Ajouter" />
        <Retourner etat={etat} />
      </form>
    </div>
  );
}

/**
 * Essai d'un titre contre les règles.
 *
 * `classer` est la même fonction que celle qui écrit la catégorie en base : ce
 * qui est montré ici est donc ce qui se produirait, et non une approximation.
 * Le calcul est local — rien n'est envoyé, rien n'est enregistré.
 */
function Essai({
  liste,
  regles,
}: {
  liste: CategorieAffichee[];
  regles: RegleAffichee[];
}) {
  const [titre, setTitre] = useState("");

  const plie = replier(titre);
  const gagnante =
    plie.length === 0
      ? null
      : [...regles]
          .sort((a, b) => a.ordre - b.ordre || a.id - b.id)
          .find((r) => classer(titre, [r], "") === r.categorie) ?? null;
  const cle = plie.length === 0 ? null : classer(titre, regles);
  const categorie = cle === null ? null : liste.find((c) => c.cle === cle);

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-bordure bg-surface px-5 py-4">
      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Essayer un titre</span>
        <input
          value={titre}
          onChange={(evenement) => setTitre(evenement.target.value)}
          placeholder="Colle un titre de ton calendrier"
          maxLength={120}
          className={champ}
        />
      </label>

      {plie.length === 0 ? (
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          Rien n&apos;est envoyé et rien n&apos;est enregistré : le calcul est le
          même que celui qui classe pour de vrai.
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] leading-relaxed text-doux">
          <Pastille couleur={categorie?.couleur ?? "#8a8f98"} />
          <span className="text-texte">{categorie?.nom ?? cle}</span>
          <span className="text-tres-doux">
            {gagnante
              ? `— par le mot-clé « ${gagnante.motif} »`
              : "— aucun mot-clé ne correspond"}
          </span>
        </p>
      )}
    </div>
  );
}

/* ────────────────────── L'écran ────────────────────── */

export function Categories({
  liste,
  regles,
  tableAbsente,
  adresseInstallation,
}: {
  liste: CategorieAffichee[];
  regles: RegleAffichee[];
  /** La migration n'a pas encore été appliquée : rien n'est modifiable. */
  tableAbsente: boolean;
  adresseInstallation: string;
}) {
  if (tableAbsente) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-bordure-vive p-4">
        <p className="text-[13.5px] leading-relaxed text-doux">
          La base n&apos;est pas encore à jour : la table des catégories
          n&apos;existe pas. Les teintes ci-dessous sont celles qui seront
          installées, mais elles ne peuvent être ni renommées, ni recolorées tant
          que la migration n&apos;a pas tourné.
        </p>
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          Ouvre cette adresse une fois, dans un onglet, puis reviens ici. Rien
          n&apos;est réécrit : tes créneaux et ton historique restent en place.
        </p>
        <p className="rounded-xl border border-bordure bg-surface px-4 py-3 text-[12.5px] break-all text-tres-doux">
          {adresseInstallation}
        </p>
        <ul className="mt-1 flex flex-wrap gap-2">
          {liste.map((categorie) => (
            <li
              key={categorie.cle}
              className="flex items-center gap-1.5 rounded-full border border-bordure px-3 py-1 text-[12.5px] text-doux"
            >
              <Pastille couleur={categorie.couleur} />
              {categorie.nom}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const cles = liste.map((c) => c.cle);
  const ids = regles.map((r) => r.id);

  const reglesParCategorie: Record<string, number> = {};
  for (const regle of regles) {
    reglesParCategorie[regle.categorie] = (reglesParCategorie[regle.categorie] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-9">
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Teintes</h2>
        <p className="-mt-1 text-[12px] leading-relaxed text-tres-doux">
          L&apos;ordre est celui des listes de choix. Il ne change rien à
          l&apos;affichage de la semaine. L&apos;aperçu ci-dessous est le rendu
          exact d&apos;un bloc : les teintes sombres sont posées plus franchement
          que les claires, sinon elles disparaîtraient sur le fond noir.
        </p>

        {/* L'aperçu d'abord : c'est la question qu'on se pose en arrivant. */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-bordure bg-surface px-4 py-3.5">
          {liste.map((categorie) => (
            <span
              key={categorie.cle}
              className="flex min-w-0 items-center gap-1.5 rounded-md py-1 pr-2.5 pl-2 text-[12.5px] text-texte"
              style={{
                backgroundColor: fondCategorie(categorie.couleur),
                borderLeft: `3px solid ${categorie.couleur}`,
              }}
            >
              <span className="truncate">{categorie.nom}</span>
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {liste.map((categorie, rang) => (
            <EditeurCategorie
              key={categorie.cle}
              categorie={categorie}
              cles={cles}
              regles={reglesParCategorie[categorie.cle] ?? 0}
              premier={rang === 0}
              dernier={rang === liste.length - 1}
            />
          ))}
          <AjoutCategorie />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Mots-clés
        </h2>
        <p className="-mt-1 text-[12px] leading-relaxed text-tres-doux">
          Pour les créneaux venus d&apos;un calendrier extérieur, dont le titre est
          la seule information disponible. Un mot-clé correspond quand il commence
          un mot du titre — « révision » attrape « Révisions », « td » n&apos;attrape
          pas « étude ». Le premier de la liste qui correspond l&apos;emporte : mets
          les plus précis en haut. La casse et les accents ne comptent pas. Ce qui
          ne correspond à rien va dans « Autre ».
        </p>

        <Essai liste={liste} regles={regles} />

        {regles.length === 0 && (
          <p className="rounded-2xl border border-bordure/60 px-5 py-5 text-center text-[13.5px] text-doux">
            Aucun mot-clé. Tous les créneaux importés vont dans « Autre ».
          </p>
        )}

        <div className="flex flex-col gap-2">
          {regles.map((regle, rang) => (
            <EditeurRegle
              key={regle.id}
              regle={regle}
              liste={liste}
              ids={ids}
              premier={rang === 0}
              dernier={rang === regles.length - 1}
            />
          ))}
          <AjoutRegle liste={liste} />
        </div>

        <p className="text-[12px] leading-relaxed text-tres-doux">
          Chaque changement de mot-clé relit les calendriers abonnés et reclasse
          leurs créneaux tout de suite : il n&apos;y a pas de bouton à retrouver
          après.
        </p>
      </section>
    </div>
  );
}
