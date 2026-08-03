"use client";

import { useEffect, useRef, useState } from "react";

import { televerserImage } from "@/app/(app)/cartes/edition-actions";
import { estRtl } from "@/lib/cartes/generation";
import { compresser, formaterPoids, ImageRefusee } from "@/lib/cartes/image";

/**
 * Champ de saisie d'une face de carte.
 *
 * Une barre d'insertion tient les trois gestes qu'on ne veut pas taper à la
 * main sur une tablette : une formule, un trou, une image. Le collage et le
 * glisser-déposer d'images passent par le même chemin que le bouton — coller
 * un export ChemDraw doit marcher sans détour par la galerie.
 */

type Props = {
  etiquette: string;
  valeur: string;
  surChangement: (valeur: string) => void;
  lignes?: number;
  aide?: string;
  /** Propose l'insertion de trous : n'a de sens que sur le recto. */
  avecTrous?: boolean;
  placeholder?: string;
};

const BOUTON =
  "min-h-9 rounded-lg border border-bordure px-2.5 text-[12px] text-doux transition-colors duration-200 active:bg-surface-haut disabled:opacity-40";

/** Prochain numéro de trou libre dans le texte. */
function prochainTrou(texte: string): number {
  const numeros = [...texte.matchAll(/\{\{c(\d+)::/g)].map((t) => Number(t[1]));
  return numeros.length === 0 ? 1 : Math.max(...numeros) + 1;
}

export function ChampRiche({
  etiquette,
  valeur,
  surChangement,
  lignes = 5,
  aide,
  avecTrous = false,
  placeholder,
}: Props) {
  const zone = useRef<HTMLTextAreaElement>(null);
  const selectionEnAttente = useRef<[number, number] | null>(null);
  const [etatImage, setEtatImage] = useState<string | null>(null);
  const [erreurImage, setErreurImage] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);

  // Après une insertion, le curseur doit retomber là où l'on écrira ensuite.
  useEffect(() => {
    const cible = selectionEnAttente.current;
    if (!cible || !zone.current) return;
    selectionEnAttente.current = null;
    zone.current.focus();
    zone.current.setSelectionRange(cible[0], cible[1]);
  }, [valeur]);

  function inserer(avant: string, apres: string, remplissage = ""): void {
    const element = zone.current;
    const debut = element?.selectionStart ?? valeur.length;
    const fin = element?.selectionEnd ?? valeur.length;
    const choisi = valeur.slice(debut, fin) || remplissage;

    const suivant = `${valeur.slice(0, debut)}${avant}${choisi}${apres}${valeur.slice(fin)}`;
    // Sans sélection, on se place à l'intérieur ; avec, on l'englobe.
    const positionDebut = debut + avant.length;
    selectionEnAttente.current = [positionDebut, positionDebut + choisi.length];
    surChangement(suivant);
  }

  async function accepter(fichiers: FileList | File[] | null): Promise<void> {
    const images = [...(fichiers ?? [])].filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    setErreurImage(null);

    for (const fichier of images) {
      try {
        setEtatImage(`Compression de ${fichier.name || "l'image"}…`);
        const compressee = await compresser(fichier);

        setEtatImage(`Envoi — ${formaterPoids(compressee.octets)}…`);
        const retour = await televerserImage({
          nom: fichier.name || "image",
          typeMime: compressee.typeMime,
          base64: compressee.base64,
          largeur: compressee.largeur,
          hauteur: compressee.hauteur,
        });

        if (!retour.url) {
          setErreurImage(retour.erreur ?? "Image non rangée.");
          setEtatImage(null);
          return;
        }

        inserer(`![](${retour.url})`, "");
        setEtatImage(
          `${compressee.nature === "trait" ? "Schéma" : "Photo"} · ${compressee.largeur}×${compressee.hauteur} · ${formaterPoids(compressee.octets)}`,
        );
      } catch (erreur) {
        setErreurImage(
          erreur instanceof ImageRefusee
            ? erreur.message
            : "Cette image n'a pas pu être traitée.",
        );
        setEtatImage(null);
        return;
      }
    }
  }

  const rtl = estRtl(valeur);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] tracking-[0.1em] text-tres-doux uppercase">
          {etiquette}
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          <button
            type="button"
            className={BOUTON}
            onClick={() => inserer("$", "$", "x")}
            title="Formule dans la ligne"
          >
            ƒ formule
          </button>
          <button
            type="button"
            className={BOUTON}
            onClick={() => inserer("$$\n", "\n$$", "")}
            title="Formule en bloc"
          >
            ƒ bloc
          </button>
          {avecTrous && (
            <button
              type="button"
              className={BOUTON}
              onClick={() => inserer(`{{c${prochainTrou(valeur)}::`, "}}", "réponse")}
              title="Masquer un passage"
            >
              trou
            </button>
          )}
          <label className={`${BOUTON} flex cursor-default items-center`}>
            image
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(evenement) => {
                void accepter(evenement.target.files);
                evenement.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <textarea
        ref={zone}
        value={valeur}
        rows={lignes}
        dir={rtl ? "rtl" : "ltr"}
        placeholder={placeholder}
        onChange={(evenement) => surChangement(evenement.target.value)}
        onPaste={(evenement) => {
          const fichiers = [...(evenement.clipboardData?.items ?? [])]
            .filter((item) => item.kind === "file")
            .map((item) => item.getAsFile())
            .filter((f): f is File => f !== null && f.type.startsWith("image/"));
          if (fichiers.length === 0) return;
          // Une image dans le presse-papier remplace le collage de texte.
          evenement.preventDefault();
          void accepter(fichiers);
        }}
        onDragOver={(evenement) => {
          evenement.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(evenement) => {
          evenement.preventDefault();
          setSurvol(false);
          void accepter(evenement.dataTransfer?.files ?? null);
        }}
        className="w-full resize-y rounded-xl border bg-surface px-4 py-3 text-[15px] leading-relaxed text-texte outline-none transition-colors duration-300 placeholder:text-tres-doux focus:border-bordure-vive"
        style={{
          borderColor: survol ? "var(--color-doux)" : "var(--color-bordure)",
          fontFamily: rtl ? '"Noto Naskh Arabic", "Geeza Pro", serif' : undefined,
          fontSize: rtl ? "1.35rem" : undefined,
          lineHeight: rtl ? 1.9 : undefined,
        }}
      />

      {(aide || etatImage || erreurImage) && (
        <p
          className="text-[11.5px] leading-relaxed"
          aria-live="polite"
          style={{
            color: erreurImage ? "var(--color-doux)" : "var(--color-tres-doux)",
          }}
        >
          {erreurImage ?? etatImage ?? aide}
        </p>
      )}
    </div>
  );
}
