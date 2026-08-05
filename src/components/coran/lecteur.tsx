"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import {
  ajouterMarquePage,
  analyser,
  apprendreMot,
  chargerSourateVoisine,
  memoriser,
  sauverPosition,
} from "@/app/(app)/coran/actions";
import { FORMATS } from "@/lib/coran/formats";
import type { MotAffiche, TrancheSourate, VersetAffiche } from "@/lib/coran/donnees";
import { GLOSE_DEPOSEE, nomReciteur, pilePolice, urlAudio } from "@/lib/coran/sources";

/**
 * Le lecteur.
 *
 * Trois choses s'y passent en même temps et ne doivent pas se gêner : on lit,
 * on écoute, et l'application note où l'on en est. La lecture continue fait
 * défiler et surligne le verset récité ; la position est enregistrée en
 * arrière-plan ; et la séance est journalisée en quittant l'écran comme à
 * intervalles réguliers.
 *
 * La hiérarchie typographique n'est pas décorative. Quelqu'un qui mémorise sans
 * lire l'arabe couramment travaille *sur la translittération* : elle vient donc
 * juste après l'arabe, à une taille qui se règle pour elle-même, et la
 * traduction passe en troisième.
 */

export type Sources = {
  riwaya: string;
  graphie: string;
  sourceArabe: string;
  traduction: { nom: string; auteur: string } | null;
  translitteration: { nom: string; auteur: string } | null;
  corpus: { nom: string; auteur: string; lien: string } | null;
};

export type ReglagesLecteur = {
  reciteur: string;
  tailleArabe: number;
  tailleTranslitteration: number;
  tailleTraduction: number;
  modeMemorisation: boolean;
  policeArabe: string;
  afficherArabe: boolean;
  afficherTranslitteration: boolean;
  afficherTraduction: boolean;
};

const INTERVALLE_JOURNAL_MS = 180_000;
const PAS_JOURNAL = 20;

/**
 * Ce qui compte comme « lu ».
 *
 * Un verset est compté quand il est resté **assez visible assez longtemps**.
 * Ni l'audio ni aucun geste ne sont requis : la lecture silencieuse est la
 * lecture normale, et l'écoute n'est qu'un moyen parmi d'autres.
 *
 * ── Pourquoi la version précédente comptait zéro
 *
 * Elle exigeait qu'un verset croise une bande étroite au centre exact de
 * l'écran — trente pour cent de la hauteur. Ce qui décidait n'était donc pas
 * d'avoir lu le verset mais l'endroit où il s'était arrêté sous le doigt : un
 * verset court posé en haut de l'écran, parfaitement lisible, ne touchait
 * jamais la bande et ne comptait pas. D'où une sourate lue en entier créditée
 * de rien.
 *
 * ── Le critère retenu
 *
 * Le verset est visible pour de bon, n'importe où dans l'écran : soit plus de
 * la moitié du verset est à l'écran, soit — pour un verset plus grand que
 * l'écran — il en occupe plus de la moitié. Les deux ensemble couvrent aussi
 * bien un verset court qu'un verset qui déborde.
 *
 * ── Le garde-fou contre le survol
 *
 * Il tient dans la durée, et nulle part ailleurs. Un défilement continu ne
 * laisse chaque verset à l'écran que quelques centaines de millisecondes ;
 * lire le plus court des versets en prend plusieurs. Deux secondes suffisent à
 * séparer les deux sans exiger un arrêt prolongé.
 */
const DUREE_LECTURE_MS = 2_000;

/** Part du verset qui doit être à l'écran, pour un verset qui y tient. */
const PART_VERSET = 0.5;

/** Part de l'écran que doit occuper un verset trop grand pour y tenir. */
const PART_ECRAN = 0.5;

/** En mode mémorisation, l'arabe et la translittération priment franchement. */
function tailles(reglages: ReglagesLecteur) {
  if (!reglages.modeMemorisation) {
    return {
      arabe: reglages.tailleArabe,
      translitteration: reglages.tailleTranslitteration,
      traduction: reglages.tailleTraduction,
    };
  }
  return {
    arabe: Math.round(reglages.tailleArabe * 1.15),
    translitteration: Math.round(reglages.tailleTranslitteration * 1.25),
    traduction: Math.max(12, Math.round(reglages.tailleTraduction * 0.8)),
  };
}

export function Lecteur({
  versets: versetsInitiaux,
  tranche,
  basmala,
  reglages,
  sources,
  versetInitial,
  repriseSuggeree,
  motAMotDisponible,
}: {
  versets: VersetAffiche[];
  /**
   * La sourate ouverte, quand l'écran en montre une entière. Absente pour un
   * juz' ou une plage : l'enchaînement n'a alors pas de sens.
   */
  tranche: TrancheSourate | null;
  /** La basmala, recopiée de la base — jamais écrite ici. */
  basmala: string | null;
  reglages: ReglagesLecteur;
  sources: Sources;
  versetInitial: number;
  /** Verset où la lecture de cette sourate s'était arrêtée, s'il y en a un. */
  repriseSuggeree: { numero: number; reference: string } | null;
  motAMotDisponible: boolean;
}) {
  /**
   * Les sourates affichées, dans l'ordre.
   *
   * En continuant de défiler après le dernier verset, la suivante s'ajoute à la
   * suite ; en remontant avant le premier, la précédente se met en tête. C'est
   * ce que fait n'importe quel moushaf : on ne sort pas d'une sourate pour
   * entrer dans la suivante.
   */
  const [tranches, setTranches] = useState<TrancheSourate[]>(() =>
    tranche ? [tranche] : [],
  );
  const chargement = useRef<Set<number>>(new Set());
  const zoneBas = useRef<HTMLDivElement | null>(null);

  const versets = tranche ? tranches.flatMap((t) => t.versets) : versetsInitiaux;
  const [actif, setActif] = useState<number | null>(null);
  const [continu, setContinu] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [retour, setRetour] = useState<string | null>(null);
  const [mot, setMot] = useState<{ verset: VersetAffiche; analyse: MotAffiche } | null>(
    null,
  );
  const [repriseVisible, setRepriseVisible] = useState(repriseSuggeree !== null);
  const [memorisation, setMemorisation] = useState(reglages.modeMemorisation);
  const [afficher, setAfficher] = useState({
    arabe: reglages.afficherArabe,
    translitteration: reglages.afficherTranslitteration,
    traduction: reglages.afficherTraduction,
  });

  const audio = useRef<HTMLAudioElement | null>(null);
  const elements = useRef(new Map<number, HTMLElement>());
  const debutSeance = useRef(Date.now());
  const premierLu = useRef(versetInitial);
  const dernierLu = useRef(versetInitial);
  const minuteries = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  /** Les versets restés sous les yeux assez longtemps depuis le dernier envoi. */
  const lus = useRef(new Set<number>());

  const echelle = tailles({ ...reglages, modeMemorisation: memorisation });

  const journaliser = useCallback(() => {
    if (lus.current.size === 0) return;
    const charge = JSON.stringify({
      numeros: [...lus.current],
      secondes: Math.round((Date.now() - debutSeance.current) / 1000),
    });

    // `sendBeacon` est le seul envoi qui survive à la fermeture de la page :
    // une action serveur partirait avec l'onglet et la lecture ne compterait pas.
    const envoye =
      typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
        ? navigator.sendBeacon(
            "/api/coran/lecture",
            new Blob([charge], { type: "application/json" }),
          )
        : false;

    if (!envoye) {
      void fetch("/api/coran/lecture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: charge,
        keepalive: true,
      }).catch(() => undefined);
    }

    lus.current.clear();
    premierLu.current = dernierLu.current;
    debutSeance.current = Date.now();
  }, []);

  useEffect(() => {
    const minuteur = setInterval(journaliser, INTERVALLE_JOURNAL_MS);
    const partir = () => journaliser();
    window.addEventListener("pagehide", partir);
    return () => {
      clearInterval(minuteur);
      window.removeEventListener("pagehide", partir);
      journaliser();
    };
  }, [journaliser]);

  /**
   * Charge la sourate voisine quand on approche d'un bout.
   *
   * Vers le bas, elle s'ajoute simplement. Vers le haut, il faut compenser :
   * insérer du contenu au-dessus déplacerait tout ce qu'on est en train de
   * lire. On mesure la hauteur avant, et on rend le défilement après.
   */
  const etendre = useCallback(
    async (sens: -1 | 1) => {
      if (tranches.length === 0) return;
      const bord = sens === 1 ? tranches[tranches.length - 1] : tranches[0];
      const vise = bord.sourate + sens;
      if (vise < 1 || vise > 114 || chargement.current.has(vise)) return;

      chargement.current.add(vise);
      try {
        const suite = await chargerSourateVoisine(vise);
        if (!suite || suite.versets.length === 0) return;

        setTranches((actuelles) => {
          if (actuelles.some((t) => t.sourate === vise)) return actuelles;
          if (sens === 1) return [...actuelles, suite];

          // Compensation : on note la position du document avant l'insertion.
          const avant = document.body.scrollHeight;
          requestAnimationFrame(() => {
            const gagne = document.body.scrollHeight - avant;
            if (gagne > 0) window.scrollBy({ top: gagne, behavior: "instant" });
          });
          return [suite, ...actuelles];
        });
      } finally {
        chargement.current.delete(vise);
      }
    },
    [tranches],
  );

  // Vers le bas, une sentinelle suffit : on anticipe d'un écran, la suite est
  // là avant qu'on arrive au bout.
  useEffect(() => {
    const cible = zoneBas.current;
    if (!tranche || !cible) return;

    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) void etendre(1);
      },
      { rootMargin: "600px 0px" },
    );
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, [tranche, etendre]);

  /**
   * Vers le haut, on écoute le défilement plutôt qu'une sentinelle.
   *
   * Une sentinelle placée en tête est visible dès l'ouverture : elle chargerait
   * la sourate précédente sans qu'on l'ait demandée, et l'écran s'ouvrirait sur
   * la fin de la sourate d'avant. On attend donc un geste réel — être remonté
   * près du début, en remontant.
   */
  useEffect(() => {
    if (!tranche) return;

    let precedent = window.scrollY;
    const auDefilement = () => {
      const y = window.scrollY;
      const remonte = y < precedent - 2;
      precedent = y;
      if (remonte && y < 400) void etendre(-1);
    };

    window.addEventListener("scroll", auDefilement, { passive: true });
    return () => window.removeEventListener("scroll", auDefilement);
  }, [tranche, etendre]);

  /**
   * Un verset n'est compté que s'il est resté assez visible assez longtemps.
   * Le compteur démarre quand il devient franchement lisible et s'annule dès
   * qu'il cesse de l'être.
   */
  useEffect(() => {
    const observateur = new IntersectionObserver(
      (entrees) => {
        const hauteurEcran = window.innerHeight || 1;

        for (const entree of entrees) {
          const numero = Number(entree.target.getAttribute("data-verset"));
          if (!Number.isInteger(numero)) continue;

          // Deux façons d'être lisible : montrer la moitié de soi, ou occuper
          // la moitié de l'écran quand on est plus grand que lui.
          const lisible =
            entree.isIntersecting &&
            (entree.intersectionRatio >= PART_VERSET ||
              entree.intersectionRect.height / hauteurEcran >= PART_ECRAN);

          const enCours = minuteries.current.get(numero);
          if (!lisible) {
            if (enCours) {
              clearTimeout(enCours);
              minuteries.current.delete(numero);
            }
            continue;
          }

          if (enCours || lus.current.has(numero)) continue;

          minuteries.current.set(
            numero,
            setTimeout(() => {
              minuteries.current.delete(numero);
              lus.current.add(numero);
              if (numero > dernierLu.current) {
                dernierLu.current = numero;
                void sauverPosition(numero);
              }
              if (lus.current.size >= PAS_JOURNAL) journaliser();
            }, DUREE_LECTURE_MS),
          );
        }
      },
      {
        // Assez de paliers pour voir passer les deux seuils, y compris sur un
        // verset bien plus grand que l'écran.
        threshold: Array.from({ length: 21 }, (_, i) => i / 20),
      },
    );

    for (const element of elements.current.values()) observateur.observe(element);
    const enAttente = minuteries.current;
    return () => {
      observateur.disconnect();
      for (const minuterie of enAttente.values()) clearTimeout(minuterie);
      enAttente.clear();
    };
  }, [versets, journaliser]);

  /** Amène un verset sous les yeux, avec un peu de contexte au-dessus. */
  const allerAu = useCallback((numero: number, doux = true) => {
    const cible = elements.current.get(numero);
    if (!cible) return;
    // Un seul défilement, recul compris. Enchaîner `scrollIntoView` puis
    // `scrollBy` ne marche pas : le second interrompt le premier et s'applique
    // depuis la position d'avant, ce qui annule le déplacement.
    const y = cible.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: Math.max(0, y), behavior: doux ? "smooth" : "auto" });
  }, []);

  // Une adresse qui désigne un verset l'amène directement ; une reprise
  // seulement suggérée attend qu'on la demande.
  useEffect(() => {
    if (repriseSuggeree && repriseSuggeree.numero === versetInitial) return;
    allerAu(versetInitial, false);
  }, [versetInitial, repriseSuggeree, allerAu]);

  const jouer = useCallback(
    (numero: number) => {
      const lecteur = audio.current;
      if (!lecteur) return;
      lecteur.src = urlAudio(reglages.reciteur, numero);
      setActif(numero);
      void lecteur.play().catch(() => {
        setActif(null);
        setContinu(false);
        setRetour("La récitation n'a pas pu être jointe. Le texte reste lisible.");
      });
    },
    [reglages.reciteur],
  );

  useEffect(() => {
    if (actif === null) return;
    elements.current.get(actif)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [actif]);

  function auBout(): void {
    if (!continu || actif === null) {
      setActif(null);
      return;
    }
    const rang = versets.findIndex((v) => v.numero === actif);
    const suivant = versets[rang + 1];
    if (!suivant) {
      setActif(null);
      setContinu(false);
      return;
    }
    jouer(suivant.numero);
  }

  const bascule = (cle: keyof typeof afficher, libelle: string) => (
    <button
      type="button"
      aria-pressed={afficher[cle]}
      onClick={() => setAfficher((a) => ({ ...a, [cle]: !a[cle] }))}
      className="min-h-9 rounded-lg border px-3 text-[12px] transition-colors duration-200"
      style={{
        borderColor: afficher[cle] ? "var(--color-bordure-vive)" : "var(--color-bordure)",
        backgroundColor: afficher[cle] ? "var(--color-surface-haut)" : "transparent",
        color: afficher[cle] ? "var(--color-texte)" : "var(--color-tres-doux)",
      }}
    >
      {libelle}
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <audio ref={audio} onEnded={auBout} preload="none" className="sr-only" />

      {repriseVisible && repriseSuggeree && (
        <button
          type="button"
          onClick={() => {
            allerAu(repriseSuggeree.numero);
            setRepriseVisible(false);
          }}
          className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-bordure bg-surface px-4 text-left transition-colors duration-200 active:bg-surface-haut"
        >
          <span className="text-[13.5px] text-doux">
            Reprendre au verset {repriseSuggeree.reference}
          </span>
          <span aria-hidden className="text-[15px] text-tres-doux">
            ↓
          </span>
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {bascule("arabe", "arabe")}
        {sources.translitteration && bascule("translitteration", "translittération")}
        {sources.traduction && bascule("traduction", "traduction")}

        <button
          type="button"
          aria-pressed={memorisation}
          onClick={() => setMemorisation((m) => !m)}
          className="min-h-9 rounded-lg border px-3 text-[12px] transition-colors duration-200"
          style={{
            borderColor: memorisation
              ? "var(--color-bordure-vive)"
              : "var(--color-bordure)",
            backgroundColor: memorisation ? "var(--color-surface-haut)" : "transparent",
            color: memorisation ? "var(--color-texte)" : "var(--color-tres-doux)",
          }}
        >
          mémorisation
        </button>

        <button
          type="button"
          onClick={() => {
            if (continu) {
              setContinu(false);
              audio.current?.pause();
              setActif(null);
              return;
            }
            setContinu(true);
            jouer(actif ?? versets[0].numero);
          }}
          className="ml-auto min-h-9 rounded-lg border border-bordure-vive bg-surface-haut px-3 text-[12px] text-texte transition-colors duration-200"
        >
          {continu ? "Arrêter la lecture" : "Lecture continue"}
        </button>
      </div>

      {retour && (
        <p aria-live="polite" className="text-[12.5px] text-doux">
          {retour}
        </p>
      )}

      <ol className="flex flex-col">
        {versets.map((verset) => {
          const ouvreSourate =
            tranche !== null && verset.numeroDansSourate === 1;
          const bloc = ouvreSourate
            ? tranches.find((t) => t.sourate === verset.sourate)
            : undefined;

          const enCours = actif === verset.numero;
          return (
            <Fragment key={verset.numero}>
              {bloc && (
                <SeparateurSourate
                  nom={bloc.nom}
                  numero={bloc.sourate}
                  basmala={bloc.basmala ? basmala : null}
                  police={pilePolice(reglages.policeArabe)}
                  taille={echelle.arabe}
                  premier={versets[0]?.numero === verset.numero}
                />
              )}
            <li
              data-verset={verset.numero}
              ref={(element) => {
                if (element) elements.current.set(verset.numero, element);
                else elements.current.delete(verset.numero);
              }}
              className="scroll-mt-24 border-b border-bordure py-5 transition-colors duration-500"
              style={{
                backgroundColor: enCours ? "var(--color-voile)" : "transparent",
                boxShadow: enCours ? "inset 2px 0 0 0 var(--color-deen)" : undefined,
              }}
            >
              <div className="flex items-center justify-between gap-3 px-1">
                <button
                  type="button"
                  onClick={() => setOuvert(ouvert === verset.numero ? null : verset.numero)}
                  aria-expanded={ouvert === verset.numero}
                  className="min-h-9 rounded-lg px-2 text-[11.5px] text-tres-doux tabular-nums transition-colors duration-200 active:text-doux"
                >
                  {verset.sourate}:{verset.numeroDansSourate}
                  {verset.sajda ? " · sajda" : ""}
                </button>

                <button
                  type="button"
                  onClick={() => (enCours ? audio.current?.pause() : jouer(verset.numero))}
                  aria-label={`Écouter le verset ${verset.sourate}:${verset.numeroDansSourate}`}
                  className="flex size-9 items-center justify-center rounded-lg text-tres-doux transition-colors duration-200 active:text-texte"
                >
                  <svg viewBox="0 0 24 24" className="size-[15px]" fill="currentColor" aria-hidden>
                    {enCours ? (
                      <path d="M8 5.5h3v13H8zM13 5.5h3v13h-3z" />
                    ) : (
                      <path d="M8 5.4v13.2l10-6.6z" />
                    )}
                  </svg>
                </button>
              </div>

              {afficher.arabe && (
                <p
                  dir="rtl"
                  lang="ar"
                  className="px-1 pt-3 text-right"
                  style={{
                    fontFamily: pilePolice(reglages.policeArabe),
                    fontSize: `${echelle.arabe}px`,
                    lineHeight: 2.15,
                  }}
                >
                  {motAMotDisponible ? (
                    <MotsCliquables
                      verset={verset}
                      surChoix={(analyse) => setMot({ verset, analyse })}
                    />
                  ) : (
                    verset.arabe
                  )}
                </p>
              )}

              {afficher.translitteration && verset.translitteration && (
                <p
                  className="px-1 pt-3 leading-relaxed text-texte"
                  style={{ fontSize: `${echelle.translitteration}px`, lineHeight: 1.75 }}
                >
                  {verset.translitteration}
                </p>
              )}

              {afficher.traduction && verset.traduction && (
                <p
                  className="px-1 pt-3 leading-relaxed text-doux"
                  style={{ fontSize: `${echelle.traduction}px` }}
                >
                  {verset.traduction}
                </p>
              )}

              {ouvert === verset.numero && (
                <ActionsVerset
                  verset={verset}
                  surRetour={(texte) => {
                    setRetour(texte);
                    setOuvert(null);
                  }}
                />
              )}
            </li>
            </Fragment>
          );
        })}
      </ol>

      {/* Sentinelle du bas : la dépasser charge la sourate suivante. */}
      {tranche && <div ref={zoneBas} aria-hidden className="h-px" />}

      {mot && (
        <PanneauMot
          mot={mot.analyse}
          verset={mot.verset}
          corpus={sources.corpus}
          surFermeture={() => setMot(null)}
          surRetour={(texte) => {
            setRetour(texte);
            setMot(null);
          }}
        />
      )}

      <footer className="flex flex-col gap-1 pt-2 text-[11.5px] leading-relaxed text-tres-doux">
        <p>
          Texte arabe : {sources.riwaya}, graphie {sources.graphie}. {sources.sourceArabe}.
        </p>
        {sources.traduction && (
          <p>
            Traduction : {sources.traduction.nom} — {sources.traduction.auteur}.
          </p>
        )}
        {sources.translitteration && (
          <p>Translittération : {sources.translitteration.auteur}.</p>
        )}
        {sources.corpus && (
          <p>
            Analyse mot à mot : {sources.corpus.nom} — {sources.corpus.auteur}.
          </p>
        )}
        <p>Récitation : {nomReciteur(reglages.reciteur)}, diffusée depuis islamic.network.</p>
      </footer>
    </div>
  );
}

/**
 * Le verset découpé en mots interrogeables.
 *
 * Le découpage se fait sur les blancs du texte verbatim et les sépare en les
 * conservant : ce qui est affiché est exactement ce qui est en base, mot pour
 * mot, blanc pour blanc.
 */
function MotsCliquables({
  verset,
  surChoix,
}: {
  verset: VersetAffiche;
  surChoix: (analyse: MotAffiche) => void;
}) {
  const [enCours, setEnCours] = useState<number | null>(null);
  const morceaux = verset.arabe.split(/(\s+)/);
  let rang = 0;

  return (
    <>
      {morceaux.map((morceau, index) => {
        if (morceau.trim().length === 0) return <span key={index}>{morceau}</span>;
        rang += 1;
        const position = rang;
        return (
          <button
            key={index}
            type="button"
            disabled={enCours !== null}
            onClick={() => {
              setEnCours(position);
              void analyser(verset.numero, position)
                .then((analyse) => {
                  if (analyse) surChoix(analyse);
                })
                .finally(() => setEnCours(null));
            }}
            className="rounded transition-colors duration-150 active:bg-surface-haut"
            style={{
              opacity: enCours === position ? 0.5 : 1,
              // Le mot doit rester dans le flux du verset : aucune marge, aucun
              // fond, rien qui découpe visuellement le texte.
              font: "inherit",
              color: "inherit",
            }}
          >
            {morceau}
          </button>
        );
      })}
    </>
  );
}

function PanneauMot({
  mot,
  verset,
  corpus,
  surFermeture,
  surRetour,
}: {
  mot: MotAffiche;
  verset: VersetAffiche;
  corpus: { nom: string; auteur: string; lien: string } | null;
  surFermeture: () => void;
  surRetour: (texte: string) => void;
}) {
  const [enCours, setEnCours] = useState(false);

  // Échap ferme le panneau : il se superpose à la sourate, il ne la quitte pas.
  useEffect(() => {
    const auClavier = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") surFermeture();
    };
    window.addEventListener("keydown", auClavier);
    return () => window.removeEventListener("keydown", auClavier);
  }, [surFermeture]);

  async function ajouter(parRacine: boolean) {
    setEnCours(true);
    const resultat = await apprendreMot(verset.numero, mot.position, parRacine);
    setEnCours(false);
    surRetour(resultat.erreur ?? resultat.message ?? "");
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-fond/85 backdrop-blur-sm"
      onClick={surFermeture}
      role="presentation"
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl border-t border-bordure-vive bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
        onClick={(evenement) => evenement.stopPropagation()}
        role="dialog"
        aria-label="Analyse du mot"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p
              dir="rtl"
              lang="ar"
              className="text-[38px] leading-tight"
              style={{ fontFamily: '"Amiri Quran", "Amiri", "Noto Naskh Arabic", serif' }}
            >
              {mot.arabe}
            </p>
            {mot.translitteration && (
              <p className="police-titre text-[17px] leading-tight text-doux italic">
                {mot.translitteration}
              </p>
            )}
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

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13.5px]">
          {mot.segments.length > 1 && (
            <>
              <dt className="text-tres-doux">Découpage</dt>
              <dd dir="rtl" lang="ar" className="text-doux">
                {mot.segments.join(" ‑ ")}
              </dd>
            </>
          )}
          {mot.racine && (
            <>
              <dt className="text-tres-doux">Racine</dt>
              <dd dir="rtl" lang="ar" className="text-texte">
                {mot.racine}
              </dd>
            </>
          )}
          {mot.lemme && (
            <>
              <dt className="text-tres-doux">Lemme</dt>
              <dd dir="rtl" lang="ar" className="text-doux">
                {mot.lemme}
              </dd>
            </>
          )}
          {mot.grammaire && (
            <>
              <dt className="text-tres-doux">Grammaire</dt>
              <dd className="text-doux">
                {mot.grammaire}
                {mot.traits && (
                  <span className="block text-[11.5px] text-tres-doux">
                    {mot.traits}
                  </span>
                )}
              </dd>
            </>
          )}
          {mot.sens && (
            <>
              <dt className="text-tres-doux">Sens</dt>
              <dd className="text-doux">{mot.sens}</dd>
            </>
          )}
          {mot.racine && (
            <>
              <dt className="text-tres-doux">Fréquence</dt>
              <dd className="text-doux tabular-nums">
                {mot.frequenceRacine} occurrence{mot.frequenceRacine > 1 ? "s" : ""} de
                cette racine dans le Coran
              </dd>
            </>
          )}
        </dl>

        {!mot.sens && (
          <p className="text-[11.5px] leading-relaxed text-tres-doux">
            Aucun sens n'est installé pour ce mot : le panneau donne la racine, le
            lemme et la grammaire, qui viennent du corpus. Une traduction mot à mot
            se dépose depuis les réglages.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-[11px] tracking-[0.14em] text-tres-doux uppercase">
            Ajouter au vocabulaire
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={enCours || !mot.racine}
              onClick={() => void ajouter(true)}
              className="min-h-12 flex-1 rounded-xl border border-bordure px-3 text-[13.5px] text-doux transition-colors duration-200 active:bg-surface-haut disabled:opacity-40"
            >
              Rangé par racine
            </button>
            <button
              type="button"
              disabled={enCours}
              onClick={() => void ajouter(false)}
              className="min-h-12 flex-1 rounded-xl border border-bordure px-3 text-[13.5px] text-doux transition-colors duration-200 active:bg-surface-haut disabled:opacity-40"
            >
              Rangé par sourate
            </button>
          </div>
        </div>

        {/* Chaque écran nomme ses sources : le corpus pour la grammaire, QUL et
            QuranWBW pour le sens. */}
        {corpus && (
          <p className="text-[11px] leading-relaxed text-tres-doux">
            {corpus.nom} — {corpus.auteur}. {corpus.lien}
          </p>
        )}
        {mot.sens && (
          <p className="text-[11px] leading-relaxed text-tres-doux">
            {GLOSE_DEPOSEE.mention}
          </p>
        )}
      </div>
    </div>
  );
}

function ActionsVerset({
  verset,
  surRetour,
}: {
  verset: VersetAffiche;
  surRetour: (texte: string) => void;
}) {
  const [nom, setNom] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function lancer(action: () => Promise<{ erreur?: string; message?: string }>) {
    setEnCours(true);
    const resultat = await action();
    setEnCours(false);
    surRetour(resultat.erreur ?? resultat.message ?? "");
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-bordure bg-surface p-3">
      <p className="text-[11px] tracking-[0.14em] text-tres-doux uppercase">Mémoriser</p>
      <div className="flex flex-wrap gap-2">
        {FORMATS.map((format) => (
          <button
            key={format.valeur}
            type="button"
            disabled={enCours}
            title={format.aide}
            onClick={() => void lancer(() => memoriser(verset.numero, format.valeur))}
            className="min-h-10 rounded-lg border border-bordure px-3 text-[12.5px] text-doux transition-colors duration-200 active:bg-surface-haut disabled:opacity-50"
          >
            {format.libelle}
          </button>
        ))}
      </div>

      <p className="text-[11px] tracking-[0.14em] text-tres-doux uppercase">Marque-page</p>
      <div className="flex gap-2">
        <input
          value={nom}
          onChange={(evenement) => setNom(evenement.target.value)}
          placeholder="Un nom, pour le retrouver"
          maxLength={120}
          className="min-h-11 flex-1 rounded-lg border border-bordure bg-fond px-3 text-[14px] text-texte outline-none focus:border-bordure-vive"
        />
        <button
          type="button"
          disabled={enCours}
          onClick={() => void lancer(() => ajouterMarquePage(verset.numero, nom))}
          className="min-h-11 shrink-0 rounded-lg border border-bordure-vive bg-surface-haut px-4 text-[13px] text-texte disabled:opacity-50"
        >
          Poser
        </button>
      </div>
    </div>
  );
}

/**
 * La coupure entre deux sourates.
 *
 * Nette, mais sans emphase : le nom, le numéro, et la basmala là où elle est
 * d'usage. Le texte arabe de la basmala n'est pas écrit ici — il est recopié du
 * premier verset d'Al-Fatiha tel qu'il est en base, et passé en propriété. Il
 * est absent pour Al-Fatiha, qui la porte comme premier verset, et pour
 * At-Tawba, qui n'en a pas.
 */
function SeparateurSourate({
  nom,
  numero,
  basmala,
  police,
  taille,
  premier,
}: {
  nom: string;
  numero: number;
  basmala: string | null;
  police: string;
  taille: number;
  /** La première sourate affichée n'a pas besoin d'un trait au-dessus d'elle. */
  premier: boolean;
}) {
  return (
    <li
      className={`flex flex-col items-center gap-2.5 px-1 pb-6 ${
        premier ? "pt-1" : "mt-4 border-t border-bordure-vive pt-8"
      }`}
    >
      <span className="text-[11.5px] tracking-[0.22em] text-tres-doux uppercase">
        Sourate {numero}
      </span>
      <span className="police-titre text-[24px] leading-none text-texte">{nom}</span>

      {basmala && (
        <span
          dir="rtl"
          lang="ar"
          className="mt-1 text-center leading-loose text-doux"
          style={{ fontFamily: police, fontSize: taille * 0.8 }}
        >
          {basmala}
        </span>
      )}
    </li>
  );
}
