"use client";

import { useActionState, useState, useTransition } from "react";

import {
  actionConventions,
  actionDecalages,
  actionLieu,
  actionRappelPriere,
  actionRappelsPrieres,
  type Retour,
} from "@/app/(app)/prieres/actions";
import { Bascule, Envoyer, Retourner, champ, etiquette } from "@/components/reglages/briques";
import { CONVENTIONS, type CleConvention } from "@/lib/prieres/astronomie";
import { PRIERES } from "@/lib/prieres/partage";
import type { ReglagesPrieres } from "@/db/schema";

/**
 * Les réglages du suivi des prières.
 *
 * ── Ce que l'écran assume
 *
 * Tout ce qui relève d'un choix religieux est présenté comme tel : la
 * convention est nommée avec l'institution qui la publie, l'école pour l'Asr
 * est nommée, la règle des nuits courtes est nommée. Rien n'est appliqué en
 * douce, et rien n'est présenté comme « le » bon réglage.
 *
 * ── Le lieu
 *
 * Demandé par un bouton plutôt que par deux champs de chiffres : personne ne
 * connaît sa longitude de tête, et taper des coordonnées sur une tablette est
 * une corvée. La saisie manuelle reste là pour le cas où la localisation est
 * refusée — ou simplement pas souhaitée.
 */

/* ────────────────────── Le lieu ────────────────────── */

function ChampsLieu({ reglages }: { reglages: ReglagesPrieres }) {
  const [etat, action] = useActionState<Retour, FormData>(actionLieu, {});
  const [latitude, setLatitude] = useState(reglages.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(reglages.longitude?.toString() ?? "");
  const [lieu, setLieu] = useState(reglages.lieu);
  const [recherche, setRecherche] = useState<string | null>(null);

  function demanderPosition() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setRecherche("Cet appareil ne propose pas la localisation. Entre les coordonnées à la main.");
      return;
    }
    setRecherche("Recherche de la position…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(5));
        setLongitude(position.coords.longitude.toFixed(5));
        setRecherche("Position trouvée. Enregistre pour l'appliquer.");
      },
      (erreur) => {
        setRecherche(
          erreur.code === erreur.PERMISSION_DENIED
            ? "Localisation refusée. Tu peux entrer les coordonnées à la main juste en dessous."
            : `Position introuvable : ${erreur.message}`,
        );
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 3_600_000 },
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <button
        type="button"
        onClick={demanderPosition}
        className="min-h-12 w-full rounded-xl border border-bordure-vive bg-surface-haut text-[15px] text-texte transition-colors duration-300 active:bg-bordure"
      >
        Utiliser ma position
      </button>

      {recherche && (
        <p aria-live="polite" className="text-[12.5px] leading-relaxed text-tres-doux">
          {recherche}
        </p>
      )}

      <p className="text-[12px] leading-relaxed text-tres-doux">
        La position sert au calcul et reste sur ton serveur. Elle n&apos;est envoyée
        à personne, et un quartier près suffit : quelques kilomètres ne changent
        pas la minute affichée.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Nom du lieu</span>
        <input
          name="lieu"
          value={lieu}
          onChange={(e) => setLieu(e.target.value)}
          placeholder="Pour t'y reconnaître — ex. Lyon"
          maxLength={80}
          className={champ}
        />
      </label>

      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={etiquette}>Latitude</span>
          <input
            name="latitude"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            inputMode="decimal"
            required
            placeholder="45.75"
            className={champ}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={etiquette}>Longitude</span>
          <input
            name="longitude"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            inputMode="decimal"
            required
            placeholder="4.85"
            className={champ}
          />
        </label>
      </div>

      <Envoyer />
      <Retourner etat={etat} />
    </form>
  );
}

/* ────────────────────── Conventions ────────────────────── */

/**
 * Chaque champ porte la valeur enregistrée comme clé.
 *
 * Sans cela l'écran se contredisait : après un enregistrement, la liste
 * affichait encore « majorité » pendant que l'aperçu, juste au-dessus, montrait
 * déjà l'heure hanafite. Mesuré, et non supposé : le composant recevait bien la
 * nouvelle valeur, mais le champ gardait celle posée à son montage.
 *
 * La clé règle les deux cas d'un coup. Tant que la base ne bouge pas, le champ
 * reste tel quel et garde ce qui est en train d'être saisi ; dès qu'elle
 * change, le champ est recréé sur la valeur enregistrée. Un réglage qui se
 * contredit lui-même est pire que pas de réglage du tout.
 */
function ChoixConventions({ reglages }: { reglages: ReglagesPrieres }) {
  const [etat, action] = useActionState<Retour, FormData>(actionConventions, {});
  const [convention, setConvention] = useState(reglages.convention);

  const fiche = CONVENTIONS[convention as CleConvention] ?? CONVENTIONS.uoif;

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Convention de calcul</span>
        <select
          key={reglages.convention}
          name="convention"
          defaultValue={reglages.convention}
          onChange={(e) => setConvention(e.target.value)}
          className={champ}
        >
          {(Object.keys(CONVENTIONS) as CleConvention[]).map((cle) => (
            <option key={cle} value={cle}>
              {CONVENTIONS[cle].nom}
            </option>
          ))}
        </select>
      </label>
      <p className="-mt-1 text-[12px] leading-relaxed text-tres-doux">
        Publiée par {fiche.source}. Les degrés sont la hauteur du soleil sous
        l&apos;horizon à l&apos;entrée du Fajr et de l&apos;Isha : plus l&apos;angle
        est grand, plus le Fajr est tôt et l&apos;Isha tard.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Asr</span>
        <select key={reglages.ecoleAsr} name="ecoleAsr" defaultValue={reglages.ecoleAsr} className={champ}>
          <option value="majorite">Ombre égale à l&apos;objet (majorité)</option>
          <option value="hanafite">Ombre double de l&apos;objet (hanafite)</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={etiquette}>Nuits trop courtes</span>
        <select key={reglages.nuitCourte} name="nuitCourte" defaultValue={reglages.nuitCourte} className={champ}>
          <option value="angle">Proportion de la nuit selon l&apos;angle</option>
          <option value="septieme">Un septième de la nuit</option>
          <option value="moitie">Milieu de la nuit</option>
          <option value="aucune">Aucune règle — laisser vide</option>
        </select>
      </label>
      <p className="-mt-1 text-[12px] leading-relaxed text-tres-doux">
        En France, de fin mai à mi-juillet, le soleil ne descend jamais assez bas
        pour que le Fajr et l&apos;Isha aient une heure calculable. Ces règles
        posent alors un repère à partir de la longueur de la nuit. Sans règle,
        l&apos;écran laisse la case vide au lieu d&apos;écrire un chiffre qui ne
        veut rien dire.
      </p>

      <Envoyer />
      <Retourner etat={etat} />
    </form>
  );
}

/* ────────────────────── Corrections ────────────────────── */

function Corrections({ reglages }: { reglages: ReglagesPrieres }) {
  const [etat, action] = useActionState<Retour, FormData>(actionDecalages, {});

  const valeurs: Record<string, number> = {
    fajr: reglages.decalageFajr,
    dhuhr: reglages.decalageDhuhr,
    asr: reglages.decalageAsr,
    maghrib: reglages.decalageMaghrib,
    isha: reglages.decalageIsha,
  };

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-[12px] leading-relaxed text-tres-doux">
        En minutes, de -30 à +30. Compare une fois avec le calendrier de ta
        mosquée : si le Maghrib y est deux minutes plus tard, mets +2 et
        l&apos;écart disparaît pour toute l&apos;année.
      </p>

      {PRIERES.map((priere) => (
        <label key={priere.cle} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-[14px] text-doux">{priere.nom}</span>
          <input
            key={valeurs[priere.cle]}
            name={priere.cle}
            type="number"
            min={-30}
            max={30}
            step={1}
            defaultValue={valeurs[priere.cle]}
            inputMode="numeric"
            className={`${champ} text-center tabular-nums`}
          />
        </label>
      ))}

      <Envoyer />
      <Retourner etat={etat} />
    </form>
  );
}

/* ────────────────────── Rappels ────────────────────── */

function Rappels({ reglages }: { reglages: ReglagesPrieres }) {
  const [retour, setRetour] = useState<Retour>({});
  const [, demarrer] = useTransition();

  const actifs: Record<string, boolean> = {
    fajr: reglages.rappelFajr,
    dhuhr: reglages.rappelDhuhr,
    asr: reglages.rappelAsr,
    maghrib: reglages.rappelMaghrib,
    isha: reglages.rappelIsha,
  };

  return (
    <div className="flex flex-col gap-3">
      <Bascule
        actif={reglages.rappelsActifs}
        libelleActif="Rappels allumés"
        libelleInactif="Rappels éteints"
        action={async (suivant) => {
          setRetour(await actionRappelsPrieres(suivant));
        }}
      />

      <p className="text-[12px] leading-relaxed text-tres-doux">
        Le message dit le nom de la prière et son heure. Rien d&apos;autre : pas
        de relance, pas de compte de ce qui manque. Une prière déjà cochée ne
        déclenche rien.
      </p>

      {reglages.rappelsActifs && (
        <div className="flex flex-col gap-2">
          {PRIERES.map((priere) => (
            <label
              key={priere.cle}
              className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-bordure px-4"
            >
              <span className="text-[14px] text-doux">{priere.nom}</span>
              <input
                type="checkbox"
                defaultChecked={actifs[priere.cle]}
                onChange={(evenement) => {
                  const suivant = evenement.target.checked;
                  demarrer(async () => {
                    setRetour(await actionRappelPriere(priere.cle, suivant));
                  });
                }}
                className="size-5 accent-[color:var(--color-doux)]"
              />
            </label>
          ))}
        </div>
      )}

      <Retourner etat={retour} />
    </div>
  );
}

/* ────────────────────── L'écran ────────────────────── */

function Section({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">{titre}</h2>
      {children}
    </section>
  );
}

export function ReglagesPrieresEcran({
  reglages,
  ponctualite,
}: {
  reglages: ReglagesPrieres;
  /** Ce que le déclencheur planifié permet vraiment. Dit tel quel. */
  ponctualite: string;
}) {
  return (
    <div className="flex flex-col gap-9">
      <Section titre="Lieu">
        <ChampsLieu reglages={reglages} />
      </Section>

      <Section titre="Conventions">
        <ChoixConventions reglages={reglages} />
      </Section>

      <Section titre="Corrections">
        <Corrections reglages={reglages} />
      </Section>

      <Section titre="Rappels">
        <Rappels reglages={reglages} />
        <p className="rounded-xl border border-bordure bg-surface px-4 py-3 text-[12px] leading-relaxed text-tres-doux">
          {ponctualite}
        </p>
      </Section>
    </div>
  );
}
