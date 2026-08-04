"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { annulerCreneau, retablirCreneau } from "@/app/(app)/semaine/actions";
import { COULEURS_CRENEAUX, JOURS_SEMAINE } from "@/lib/constantes";
import type { Bloc } from "@/lib/creneaux";
import { minutesLocales } from "@/lib/dates";
import type { JourSemaine } from "@/lib/semaine";
import { formaterDuree } from "@/lib/temps";

/**
 * L'emploi du temps de la semaine, en vraie grille horaire.
 *
 * La version précédente tenait dans une colonne de téléphone : vingt-sept
 * pixels par heure, du texte de huit points et demi. Elle disait ce qu'il y
 * avait, on ne pouvait pas le lire. Celle-ci suit les conventions d'un agenda —
 * les heures en colonne à gauche, les jours en colonnes, chaque bloc positionné
 * et dimensionné à sa durée réelle.
 *
 * ── Ce qui tient à l'écran
 *
 * En paysage, les sept jours tiennent d'un coup. En portrait, trois jours à la
 * fois et le reste par défilement horizontal : entasser sept colonnes dans une
 * largeur de portrait redonnerait exactement le problème qu'on corrige. La
 * bascule est portée par une requête de média sur l'orientation, pas par du
 * JavaScript qui écouterait le redimensionnement.
 *
 * La grille couvre les vingt-quatre heures et non la seule fenêtre d'éveil : un
 * service qui finit à une heure du matin doit se voir. Elle s'ouvre sur l'heure
 * courante — un agenda qui s'ouvre à minuit demande de faire défiler avant de
 * rien voir.
 *
 * ── Les contraintes et les choix
 *
 * Un récurrent revient qu'on le veuille ou non : service, cours, prière. Un
 * ponctuel est posé sur une date, c'est un choix. Les deux ne se lisent pas
 * pareil — le récurrent porte une trame, le ponctuel une teinte unie. C'est la
 * distinction qui compte quand on cherche où placer quelque chose : ce qui est
 * négociable saute aux yeux.
 *
 * Les couleurs sont celles des piliers : `cours` reprend la teinte de Savoir,
 * `travail` celle d'Œuvre, `priere` celle de Deen. Rien n'est inventé ici.
 */

/** Hauteur d'une heure, en pixels. Assez pour qu'un bloc d'une heure se lise. */
const PAS = 62;

const MINUTES_JOUR = 24 * 60;
const HAUTEUR = (MINUTES_JOUR / 60) * PAS;

/** Largeur de la colonne des heures. */
const COLONNE_HEURES = 46;

function hauteurDe(minutes: number): number {
  return (minutes / 60) * PAS;
}

/**
 * Un bloc, ramené à un seul jour.
 *
 * Un service de nuit finit après minuit : sa `plage.fin` dépasse alors 1440. Il
 * est rendu sur son jour jusqu'à minuit et le reste sur le lendemain, comme le
 * ferait n'importe quel agenda — plutôt que d'être tronqué.
 */
type Morceau = {
  bloc: Bloc;
  debut: number;
  fin: number;
  /** Vrai pour la partie qui déborde sur le jour suivant. */
  suite: boolean;
  /** Récurrent écarté par un ponctuel : affiché en filigrane, à côté. */
  annule: boolean;
};

function decouper(bloc: Bloc, annule: boolean): { decalage: 0 | 1; morceau: Morceau }[] {
  const sortie: { decalage: 0 | 1; morceau: Morceau }[] = [];
  const debut = Math.max(0, bloc.plage.debut);
  const fin = bloc.plage.fin;

  sortie.push({
    decalage: 0,
    morceau: { bloc, debut, fin: Math.min(fin, MINUTES_JOUR), suite: false, annule },
  });

  if (fin > MINUTES_JOUR) {
    sortie.push({
      decalage: 1,
      morceau: {
        bloc,
        debut: 0,
        fin: Math.min(fin - MINUTES_JOUR, MINUTES_JOUR),
        suite: true,
        annule,
      },
    });
  }

  return sortie;
}

/**
 * Les morceaux à dessiner sur chaque jour, débordements de la veille compris.
 *
 * Réels et annulés sont mêlés dès ici : ils partagent le même espace et doivent
 * partager le même calcul de colonnes.
 */
function repartir(jours: JourSemaine[]): Morceau[][] {
  const parJour: Morceau[][] = jours.map(() => []);

  jours.forEach((jour, index) => {
    const sources: [Bloc[], boolean][] = [
      [jour.blocs, false],
      [jour.annules, true],
    ];
    for (const [blocs, annule] of sources) {
      for (const bloc of blocs) {
        for (const { decalage, morceau } of decouper(bloc, annule)) {
          const cible = index + decalage;
          if (cible < parJour.length) parJour[cible].push(morceau);
        }
      }
    }
  });

  // Les annulés passent après à durée égale : le bloc qui a réellement lieu
  // occupe la colonne de gauche.
  return parJour.map((liste) =>
    liste.sort((a, b) => a.debut - b.debut || Number(a.annule) - Number(b.annule)),
  );
}

/**
 * Range côte à côte les morceaux qui se chevauchent.
 *
 * Sans cela, deux blocs simultanés se cachent l'un l'autre. Le calcul est celui
 * d'un agenda : on regroupe ce qui se recouvre, puis on partage la largeur du
 * groupe entre ses colonnes.
 */
type Place = { morceau: Morceau; colonne: number; colonnes: number };

/**
 * Les annulés entrent dans le même calcul que les réels — c'est indispensable :
 * un récurrent est justement annulé par le ponctuel qui le recouvre, donc les
 * deux se chevauchent toujours. Les placer séparément les ferait se superposer
 * au lieu de se ranger l'un à côté de l'autre.
 */
function placer(liste: Morceau[]): Place[] {
  const places: Place[] = [];
  let groupe: Morceau[] = [];
  let finGroupe = -1;

  const vider = () => {
    if (groupe.length === 0) return;
    const finsParColonne: number[] = [];
    const attribue = groupe.map((m) => {
      let c = finsParColonne.findIndex((fin) => fin <= m.debut);
      if (c < 0) {
        c = finsParColonne.length;
        finsParColonne.push(m.fin);
      } else finsParColonne[c] = m.fin;
      return { morceau: m, colonne: c };
    });
    for (const a of attribue) places.push({ ...a, colonnes: finsParColonne.length });
    groupe = [];
    finGroupe = -1;
  };

  for (const morceau of liste) {
    if (groupe.length > 0 && morceau.debut >= finGroupe) vider();
    groupe.push(morceau);
    finGroupe = Math.max(finGroupe, morceau.fin);
  }
  vider();

  return places;
}

type Choix = { morceau: Morceau; date: string };

export function GrilleSemaine({ jours }: { jours: JourSemaine[] }) {
  const defilement = useRef<HTMLDivElement>(null);
  const [maintenant, setMaintenant] = useState<number | null>(null);
  const [choisi, setChoisi] = useState<Choix | null>(null);

  const parJour = repartir(jours);
  const heures = Array.from({ length: 24 }, (_, i) => i);
  const indexAujourdhui = jours.findIndex((j) => j.aujourdhui);

  // L'heure courante ne se lit qu'une fois montée : le serveur et le navigateur
  // ne la liraient pas au même instant, et l'écart ferait sauter la ligne au
  // premier rendu.
  useEffect(() => {
    const relire = () => setMaintenant(minutesLocales());
    relire();
    const battement = setInterval(relire, 60_000);
    return () => clearInterval(battement);
  }, []);

  useEffect(() => {
    const zone = defilement.current;
    if (!zone) return;
    zone.scrollTop = Math.max(0, hauteurDe(minutesLocales()) - zone.clientHeight / 3);
  }, []);

  return (
    <section aria-label="Emploi du temps de la semaine" className="flex flex-col gap-2">
      <div className="flex" style={{ paddingLeft: COLONNE_HEURES }}>
        <div className="grille-jours flex-1">
          {jours.map((jour) => (
            <div
              key={jour.date}
              className="flex flex-col items-center gap-0.5 rounded-t-lg py-1.5"
              style={{
                backgroundColor: jour.aujourdhui ? "var(--color-voile)" : "transparent",
              }}
            >
              <span
                className={`text-[12px] tracking-[0.1em] uppercase ${
                  jour.aujourdhui ? "text-texte" : "text-tres-doux"
                }`}
              >
                {JOURS_SEMAINE[jour.jourSemaine].slice(0, 3)}
              </span>
              <span
                className={`text-[17px] leading-none tabular-nums ${
                  jour.aujourdhui ? "text-texte" : "text-doux"
                }`}
              >
                {Number(jour.date.slice(8, 10))}
              </span>
              <span className="text-[10.5px] text-tres-doux tabular-nums">
                {formaterDuree(jour.charge.tempsDispoMin)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={defilement}
        className="relative overflow-auto overscroll-contain rounded-xl border border-bordure"
        style={{ maxHeight: "min(64dvh, 680px)" }}
      >
        <div className="flex" style={{ height: HAUTEUR }}>
          <div
            className="sticky left-0 z-20 shrink-0 border-r border-bordure bg-fond"
            style={{ width: COLONNE_HEURES }}
          >
            {heures.map((heure) => (
              <span
                key={heure}
                className="absolute -translate-y-1/2 pr-2 text-right text-[11.5px] text-tres-doux tabular-nums"
                style={{ top: hauteurDe(heure * 60), width: COLONNE_HEURES }}
              >
                {heure === 0 ? "" : `${String(heure).padStart(2, "0")} h`}
              </span>
            ))}
          </div>

          <div className="grille-jours relative flex-1">
            {heures.map((heure) => (
              <span
                key={heure}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 h-px"
                style={{
                  top: hauteurDe(heure * 60),
                  backgroundColor:
                    heure % 6 === 0
                      ? "var(--color-bordure-vive)"
                      : "var(--color-bordure)",
                  opacity: heure % 6 === 0 ? 0.9 : 0.5,
                }}
              />
            ))}

            {jours.map((jour, index) => (
              <div
                key={jour.date}
                className="relative border-r border-bordure/50 last:border-r-0"
                style={{
                  backgroundColor: jour.aujourdhui ? "var(--color-voile)" : "transparent",
                }}
              >
                {placer(parJour[index]).map(({ morceau, colonne, colonnes }) => (
                  <BlocGrille
                    key={`${morceau.annule ? "a" : "b"}-${morceau.bloc.cle}-${morceau.suite ? 1 : 0}`}
                    morceau={morceau}
                    colonne={colonne}
                    colonnes={colonnes}
                    surAppui={() => setChoisi({ morceau, date: jour.date })}
                  />
                ))}

                {maintenant !== null && index === indexAujourdhui && (
                  <span
                    aria-label="Heure actuelle"
                    className="pointer-events-none absolute inset-x-0 z-10 h-[1.5px] bg-[#c0996a]"
                    style={{ top: hauteurDe(maintenant) }}
                  >
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-0 size-2 -translate-y-1/2 rounded-full bg-[#c0996a]"
                    />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="px-1 text-[11.5px] leading-relaxed text-tres-doux">
        Les blocs à trame reviennent chaque semaine : ce sont des contraintes. Les
        blocs unis sont posés sur une date. Sous chaque jour, le temps disponible une
        fois les créneaux et les deux heures incompressibles retirés.
      </p>

      {choisi && (
        <FeuilleBloc
          morceau={choisi.morceau}
          date={choisi.date}
          surFermeture={() => setChoisi(null)}
        />
      )}

      <style>{`
        .grille-jours {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: max(112px, calc((100vw - ${COLONNE_HEURES}px - 2.5rem) / 3));
        }
        @media (min-width: 1024px) and (orientation: landscape) {
          .grille-jours { grid-auto-columns: minmax(0, 1fr); }
        }
      `}</style>
    </section>
  );
}

/* ───────────────────────────── Un bloc ───────────────────────────── */

function BlocGrille({
  morceau,
  colonne,
  colonnes,
  surAppui,
}: {
  morceau: Morceau;
  colonne: number;
  colonnes: number;
  surAppui: () => void;
}) {
  const { bloc, annule } = morceau;
  const couleur = COULEURS_CRENEAUX[bloc.type] ?? COULEURS_CRENEAUX.autre;
  const contrainte = bloc.source === "recurrent";
  const hauteur = Math.max(hauteurDe(morceau.fin - morceau.debut), 22);

  return (
    <button
      type="button"
      onClick={surAppui}
      className="absolute overflow-hidden rounded-md px-1.5 py-1 text-left"
      style={{
        top: hauteurDe(morceau.debut),
        height: hauteur,
        left: `calc(${(100 * colonne) / colonnes}% + 2px)`,
        width: `calc(${100 / colonnes}% - 4px)`,
        backgroundColor: annule ? "transparent" : `${couleur}26`,
        border: annule ? "1px dashed var(--color-bordure-vive)" : "none",
        borderLeft: annule ? "1px dashed var(--color-bordure-vive)" : `3px solid ${couleur}`,
        // La trame distingue une contrainte d'un choix, sans ajouter de couleur.
        backgroundImage:
          contrainte && !annule
            ? `repeating-linear-gradient(135deg, ${couleur}1f 0 5px, transparent 5px 10px)`
            : undefined,
        opacity: annule ? 0.6 : 1,
      }}
    >
      <span
        className={`block truncate text-[12px] leading-tight ${
          annule ? "text-tres-doux line-through" : "text-texte"
        }`}
      >
        {morceau.suite ? "↳ " : ""}
        {bloc.titre}
      </span>
      {hauteur >= 44 && (
        <span className="block truncate text-[10.5px] leading-tight text-tres-doux tabular-nums">
          {bloc.debut.slice(0, 5)} – {bloc.fin.slice(0, 5)}
        </span>
      )}
    </button>
  );
}

/* ──────────────────────── Le détail d'un bloc ──────────────────────── */

const LIBELLES_TYPE: Record<string, string> = {
  cours: "Cours",
  travail: "Service",
  priere: "Prière",
  autre: "Autre",
};

function FeuilleBloc({
  morceau,
  date,
  surFermeture,
}: {
  morceau: Morceau;
  date: string;
  surFermeture: () => void;
}) {
  const [enAttente, demarrer] = useTransition();
  const { bloc, annule } = morceau;
  const contrainte = bloc.source === "recurrent";

  useEffect(() => {
    const auClavier = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") surFermeture();
    };
    window.addEventListener("keydown", auClavier);
    return () => window.removeEventListener("keydown", auClavier);
  }, [surFermeture]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-fond/85 backdrop-blur-sm"
      onClick={surFermeture}
      role="presentation"
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl border-t border-bordure-vive bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
        onClick={(evenement) => evenement.stopPropagation()}
        role="dialog"
        aria-label="Détail du bloc"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] tracking-[0.14em] text-tres-doux uppercase">
              {LIBELLES_TYPE[bloc.type] ?? bloc.type}
              {contrainte ? " · contrainte" : " · ponctuel"}
              {annule ? " · écarté ce jour-là" : ""}
            </span>
            <h3 className="text-[19px] leading-snug text-texte">{bloc.titre}</h3>
            <span className="text-[13px] text-doux tabular-nums">
              {bloc.debut.slice(0, 5)} – {bloc.fin.slice(0, 5)} ·{" "}
              {formaterDuree(bloc.plage.fin - bloc.plage.debut)}
            </span>
          </div>
          <button
            type="button"
            onClick={surFermeture}
            aria-label="Fermer"
            className="-m-2 flex size-11 shrink-0 items-center justify-center p-2 text-tres-doux active:text-texte"
          >
            <svg viewBox="0 0 24 24" className="size-[17px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
              <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
            </svg>
          </button>
        </div>

        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          {contrainte
            ? "Ce bloc revient chaque semaine. Il peut être écarté pour ce jour-là sans toucher aux autres."
            : "Ce bloc n'existe que sur cette date. Il se déplace et se modifie depuis le formulaire des ponctuels, plus bas sur la page."}
        </p>

        {contrainte && bloc.recurrentId !== undefined && (
          <button
            type="button"
            disabled={enAttente}
            onClick={() =>
              demarrer(async () => {
                if (annule) await retablirCreneau(bloc.recurrentId!, date);
                else await annulerCreneau(bloc.recurrentId!, date);
                surFermeture();
              })
            }
            className="flex min-h-12 items-center justify-center rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte disabled:opacity-40"
          >
            {enAttente ? "…" : annule ? "Le rétablir ce jour-là" : "L'écarter ce jour-là"}
          </button>
        )}
      </div>
    </div>
  );
}
