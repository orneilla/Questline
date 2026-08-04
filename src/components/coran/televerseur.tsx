"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { champ, etiquette } from "@/components/reglages/briques";
import {
  RessourceIllisible,
  lireRessource,
  type Diagnostic,
  type Ressource,
} from "@/lib/coran/ressources";
import { GLOSE_DEPOSEE } from "@/lib/coran/sources";

/**
 * Dépôt d'une ressource depuis l'appareil.
 *
 * Certaines ressources ne s'obtiennent pas par requête : QUL les sert depuis son
 * site, sans adresse stable. Le fichier est donc déposé à la main, et tout se
 * passe ici, dans le navigateur — c'est aussi la seule façon de traiter
 * plusieurs mégaoctets sans les faire transiter d'un bloc par une fonction
 * serverless qui les refuserait.
 *
 * L'ordre des étapes n'est pas négociable : lire, montrer, puis écrire.
 * L'écran affiche ce qu'il a compris du fichier — sa structure, son nombre
 * d'entrées, trois exemples réels — avant qu'une seule ligne ne parte en base.
 * Trois exemples réels, pas trois exemples choisis : le premier, celui du
 * milieu, le dernier. C'est ce qui permet de voir un décalage plutôt que de le
 * découvrir six mois plus tard sur un mot mal traduit.
 *
 * L'écriture part ensuite par lots, un verset n'étant jamais coupé entre deux
 * lots : c'est côté serveur la condition pour vérifier l'alignement sur le texte
 * de Tanzil. Si le dépôt s'interrompt, la position est retenue et l'écran
 * propose de reprendre au même endroit.
 */

/** Entrées par requête. Assez pour aller vite, assez court pour ne jamais expirer. */
const TAILLE_LOT = 800;

const CLE_REPRISE = "questline.televersement";

type Etape = "attente" | "lecture" | "diagnostic" | "ecriture" | "fini";

type Couverture = { motsTexte: number; avecSens: number; sansSens: number };

type BilanTotal = {
  ecrits: number;
  versetsEcartes: number;
  sansCorrespondance: number;
  refusees: number;
};

type ReponseLot = BilanTotal & {
  erreur?: string;
  couverture: Couverture | null;
  versetsEdition?: number;
};

type MetaEdition = {
  cle: string;
  langue: string;
  nom: string;
  auteur: string;
  licence: string;
  source: string;
};

/* ──────────────────────────── Découpage en lots ──────────────────────────── */

/**
 * Découpe en lots sans jamais couper un verset.
 *
 * Le serveur vérifie qu'un verset reçoit exactement autant de mots que le texte
 * en compte. Un verset partagé entre deux requêtes échouerait ce contrôle des
 * deux côtés et serait écarté pour rien.
 */
function lotsParVerset<T extends { sourate: number; verset: number }>(
  entrees: T[],
  cible: number,
): T[][] {
  const groupes = new Map<string, T[]>();
  for (const entree of entrees) {
    const cle = `${entree.sourate}:${entree.verset}`;
    const liste = groupes.get(cle);
    if (liste) liste.push(entree);
    else groupes.set(cle, [entree]);
  }

  const lots: T[][] = [];
  let courant: T[] = [];
  for (const groupe of groupes.values()) {
    if (courant.length > 0 && courant.length + groupe.length > cible) {
      lots.push(courant);
      courant = [];
    }
    courant.push(...groupe);
  }
  if (courant.length > 0) lots.push(courant);
  return lots;
}

/** Une empreinte du fichier, pour reconnaître une reprise du même dépôt. */
function empreinte(fichier: File, type: string): string {
  return `${fichier.name}|${fichier.size}|${type}`;
}

function slug(texte: string): string {
  return (
    texte
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "depot"
  );
}

/* ──────────────────────────────── Écran ──────────────────────────────── */

export function Televerseur() {
  const [etape, setEtape] = useState<Etape>("attente");
  const [erreur, setErreur] = useState<string | null>(null);
  const [ressource, setRessource] = useState<Ressource | null>(null);
  const [nomFichier, setNomFichier] = useState("");
  const [reprise, setReprise] = useState<number | null>(null);

  const [lotsFaits, setLotsFaits] = useState(0);
  const [lotsTotal, setLotsTotal] = useState(0);
  const [total, setTotal] = useState<BilanTotal>({
    ecrits: 0,
    versetsEcartes: 0,
    sansCorrespondance: 0,
    refusees: 0,
  });
  const [couverture, setCouverture] = useState<Couverture | null>(null);
  const [versetsEdition, setVersetsEdition] = useState<number | null>(null);

  const [meta, setMeta] = useState<MetaEdition>({
    cle: "",
    langue: "fr",
    nom: "",
    auteur: "",
    licence: "",
    source: "Fichier déposé depuis l'appareil",
  });

  const fichierRef = useRef<File | null>(null);
  const arret = useRef(false);

  /* ── Étape 1 : lire, sans rien écrire ── */

  const choisir = useCallback(async (fichier: File) => {
    setErreur(null);
    setRessource(null);
    setCouverture(null);
    setVersetsEdition(null);
    setTotal({ ecrits: 0, versetsEcartes: 0, sansCorrespondance: 0, refusees: 0 });
    setEtape("lecture");
    setNomFichier(fichier.name);
    fichierRef.current = fichier;

    try {
      const octets = await fichier.arrayBuffer();
      const lue = lireRessource(octets);
      setRessource(lue);
      setMeta((m) => ({
        ...m,
        cle: m.cle || `depot.${slug(fichier.name.replace(/\.[^.]+$/, ""))}`,
        source: `${fichier.name}, déposé depuis l'appareil`,
      }));

      // Reprise : la position n'est proposée que pour exactement le même fichier.
      try {
        const brut = window.localStorage.getItem(CLE_REPRISE);
        const memo = brut ? (JSON.parse(brut) as { empreinte?: string; lot?: number }) : null;
        setReprise(
          memo?.empreinte === empreinte(fichier, lue.type) && typeof memo.lot === "number"
            ? memo.lot
            : null,
        );
      } catch {
        setReprise(null);
      }

      setEtape("diagnostic");
    } catch (probleme) {
      setErreur(
        probleme instanceof RessourceIllisible
          ? probleme.message
          : probleme instanceof Error
            ? probleme.message
            : String(probleme),
      );
      setEtape("attente");
    }
  }, []);

  /* ── Étape 2 : écrire, après confirmation ── */

  const ecrire = useCallback(
    async (depuis: number) => {
      const lue = ressource;
      const fichier = fichierRef.current;
      if (!lue || !fichier) return;

      arret.current = false;
      setErreur(null);
      setEtape("ecriture");

      // Le découpage ne regarde que la position ; les entrées voyagent entières
      // vers le serveur, quel que soit leur type.
      const positions: { sourate: number; verset: number }[] = lue.entrees;
      const lots = lotsParVerset(positions, TAILLE_LOT);
      setLotsTotal(lots.length);
      setLotsFaits(depuis);

      // Repartir de zéro remet aussi les compteurs à zéro : sinon le rapport
      // additionnerait la tentative précédente à celle-ci.
      const cumul: BilanTotal =
        depuis === 0
          ? { ecrits: 0, versetsEcartes: 0, sansCorrespondance: 0, refusees: 0 }
          : { ...total };
      setTotal({ ...cumul });

      for (let i = depuis; i < lots.length; i += 1) {
        if (arret.current) {
          // Interrompre n'annule rien de ce qui est écrit : on retient la
          // position pour que le bouton propose la reprise sans avoir à
          // rechoisir le fichier.
          setReprise(i);
          setEtape("diagnostic");
          return;
        }

        const dernier = i === lots.length - 1;
        let reponse: ReponseLot | null = null;
        let dernierEchec = "";

        // Trois tentatives : une coupure de réseau sur tablette est banale, et
        // les écritures sont idempotentes — réessayer ne duplique rien.
        for (let essai = 0; essai < 3 && !reponse; essai += 1) {
          try {
            const requete = await fetch("/api/coran/import", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                type: lue.type,
                entrees: lots[i],
                edition: lue.type === "traduction" ? meta : undefined,
                clore: dernier,
              }),
            });
            const corps = (await requete.json()) as ReponseLot;
            if (!requete.ok) {
              dernierEchec = corps.erreur ?? `Le serveur a répondu ${requete.status}.`;
              if (requete.status < 500) break;
            } else {
              reponse = corps;
            }
          } catch (probleme) {
            dernierEchec = probleme instanceof Error ? probleme.message : String(probleme);
          }
          if (!reponse) await new Promise((r) => setTimeout(r, 1000 * (essai + 1)));
        }

        if (!reponse) {
          setErreur(
            `Lot ${i + 1} sur ${lots.length} : ${dernierEchec} ` +
              "Rien n'est perdu — la position est retenue, tu peux reprendre.",
          );
          try {
            window.localStorage.setItem(
              CLE_REPRISE,
              JSON.stringify({ empreinte: empreinte(fichier, lue.type), lot: i }),
            );
          } catch {
            // Un navigateur qui refuse le stockage local ne doit pas faire échouer
            // le dépôt : on perd la reprise, pas les données.
          }
          setReprise(i);
          setEtape("diagnostic");
          return;
        }

        cumul.ecrits += reponse.ecrits;
        cumul.versetsEcartes += reponse.versetsEcartes;
        cumul.sansCorrespondance += reponse.sansCorrespondance;
        cumul.refusees += reponse.refusees;
        setTotal({ ...cumul });
        setLotsFaits(i + 1);

        if (reponse.couverture) setCouverture(reponse.couverture);
        if (typeof reponse.versetsEdition === "number") {
          setVersetsEdition(reponse.versetsEdition);
        }

        try {
          window.localStorage.setItem(
            CLE_REPRISE,
            JSON.stringify({ empreinte: empreinte(fichier, lue.type), lot: i + 1 }),
          );
        } catch {
          // Idem : sans stockage local, seule la reprise disparaît.
        }
      }

      try {
        window.localStorage.removeItem(CLE_REPRISE);
      } catch {
        // Rien à faire : le dépôt est terminé de toute façon.
      }
      setReprise(null);
      setEtape("fini");
    },
    [ressource, meta, total],
  );

  useEffect(() => () => void (arret.current = true), []);

  const diagnostic = ressource?.diagnostic ?? null;
  const traduction = ressource?.type === "traduction";
  const metaComplete =
    !traduction ||
    (meta.nom.trim().length > 0 &&
      meta.auteur.trim().length > 0 &&
      meta.licence.trim().length > 0 &&
      /^[a-z0-9._-]{3,60}$/.test(meta.cle));

  return (
    <div className="flex flex-col gap-8">
      <ChoixFichier
        nom={nomFichier}
        occupe={etape === "lecture" || etape === "ecriture"}
        surChoix={(f) => void choisir(f)}
      />

      {erreur && (
        <p className="rounded-2xl border border-bordure-vive bg-surface p-4 text-[13px] leading-relaxed text-doux">
          {erreur}
        </p>
      )}

      {etape === "lecture" && (
        <p className="text-[13px] text-doux">Lecture du fichier…</p>
      )}

      {diagnostic && etape !== "fini" && (
        <FicheDiagnostic diagnostic={diagnostic} nom={nomFichier} />
      )}

      {diagnostic && traduction && etape === "diagnostic" && (
        <FormulaireEdition meta={meta} surChangement={setMeta} />
      )}

      {diagnostic && etape === "diagnostic" && (
        <section className="flex flex-col gap-3">
          {reprise !== null && reprise > 0 && (
            <p className="text-[12.5px] leading-relaxed text-doux">
              Un dépôt du même fichier s'était arrêté au lot {reprise}. Reprendre
              évite de tout réécrire ; recommencer du début ne fait pas de doublon
              non plus.
            </p>
          )}

          <button
            type="button"
            disabled={!metaComplete}
            onClick={() => void ecrire(reprise ?? 0)}
            className="flex min-h-14 items-center justify-center rounded-xl border border-bordure-vive bg-surface-haut text-[15px] text-texte disabled:opacity-40"
          >
            {reprise !== null && reprise > 0
              ? `Reprendre au lot ${reprise + 1}`
              : `Écrire ${diagnostic.entrees.toLocaleString("fr-FR")} entrées en base`}
          </button>

          {reprise !== null && reprise > 0 && (
            <button
              type="button"
              disabled={!metaComplete}
              onClick={() => void ecrire(0)}
              className="flex min-h-12 items-center justify-center rounded-xl border border-bordure text-[13.5px] text-doux disabled:opacity-40"
            >
              Recommencer depuis le début
            </button>
          )}

          {!metaComplete && (
            <p className="text-[12px] leading-relaxed text-tres-doux">
              Le nom, le traducteur et les conditions sont nécessaires : chaque écran
              qui affichera cette traduction doit pouvoir les citer.
            </p>
          )}
        </section>
      )}

      {(etape === "ecriture" || etape === "fini") && (
        <Avancement
          faits={lotsFaits}
          total={lotsTotal}
          bilan={total}
          fini={etape === "fini"}
          surArret={() => {
            arret.current = true;
          }}
        />
      )}

      {etape === "fini" && diagnostic && (
        <Rapport
          diagnostic={diagnostic}
          bilan={total}
          couverture={couverture}
          versetsEdition={versetsEdition}
        />
      )}
    </div>
  );
}

/* ──────────────────────────── Morceaux d'écran ──────────────────────────── */

function ChoixFichier({
  nom,
  occupe,
  surChoix,
}: {
  nom: string;
  occupe: boolean;
  surChoix: (fichier: File) => void;
}) {
  const entree = useRef<HTMLInputElement>(null);

  return (
    <section className="flex flex-col gap-3">
      <input
        ref={entree}
        type="file"
        accept=".json,.sqlite,.db,.sqlite3,.txt,.tsv,application/json,application/octet-stream,text/plain"
        className="hidden"
        onChange={(evenement) => {
          const fichier = evenement.target.files?.[0];
          if (fichier) surChoix(fichier);
          // Remettre à zéro permet de redéposer le même fichier après un échec.
          evenement.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={occupe}
        onClick={() => entree.current?.click()}
        className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-bordure-vive bg-surface px-5 py-4 text-center disabled:opacity-50"
      >
        <span className="text-[15px] text-texte">
          {nom ? "Choisir un autre fichier" : "Choisir un fichier"}
        </span>
        <span className="text-[12px] text-tres-doux">
          {nom || "JSON, base SQLite ou texte tabulé, depuis Fichiers"}
        </span>
      </button>
    </section>
  );
}

/** Ce que le fichier contient, avant que quoi que ce soit ne soit écrit. */
function FicheDiagnostic({ diagnostic, nom }: { diagnostic: Diagnostic; nom: string }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-bordure bg-surface p-4">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] tracking-[0.14em] text-tres-doux uppercase">
          Ce qui a été lu
        </span>
        <h2 className="text-[17px] leading-snug text-texte">{diagnostic.libelle}</h2>
        <p className="text-[12.5px] break-all text-tres-doux">
          {nom} — {diagnostic.format}
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
        <dt className="text-tres-doux">Structure</dt>
        <dd className="text-doux">{diagnostic.structure}</dd>
        <dt className="text-tres-doux">Entrées</dt>
        <dd className="text-doux tabular-nums">
          {diagnostic.entrees.toLocaleString("fr-FR")}
        </dd>
        {diagnostic.ignorees > 0 && (
          <>
            <dt className="text-tres-doux">Écartées</dt>
            <dd className="text-doux tabular-nums">
              {diagnostic.ignorees.toLocaleString("fr-FR")} — position ou texte illisibles
            </dd>
          </>
        )}
      </dl>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] tracking-[0.14em] text-tres-doux uppercase">
          Trois entrées réelles du fichier
        </span>
        {diagnostic.exemples.map((exemple) => (
          <div
            key={exemple.cle}
            className="flex flex-col gap-0.5 rounded-xl border border-bordure-vive p-3"
          >
            <span className="text-[11.5px] text-tres-doux tabular-nums">{exemple.cle}</span>
            <span className="text-[14px] leading-snug break-words text-texte">
              {exemple.valeur}
            </span>
          </div>
        ))}
        <p className="text-[11.5px] leading-relaxed text-tres-doux">
          La première, celle du milieu, la dernière. Si l'une d'elles ne correspond
          pas à sa référence, le fichier est décalé : n'écris pas.
        </p>
      </div>

      {diagnostic.avertissements.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {diagnostic.avertissements.map((mot) => (
            <li key={mot} className="text-[12.5px] leading-relaxed text-doux">
              {mot}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11.5px] leading-relaxed text-tres-doux">
        À l'écriture, chaque verset est comparé au texte de Tanzil déjà en base. Un
        verset dont le compte de mots ne tombe pas est écarté entier : un mot sans
        correspondance reste sans sens, il n'en reçoit jamais un approché.
      </p>
    </section>
  );
}

function FormulaireEdition({
  meta,
  surChangement,
}: {
  meta: MetaEdition;
  surChangement: (meta: MetaEdition) => void;
}) {
  const modifier = (champModifie: keyof MetaEdition) => (valeur: string) =>
    surChangement({ ...meta, [champModifie]: valeur });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          D'où vient cette traduction
        </h2>
        <p className="text-[12px] leading-relaxed text-tres-doux">
          Une traduction de versets s'affiche à côté du texte : elle doit pouvoir
          être attribuée partout où elle apparaît. Recopie les conditions telles que
          la source les énonce, sans les reformuler.
        </p>
      </div>

      {(
        [
          ["nom", "Nom de la traduction", "Le Noble Coran, traduction des sens"],
          ["auteur", "Traducteur", "Nom du traducteur"],
          ["langue", "Langue (code)", "fr"],
          ["cle", "Identifiant en base", "depot.ma-traduction"],
        ] as const
      ).map(([nom, libelle, exemple]) => (
        <label key={nom} className="flex flex-col gap-1.5">
          <span className={etiquette}>{libelle}</span>
          <input
            value={meta[nom]}
            onChange={(evenement) => modifier(nom)(evenement.target.value)}
            placeholder={exemple}
            className={champ}
          />
        </label>
      ))}

      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Conditions d'utilisation</span>
        <textarea
          value={meta.licence}
          onChange={(evenement) => modifier("licence")(evenement.target.value)}
          rows={4}
          placeholder="Recopiées telles que la source les énonce"
          className={`${champ} min-h-28 py-3 leading-relaxed`}
        />
      </label>
    </section>
  );
}

function Avancement({
  faits,
  total,
  bilan,
  fini,
  surArret,
}: {
  faits: number;
  total: number;
  bilan: BilanTotal;
  fini: boolean;
  surArret: () => void;
}) {
  const part = total > 0 ? Math.round((100 * faits) / total) : 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-doux">
          {fini ? "Dépôt terminé" : `Lot ${faits} sur ${total}`}
        </span>
        <span className="text-[13px] text-tres-doux tabular-nums">{part} %</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-surface-haut">
        <div
          className="h-full rounded-full bg-[#c0996a] transition-[width] duration-300"
          style={{ width: `${part}%` }}
        />
      </div>

      <p className="text-[12.5px] text-tres-doux tabular-nums">
        {bilan.ecrits.toLocaleString("fr-FR")} entrées écrites.
      </p>

      {!fini && (
        <button
          type="button"
          onClick={surArret}
          className="flex min-h-12 items-center justify-center rounded-xl border border-bordure text-[13.5px] text-doux"
        >
          Interrompre — ce qui est écrit reste écrit
        </button>
      )}
    </section>
  );
}

/** Le compte final : ce qui a reçu quelque chose, et ce qui n'a rien reçu. */
function Rapport({
  diagnostic,
  bilan,
  couverture,
  versetsEdition,
}: {
  diagnostic: Diagnostic;
  bilan: BilanTotal;
  couverture: Couverture | null;
  versetsEdition: number | null;
}) {
  const motAMot = diagnostic.type === "mot_a_mot";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-bordure-vive bg-surface p-4">
      <h2 className="police-titre text-[22px] leading-tight">Rapport</h2>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[13.5px]">
        <dt className="text-doux">
          {motAMot ? "Mots ayant reçu un sens" : "Entrées écrites"}
        </dt>
        <dd className="text-texte tabular-nums">
          {bilan.ecrits.toLocaleString("fr-FR")}
        </dd>

        {bilan.versetsEcartes > 0 && (
          <>
            <dt className="text-doux">Versets écartés, non alignés</dt>
            <dd className="text-texte tabular-nums">
              {bilan.versetsEcartes.toLocaleString("fr-FR")}
            </dd>
          </>
        )}

        {bilan.sansCorrespondance > 0 && (
          <>
            <dt className="text-doux">Entrées sans correspondance</dt>
            <dd className="text-texte tabular-nums">
              {bilan.sansCorrespondance.toLocaleString("fr-FR")}
            </dd>
          </>
        )}

        {bilan.refusees > 0 && (
          <>
            <dt className="text-doux">Entrées refusées à l'entrée</dt>
            <dd className="text-texte tabular-nums">
              {bilan.refusees.toLocaleString("fr-FR")}
            </dd>
          </>
        )}

        {versetsEdition !== null && (
          <>
            <dt className="text-doux">Versets de cette édition en base</dt>
            <dd className="text-texte tabular-nums">
              {versetsEdition.toLocaleString("fr-FR")}
            </dd>
          </>
        )}
      </dl>

      {couverture && couverture.motsTexte > 0 && (
        <div className="flex flex-col gap-2 border-t border-bordure pt-3">
          <span className="text-[11px] tracking-[0.14em] text-tres-doux uppercase">
            Sur l'ensemble du texte
          </span>
          <p className="text-[13.5px] leading-relaxed text-doux tabular-nums">
            {couverture.avecSens.toLocaleString("fr-FR")} mots ont un sens,{" "}
            {couverture.sansSens.toLocaleString("fr-FR")} n'en ont pas, sur{" "}
            {couverture.motsTexte.toLocaleString("fr-FR")} mots du texte arabe.
          </p>
          <p className="text-[11.5px] leading-relaxed text-tres-doux">
            Les mots restés sans sens le restent : rien n'a été approché ni deviné
            pour combler le compte.
          </p>
        </div>
      )}

      {motAMot && (
        <p className="text-[11.5px] leading-relaxed text-tres-doux">
          {GLOSE_DEPOSEE.mention} Ce crédit apparaît désormais sous chaque sens
          affiché en lecture.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <a
          href="/coran/lire"
          className="flex min-h-12 items-center justify-center rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte"
        >
          Ouvrir la lecture
        </a>
        <a
          href="/coran/reglages"
          className="flex min-h-12 items-center justify-center rounded-xl border border-bordure text-[13.5px] text-doux"
        >
          Revenir aux réglages
        </a>
      </div>
    </section>
  );
}
