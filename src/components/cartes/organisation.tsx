"use client";

import { useActionState, useState, useTransition } from "react";

import {
  ajouterEspace,
  ajouterPaquet,
  definirCouverture,
  effacerEspace,
  effacerPaquet,
  enregistrerPaquet,
  renommerEspace,
  type Retour,
} from "@/app/(app)/cartes/edition-actions";
import type { EspaceListe, PaquetListe } from "@/lib/cartes/edition";
import { compresser, formaterPoids, ImageRefusee } from "@/lib/cartes/image";
import { televerserImage } from "@/app/(app)/cartes/edition-actions";
import {
  BoutonSupprimer,
  Depliant,
  Envoyer,
  Retourner,
  champ,
  etiquette,
} from "@/components/reglages/briques";

/**
 * Organisation des espaces et des paquets.
 *
 * Même grammaire que l'écran Réglages : tout se déplie, tout se modifie, et
 * chaque suppression annonce ce qu'elle emporte avant de le faire.
 */

/** Teintes proposées : les mêmes familles que le reste de l'application. */
const COULEURS = [
  "#7e92b8",
  "#8fa37e",
  "#c2a567",
  "#b58a93",
  "#6fa396",
  "#c0996a",
  "#9a8fb8",
];

function ChoixCouleur({ defaut }: { defaut: string }) {
  const [valeur, setValeur] = useState(defaut);

  return (
    <div className="flex flex-col gap-1.5">
      <span className={etiquette}>Couleur</span>
      <input type="hidden" name="couleur" value={valeur} />
      <div className="flex flex-wrap gap-2">
        {COULEURS.map((couleur) => (
          <button
            key={couleur}
            type="button"
            aria-label={`Couleur ${couleur}`}
            aria-pressed={valeur === couleur}
            onClick={() => setValeur(couleur)}
            className="size-9 rounded-full border transition-transform duration-200"
            style={{
              backgroundColor: couleur,
              borderColor:
                valeur === couleur ? "var(--color-texte)" : "var(--color-bordure)",
              opacity: valeur === couleur ? 1 : 0.55,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Couverture({ paquet }: { paquet: PaquetListe }) {
  const [url, setUrl] = useState(paquet.couverture);
  const [etat, setEtat] = useState<string | null>(null);
  const [enAttente, demarrer] = useTransition();

  async function poser(fichier: File | undefined): Promise<void> {
    if (!fichier) return;
    try {
      setEtat("Compression…");
      const compressee = await compresser(fichier);
      setEtat(`Envoi — ${formaterPoids(compressee.octets)}…`);
      const retour = await televerserImage({
        nom: fichier.name || "couverture",
        typeMime: compressee.typeMime,
        base64: compressee.base64,
        largeur: compressee.largeur,
        hauteur: compressee.hauteur,
      });
      if (!retour.url) {
        setEtat(retour.erreur ?? "Image non rangée.");
        return;
      }
      const adresse = retour.url;
      demarrer(async () => {
        await definirCouverture(paquet.id, adresse);
        setUrl(adresse);
        setEtat(`Posée · ${formaterPoids(compressee.octets)}`);
      });
    } catch (erreur) {
      setEtat(
        erreur instanceof ImageRefusee ? erreur.message : "Image non traitée.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={etiquette}>Couverture</span>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-16 w-24 rounded-lg border border-bordure object-cover"
          />
        ) : (
          <span className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-bordure text-[11px] text-tres-doux">
            aucune
          </span>
        )}

        <div className="flex flex-1 flex-col gap-2">
          <label className="flex min-h-11 cursor-default items-center justify-center rounded-xl border border-bordure text-[13px] text-doux transition-colors duration-300 active:bg-surface-haut">
            {url ? "Remplacer" : "Choisir une image"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(evenement) => {
                void poser(evenement.target.files?.[0]);
                evenement.target.value = "";
              }}
            />
          </label>
          {url && (
            <button
              type="button"
              disabled={enAttente}
              onClick={() =>
                demarrer(async () => {
                  await definirCouverture(paquet.id, null);
                  setUrl(null);
                  setEtat("Couverture retirée.");
                })
              }
              className="min-h-11 rounded-xl border border-bordure text-[13px] text-doux"
            >
              Retirer
            </button>
          )}
        </div>
      </div>
      {etat && (
        <p aria-live="polite" className="text-[11.5px] text-tres-doux">
          {etat}
        </p>
      )}
    </div>
  );
}

function FichePaquet({
  paquet,
  espaces,
  freres,
}: {
  paquet: PaquetListe;
  espaces: EspaceListe[];
  freres: PaquetListe[];
}) {
  const [etat, action] = useActionState<Retour, FormData>(enregistrerPaquet, {});

  return (
    <Depliant
      titre={paquet.nom}
      detail={`${paquet.cartes} carte${paquet.cartes > 1 ? "s" : ""}${paquet.parentId ? " · sous-paquet" : ""}`}
    >
      <div className="flex flex-col gap-4">
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={paquet.id} />

          <label className="flex flex-col gap-1.5">
            <span className={etiquette}>Nom</span>
            <input
              name="nom"
              defaultValue={paquet.nom}
              required
              maxLength={80}
              className={champ}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={etiquette}>Espace</span>
            <select name="espaceId" defaultValue={paquet.espaceId} className={champ}>
              {espaces.map((espace) => (
                <option key={espace.id} value={espace.id}>
                  {espace.nom}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={etiquette}>Rangé sous</span>
            <select
              name="parentId"
              defaultValue={paquet.parentId ?? ""}
              className={champ}
            >
              <option value="">Rien — paquet de premier niveau</option>
              {freres
                .filter((autre) => autre.id !== paquet.id)
                .map((autre) => (
                  <option key={autre.id} value={autre.id}>
                    {autre.nom}
                  </option>
                ))}
            </select>
          </label>

          <Envoyer />
          <Retourner etat={etat} />
        </form>

        <Couverture paquet={paquet} />

        <a
          href={`/cartes/nouveau?paquet=${paquet.id}`}
          className="flex min-h-12 items-center justify-center rounded-xl border border-bordure text-[14px] text-doux transition-colors duration-300 active:bg-surface-haut"
        >
          Écrire une carte ici
        </a>

        <BoutonSupprimer
          action={async () => effacerPaquet(paquet.id)}
          avertissement={
            paquet.cartes > 0
              ? `Ce paquet et ses ${paquet.cartes} cartes disparaissent, avec tout leur historique de révision. Les sous-paquets, eux, remontent d'un cran.`
              : "Ce paquet vide disparaît. Ses sous-paquets remontent d'un cran."
          }
        />
      </div>
    </Depliant>
  );
}

function FicheEspace({
  espace,
  espaces,
}: {
  espace: EspaceListe;
  espaces: EspaceListe[];
}) {
  const [etat, action] = useActionState<Retour, FormData>(renommerEspace, {});
  const [etatAjout, actionAjout] = useActionState<Retour, FormData>(ajouterPaquet, {});

  const cartes = espace.paquets.reduce((total, p) => total + p.cartes, 0);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2.5 text-[13px] tracking-[0.14em] text-doux uppercase">
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ backgroundColor: espace.couleur }}
        />
        {espace.nom}
      </h2>

      {espace.paquets.map((paquet) => (
        <FichePaquet
          key={paquet.id}
          paquet={paquet}
          espaces={espaces}
          freres={espace.paquets}
        />
      ))}

      <Depliant titre="Ajouter un paquet">
        <form action={actionAjout} className="flex flex-col gap-3">
          <input type="hidden" name="espaceId" value={espace.id} />
          <label className="flex flex-col gap-1.5">
            <span className={etiquette}>Nom</span>
            <input name="nom" required maxLength={80} className={champ} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={etiquette}>Rangé sous</span>
            <select name="parentId" defaultValue="" className={champ}>
              <option value="">Rien — paquet de premier niveau</option>
              {espace.paquets.map((autre) => (
                <option key={autre.id} value={autre.id}>
                  {autre.nom}
                </option>
              ))}
            </select>
          </label>
          <Envoyer libelle="Créer" />
          <Retourner etat={etatAjout} />
        </form>
      </Depliant>

      <Depliant titre="Modifier l'espace" detail={`${espace.paquets.length} paquet${espace.paquets.length > 1 ? "s" : ""}`}>
        <div className="flex flex-col gap-4">
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={espace.id} />
            <label className="flex flex-col gap-1.5">
              <span className={etiquette}>Nom</span>
              <input
                name="nom"
                defaultValue={espace.nom}
                required
                maxLength={60}
                className={champ}
              />
            </label>
            <ChoixCouleur defaut={espace.couleur} />
            <Envoyer />
            <Retourner etat={etat} />
          </form>

          <BoutonSupprimer
            action={async () => effacerEspace(espace.id)}
            avertissement={
              cartes > 0
                ? `L'espace, ses ${espace.paquets.length} paquets et leurs ${cartes} cartes disparaissent, historique compris.`
                : "Cet espace disparaît. Il ne contient aucune carte."
            }
          />
        </div>
      </Depliant>
    </section>
  );
}

export function Organisation({ espaces }: { espaces: EspaceListe[] }) {
  const [etat, action] = useActionState<Retour, FormData>(ajouterEspace, {});

  return (
    <div className="flex flex-col gap-9">
      {espaces.map((espace) => (
        <FicheEspace key={espace.id} espace={espace} espaces={espaces} />
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Nouvel espace
        </h2>
        <p className="-mt-1 text-[12px] leading-relaxed text-tres-doux">
          Un espace est un domaine : chimie, arabe, sciences religieuses. Sa couleur
          teinte ses paquets, et son rang décide de l'espèce de ses plantes au jardin.
        </p>
        <div className="rounded-2xl border border-bordure bg-surface px-5 py-4">
          <form action={action} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={etiquette}>Nom</span>
              <input name="nom" required maxLength={60} className={champ} />
            </label>
            <ChoixCouleur defaut={COULEURS[0]} />
            <Envoyer libelle="Créer" />
            <Retourner etat={etat} />
          </form>
        </div>
      </section>
    </div>
  );
}
