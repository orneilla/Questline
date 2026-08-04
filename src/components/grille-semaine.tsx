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

/** Au-dessous, sept colonnes n'ont plus de sens : on montre un jour. */
const LARGEUR_TELEPHONE = 500;

export function GrilleSemaine({ jours }: { jours: JourSemaine[] }) {
  const defilementSemaine = useRef<HTMLDivElement>(null);
  const defilementJour = useRef<HTMLDivElement>(null);
  const [maintenant, setMaintenant] = useState<number | null>(null);
  const [choisi, setChoisi] = useState<Choix | null>(null);

  const indexAujourdhui = jours.findIndex((j) => j.aujourdhui);
  // Le jour courant est celui qu'on veut voir en ouvrant. À défaut — une semaine
  // passée — le premier jour.
  const [jourAffiche, setJourAffiche] = useState(Math.max(0, indexAujourdhui));
  const [modeTelephone, setModeTelephone] = useState<"jour" | "semaine">("jour");

  const parJour = repartir(jours);
  const heures = Array.from({ length: 24 }, (_, i) => i);

  // L'heure courante ne se lit qu'une fois montée : le serveur et le navigateur
  // ne la liraient pas au même instant, et l'écart ferait sauter la ligne au
  // premier rendu.
  useEffect(() => {
    const relire = () => setMaintenant(minutesLocales());
    relire();
    const battement = setInterval(relire, 60_000);
    return () => clearInterval(battement);
  }, []);

  // Les deux vues s'ouvrent sur l'heure courante. Celle qui est cachée par CSS
  // a une hauteur nulle : on lui donne une position de repli plutôt que zéro,
  // sinon elle s'ouvrirait à minuit une fois révélée.
  useEffect(() => {
    const minute = minutesLocales();
    for (const zone of [defilementSemaine.current, defilementJour.current]) {
      if (!zone) continue;
      const visible = zone.clientHeight > 0 ? zone.clientHeight : 420;
      zone.scrollTop = Math.max(0, hauteurDe(minute) - visible / 3);
    }
  }, [modeTelephone]);

  const jour = jours[jourAffiche];

  return (
    <section
      aria-label="Emploi du temps de la semaine"
      className="calendrier flex w-full min-w-0 flex-col gap-2"
      data-mode={modeTelephone}
    >
      {/* ─────────────── Téléphone : le choix du jour ─────────────── */}
      {/*
        Une grille de sept colonnes plutôt qu'une bande défilante : à 390 px les
        sept pastilles tiennent, et un jour qu'il faut aller chercher en faisant
        défiler est un jour qu'on oublie de regarder.
      */}
      <div className="selecteur-jour grid grid-cols-7 gap-1">
        {jours.map((j, index) => {
          const actif = index === jourAffiche;
          return (
            <button
              key={j.date}
              type="button"
              onClick={() => setJourAffiche(index)}
              aria-pressed={actif}
              className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors duration-200"
              style={{
                borderColor: actif
                  ? "var(--color-bordure-vive)"
                  : "var(--color-bordure)",
                backgroundColor: actif ? "var(--color-surface-haut)" : "transparent",
              }}
            >
              <span
                className="text-[10.5px] tracking-[0.08em] uppercase"
                style={{
                  color: actif ? "var(--color-doux)" : "var(--color-tres-doux)",
                }}
              >
                {JOURS_SEMAINE[j.jourSemaine].slice(0, 3)}
              </span>
              <span
                className="text-[16px] leading-none tabular-nums"
                style={{
                  color: actif ? "var(--color-texte)" : "var(--color-tres-doux)",
                }}
              >
                {Number(j.date.slice(8, 10))}
              </span>
              {j.aujourdhui && (
                <span
                  aria-hidden
                  className="size-1 rounded-full"
                  style={{ backgroundColor: "#c0996a" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ─────────────── Téléphone : la journée choisie ─────────────── */}
      <div className="vue-jour flex w-full min-w-0 flex-col gap-2">
        <p className="px-0.5 text-[12.5px] text-doux tabular-nums">
          {formaterDuree(jour.charge.tempsDispoMin)} disponibles
        </p>

        <div
          ref={defilementJour}
          className="relative w-full overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-bordure"
          style={{ maxHeight: "min(58dvh, 560px)" }}
        >
          <div className="flex w-full" style={{ height: HAUTEUR }}>
            <ColonneHeures heures={heures} />

            <div className="relative min-w-0 flex-1">
              <LignesHeures heures={heures} />

              {placer(parJour[jourAffiche]).map(({ morceau, colonne, colonnes }) => (
                <BlocGrille
                  key={`j-${morceau.bloc.cle}-${morceau.suite ? 1 : 0}`}
                  morceau={morceau}
                  colonne={colonne}
                  colonnes={colonnes}
                  large
                  surAppui={() => setChoisi({ morceau, date: jour.date })}
                />
              ))}

              {maintenant !== null && jourAffiche === indexAujourdhui && (
                <LigneMaintenant minute={maintenant} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────── La semaine entière ─────────────── */}
      <div
        ref={defilementSemaine}
        className="vue-semaine w-full overflow-auto overscroll-contain rounded-xl border border-bordure"
        style={{ maxHeight: "min(64dvh, 680px)" }}
      >
        {/*
          L'en-tête vit *dans* le conteneur qui défile, et non au-dessus : c'est
          la correction du défaut qui cassait l'affichage sur téléphone. Un
          en-tête posé à côté, calé par une simple marge, ne peut pas suivre le
          défilement horizontal — il se désalignait d'autant de colonnes que la
          grille était décalée, et débordait de la page.
        */}
        <div style={{ width: "max-content", minWidth: "100%" }}>
          <div className="sticky top-0 z-30 flex bg-fond">
            <div
              className="sticky left-0 z-40 shrink-0 border-r border-b border-bordure bg-fond"
              style={{ width: COLONNE_HEURES }}
            />
            <div className="grille-jours flex-1 border-b border-bordure">
              {jours.map((j) => (
                <div
                  key={j.date}
                  className="flex flex-col items-center gap-0.5 py-1.5"
                  style={{
                    backgroundColor: j.aujourdhui ? "var(--color-voile)" : "transparent",
                  }}
                >
                  <span
                    className={`text-[12px] tracking-[0.1em] uppercase ${
                      j.aujourdhui ? "text-texte" : "text-tres-doux"
                    }`}
                  >
                    {JOURS_SEMAINE[j.jourSemaine].slice(0, 3)}
                  </span>
                  <span
                    className={`text-[17px] leading-none tabular-nums ${
                      j.aujourdhui ? "text-texte" : "text-doux"
                    }`}
                  >
                    {Number(j.date.slice(8, 10))}
                  </span>
                  <span className="text-[10.5px] text-tres-doux tabular-nums">
                    {formaterDuree(j.charge.tempsDispoMin)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex" style={{ height: HAUTEUR }}>
            <ColonneHeures heures={heures} />

            <div className="grille-jours relative flex-1">
              <LignesHeures heures={heures} />

              {jours.map((j, index) => (
                <div
                  key={j.date}
                  className="relative border-r border-bordure/50 last:border-r-0"
                  style={{
                    backgroundColor: j.aujourdhui ? "var(--color-voile)" : "transparent",
                  }}
                >
                  {placer(parJour[index]).map(({ morceau, colonne, colonnes }) => (
                    <BlocGrille
                      key={`s-${morceau.bloc.cle}-${morceau.suite ? 1 : 0}`}
                      morceau={morceau}
                      colonne={colonne}
                      colonnes={colonnes}
                      large={false}
                      surAppui={() => setChoisi({ morceau, date: j.date })}
                    />
                  ))}

                  {maintenant !== null && index === indexAujourdhui && (
                    <LigneMaintenant minute={maintenant} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          setModeTelephone(modeTelephone === "jour" ? "semaine" : "jour")
        }
        className="bascule min-h-11 self-start rounded-xl border border-bordure px-3.5 text-[12.5px] text-doux"
      >
        {modeTelephone === "jour" ? "Voir la semaine entière" : "Revenir au jour"}
      </button>

      <p className="px-0.5 text-[11.5px] leading-relaxed text-tres-doux">
        Les blocs à trame reviennent chaque semaine : ce sont des contraintes. Les
        blocs unis sont posés sur une date. Sous chaque jour, le temps disponible
        une fois les créneaux et les deux heures incompressibles retirés.
      </p>

      {choisi && (
        <FeuilleBloc
          morceau={choisi.morceau}
          date={choisi.date}
          surFermeture={() => setChoisi(null)}
        />
      )}

      <style>{`
        /*
          Le palier téléphone est porté par le CSS, pas par du JavaScript qui
          mesurerait la fenêtre : la bascule suit la largeur réelle dès le
          premier rendu, sans clignotement ni écart entre serveur et navigateur.
          Le seul rôle de l'état React est de permettre de demander la semaine
          malgré tout, sur téléphone.
        */
        .calendrier[data-mode="jour"] .vue-semaine { display: none; }
        .calendrier[data-mode="semaine"] .vue-jour,
        .calendrier[data-mode="semaine"] .selecteur-jour { display: none; }

        .grille-jours {
          display: grid;
          grid-auto-flow: column;
          /* Trois jours visibles ; la colonne des heures est déjà déduite. */
          grid-auto-columns: max(104px, calc((100vw - ${COLONNE_HEURES}px - 2.5rem) / 3));
        }

        @media (min-width: ${LARGEUR_TELEPHONE}px) {
          /* Au-delà du téléphone, la semaine s'impose et le reste disparaît. */
          .calendrier .vue-jour,
          .calendrier .selecteur-jour,
          .calendrier .bascule { display: none !important; }
          .calendrier .vue-semaine { display: block !important; }
        }

        @media (min-width: 1024px) and (orientation: landscape) {
          .grille-jours { grid-auto-columns: minmax(0, 1fr); }
        }
      `}</style>
    </section>
  );
}

/** La colonne des heures, collée à gauche pendant le défilement horizontal. */
function ColonneHeures({ heures }: { heures: number[] }) {
  return (
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
  );
}

function LignesHeures({ heures }: { heures: number[] }) {
  return (
    <>
      {heures.map((heure) => (
        <span
          key={heure}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-px"
          style={{
            top: hauteurDe(heure * 60),
            backgroundColor:
              heure % 6 === 0 ? "var(--color-bordure-vive)" : "var(--color-bordure)",
            opacity: heure % 6 === 0 ? 0.9 : 0.5,
          }}
        />
      ))}
    </>
  );
}

function LigneMaintenant({ minute }: { minute: number }) {
  return (
    <span
      aria-label="Heure actuelle"
      className="pointer-events-none absolute inset-x-0 z-10 h-[1.5px] bg-[#c0996a]"
      style={{ top: hauteurDe(minute) }}
    >
      <span
        aria-hidden
        className="absolute top-1/2 left-0 size-2 -translate-y-1/2 rounded-full bg-[#c0996a]"
      />
    </span>
  );
}

/* ───────────────────────────── Un bloc ───────────────────────────── */

function BlocGrille({
  morceau,
  colonne,
  colonnes,
  large,
  surAppui,
}: {
  morceau: Morceau;
  colonne: number;
  colonnes: number;
  /** En vue jour, la colonne fait toute la largeur : le titre peut respirer. */
  large: boolean;
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
        className={`block truncate leading-tight ${large ? "text-[13.5px]" : "text-[12px]"} ${
          annule ? "text-tres-doux line-through" : "text-texte"
        }`}
      >
        {morceau.suite ? "↳ " : ""}
        {bloc.titre}
      </span>
      {hauteur >= 40 && (
        <span
          className={`block truncate leading-tight text-tres-doux tabular-nums ${
            large ? "text-[12px]" : "text-[10.5px]"
          }`}
        >
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
