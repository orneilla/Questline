"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ajouterMarquePage,
  analyser,
  apprendreMot,
  memoriser,
  sauverPosition,
} from "@/app/(app)/coran/actions";
import { FORMATS } from "@/lib/coran/formats";
import type { MotAffiche, VersetAffiche } from "@/lib/coran/donnees";
import { nomReciteur, pilePolice, urlAudio } from "@/lib/coran/sources";

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
 * Temps qu'un verset doit rester en vue avant d'être compté comme lu.
 *
 * Sans ce délai, faire défiler une sourate pour vérifier un import enregistrait
 * trois cents versets lus, ce qui est faux. Un défilement rapide ne traverse
 * chaque verset que quelques dizaines de millisecondes ; lire en prend
 * plusieurs secondes.
 */
const DUREE_LECTURE_MS = 2_500;

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
  versets,
  reglages,
  sources,
  versetInitial,
  repriseSuggeree,
  motAMotDisponible,
}: {
  versets: VersetAffiche[];
  reglages: ReglagesLecteur;
  sources: Sources;
  versetInitial: number;
  /** Verset où la lecture de cette sourate s'était arrêtée, s'il y en a un. */
  repriseSuggeree: { numero: number; reference: string } | null;
  motAMotDisponible: boolean;
}) {
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
   * Un verset n'est compté que s'il est resté en vue le temps de le lire. Le
   * compteur démarre quand il entre au centre de l'écran et s'annule s'il en
   * sort avant l'échéance.
   */
  useEffect(() => {
    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          const numero = Number(entree.target.getAttribute("data-verset"));
          if (!Number.isInteger(numero)) continue;

          const enCours = minuteries.current.get(numero);
          if (!entree.isIntersecting) {
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
      { rootMargin: "-35% 0px -35% 0px" },
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
          const enCours = actif === verset.numero;
          return (
            <li
              key={verset.numero}
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
          );
        })}
      </ol>

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
          <p
            dir="rtl"
            lang="ar"
            className="text-[38px] leading-tight"
            style={{ fontFamily: '"Amiri Quran", "Amiri", "Noto Naskh Arabic", serif' }}
          >
            {mot.arabe}
          </p>
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
          {mot.buckwalter && (
            <>
              <dt className="text-tres-doux">Translittération</dt>
              <dd className="text-doux">{mot.buckwalter}</dd>
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
              <dd className="text-doux">{mot.lemme}</dd>
            </>
          )}
          {mot.categorie && (
            <>
              <dt className="text-tres-doux">Grammaire</dt>
              <dd className="text-doux">{mot.categorie}</dd>
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
            Aucune glose mot à mot n'a de licence vérifiable : le panneau donne la
            racine, le lemme et la grammaire, qui viennent du corpus sous GPL.
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

        {corpus && (
          <p className="text-[11px] leading-relaxed text-tres-doux">
            {corpus.nom} — {corpus.auteur}. {corpus.lien}
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
