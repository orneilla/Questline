"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  calculerSeries,
  calculerSeuils,
  construireGrille,
  formaterJour,
  JOURS_COURTS,
  resumer,
  SEMAINES,
  type Case,
  type JourRevision,
} from "@/lib/cartes/calendrier";
import { decalerJours } from "@/lib/dates";

/**
 * Le calendrier de révision.
 *
 * Une case par jour, les semaines en colonnes, douze mois glissants. Tout est
 * calculé dans le navigateur à partir de la liste des jours travaillés :
 * changer d'année ne demande rien au serveur.
 *
 * Le dégradé va d'un vert presque éteint à un vert franchement lumineux. C'est
 * voulu : une palette sourde rendrait la grille illisible, et le point de cet
 * affichage est justement que les grosses journées se voient de loin.
 */

const VERTS = ["#1d3b28", "#2a6b41", "#37a259", "#48d477", "#84ffae"];

/** Un jour sans révision : présent, mais à peine — jamais un trou noir. */
const VIDE = "#15181d";

/** Taille d'une case et de son écart, en pixels. */
const CASE = 11;
const ECART = 3;

function Statistique({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[15px] text-texte tabular-nums">{valeur}</span>
      <span className="text-[11px] leading-tight text-tres-doux">
        {libelle}
      </span>
    </div>
  );
}

/**
 * Les mots changent selon ce qui est compté ; la grille, les paliers et les
 * calculs ne changent pas. C'est le même composant sur l'écran Cartes et sur
 * l'écran Coran, et c'est voulu : la même forme se relit sans réapprendre.
 */
export type LibellesCalendrier = {
  /** Singulier et pluriel écrits en entier : « verset lu » / « versets lus ». */
  unite: string;
  unites: string;
  /** « cartes par jour » / « versets par jour ». */
  parJour: string;
};

const LIBELLES_DEFAUT: LibellesCalendrier = {
  unite: "révision",
  unites: "révisions",
  parJour: "cartes par jour",
};

export function Heatmap({
  jours,
  aujourdhui,
  libelles = LIBELLES_DEFAUT,
}: {
  jours: JourRevision[];
  aujourdhui: string;
  libelles?: LibellesCalendrier;
}) {
  const [recul, setRecul] = useState(0);
  const [choisie, setChoisie] = useState<Case | null>(null);
  const defilement = useRef<HTMLDivElement>(null);

  const parJour = useMemo(
    () => new Map(jours.map((j) => [j.date, j.combien])),
    [jours],
  );

  // Les paliers sont calculés sur tout l'historique, pas sur la fenêtre
  // affichée : l'échelle ne doit pas changer de sens quand on remonte d'un an.
  const seuils = useMemo(
    () => calculerSeuils(jours.map((j) => j.combien)),
    [jours],
  );

  const fin = useMemo(
    () => (recul === 0 ? aujourdhui : decalerJours(aujourdhui, -365 * recul)),
    [aujourdhui, recul],
  );

  const grille = useMemo(
    () => construireGrille(parJour, fin, seuils),
    [parJour, fin, seuils],
  );
  const resume = useMemo(
    () => resumer(grille, jours[0]?.date),
    [grille, jours],
  );
  const series = useMemo(
    () => calculerSeries(jours, aujourdhui),
    [jours, aujourdhui],
  );

  // La grille est plus large qu'un téléphone : on l'ouvre sur le présent.
  useEffect(() => {
    const zone = defilement.current;
    if (zone) zone.scrollLeft = zone.scrollWidth;
  }, [grille]);

  const debut = grille.colonnes[0][0].date;
  const anneeFin = fin.slice(0, 4);
  const anneeDebut = debut.slice(0, 4);
  const libelleFenetre =
    anneeDebut === anneeFin ? anneeFin : `${anneeDebut} – ${anneeFin}`;

  const partEtudiee =
    resume.joursEcoules === 0
      ? 0
      : Math.round((100 * resume.joursEtudies) / resume.joursEcoules);

  const largeur = SEMAINES * (CASE + ECART);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Calendrier
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRecul((r) => r + 1)}
            aria-label="Douze mois plus tôt"
            className="flex size-9 items-center justify-center rounded-lg text-tres-doux transition-colors duration-200 active:text-texte"
          >
            ‹
          </button>
          <span className="min-w-[5.5rem] text-center text-[12px] text-doux tabular-nums">
            {libelleFenetre}
          </span>
          <button
            type="button"
            disabled={recul === 0}
            onClick={() => setRecul((r) => Math.max(0, r - 1))}
            aria-label="Douze mois plus tard"
            className="flex size-9 items-center justify-center rounded-lg text-tres-doux transition-colors duration-200 active:text-texte disabled:opacity-25"
          >
            ›
          </button>
        </div>
      </div>

      <p className="text-[13px] text-doux tabular-nums">
        {resume.total.toLocaleString("fr-FR")}{" "}
        {resume.total > 1 ? libelles.unites : libelles.unite} sur douze mois
      </p>

      <div className="flex gap-1.5">
        {/* Les initiales restent hors du défilement : elles doivent tenir en
            place quand la grille glisse sous elles. */}
        <div
          className="flex shrink-0 flex-col pt-[1.125rem]"
          style={{ gap: ECART }}
        >
          {JOURS_COURTS.map((initiale, rang) => (
            <span
              key={rang}
              aria-hidden
              className="text-[9px] leading-none text-tres-doux"
              style={{ height: CASE, lineHeight: `${CASE}px` }}
            >
              {/* Une initiale sur deux : sept lettres empilées seraient illisibles. */}
              {rang % 2 === 0 ? initiale : ""}
            </span>
          ))}
        </div>

        <div ref={defilement} className="overflow-x-auto pb-1">
          <div style={{ width: largeur }} className="flex flex-col gap-1">
            <div className="relative h-3.5">
              {grille.mois.map((mois) => (
                <span
                  key={`${mois.colonne}-${mois.libelle}`}
                  className="absolute top-0 text-[10px] text-tres-doux"
                  style={{ left: mois.colonne * (CASE + ECART) }}
                >
                  {mois.libelle}
                </span>
              ))}
            </div>

            <div className="flex" style={{ gap: ECART }}>
              {grille.colonnes.map((semaine) => (
                <div
                  key={semaine[0].date}
                  className="flex flex-col"
                  style={{ gap: ECART }}
                >
                  {semaine.map((jour) => (
                    <button
                      key={jour.date}
                      type="button"
                      disabled={!jour.passe}
                      onClick={() => setChoisie(jour)}
                      aria-label={`${formaterJour(jour.date)} — ${jour.combien} ${libelles.unites}`}
                      className="rounded-[2.5px] transition-transform duration-150"
                      style={{
                        width: CASE,
                        height: CASE,
                        backgroundColor: !jour.passe
                          ? "transparent"
                          : jour.niveau === 0
                            ? VIDE
                            : VERTS[jour.niveau - 1],
                        outline:
                          choisie?.date === jour.date
                            ? "1.5px solid var(--color-texte)"
                            : undefined,
                        outlineOffset: 1,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p aria-live="polite" className="min-h-5 text-[12.5px] text-doux">
          {choisie
            ? choisie.combien === 0
              ? `${formaterJour(choisie.date)} — rien ce jour-là`
              : `${formaterJour(choisie.date)} — ${choisie.combien} ${choisie.combien > 1 ? libelles.unites : libelles.unite}`
            : ""}
        </p>

        <div className="flex items-center gap-1.5 text-[10.5px] text-tres-doux">
          moins
          <span
            aria-hidden
            className="size-2.5 rounded-[2.5px]"
            style={{ backgroundColor: VIDE }}
          />
          {VERTS.map((vert) => (
            <span
              key={vert}
              aria-hidden
              className="size-2.5 rounded-[2.5px]"
              style={{ backgroundColor: vert }}
            />
          ))}
          plus
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-bordure pt-3 sm:grid-cols-4">
        <Statistique
          valeur={resume.moyenne.toFixed(1).replace(".", ",")}
          libelle={libelles.parJour}
        />
        <Statistique
          valeur={`${partEtudiee} %`}
          libelle={`jours étudiés (${resume.joursEtudies} sur ${resume.joursEcoules})`}
        />
        <Statistique
          valeur={`${series.meilleure} j`}
          libelle="plus longue série"
        />
        <Statistique valeur={`${series.enCours} j`} libelle="série en cours" />
      </div>

      <p className="sr-only">
        Les jours de la semaine, de haut en bas : {JOURS_COURTS.join(", ")}.
      </p>
    </section>
  );
}
