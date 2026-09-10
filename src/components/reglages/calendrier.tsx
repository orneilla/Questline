"use client";

import { useState, useTransition } from "react";

import {
  actionAjouterCalendrier,
  actionBasculerCalendrier,
  actionRelireCalendriers,
  actionRetirerCalendrier,
  type Retour,
} from "@/app/(app)/reglages/calendrier-actions";
import { champ, etiquette } from "@/components/reglages/briques";
import type { FicheCalendrier } from "@/lib/calendrier/abonnements";
import { formaterDateLongue } from "@/lib/dates";

/**
 * Abonnements aux calendriers extérieurs.
 *
 * L'adresse d'un calendrier publié vaut lecture : la montrer en entier à
 * l'écran l'exposerait à toute personne regardant par-dessus l'épaule. On n'en
 * affiche donc que le début et la fin, assez pour reconnaître lequel c'est.
 */

function abreger(url: string): string {
  try {
    const u = new URL(url);
    const chemin = u.pathname.length > 14 ? `…${u.pathname.slice(-8)}` : u.pathname;
    return `${u.host}${chemin}`;
  } catch {
    return url.slice(0, 40);
  }
}

function quand(iso: string | null): string {
  if (!iso) return "jamais relu";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "jamais relu";
  return `${formaterDateLongue(d.toISOString().slice(0, 10))} à ${d
    .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    .replace(":", " h ")}`;
}

function Fiche({ calendrier }: { calendrier: FicheCalendrier }) {
  const [retour, setRetour] = useState<Retour>({});
  const [actif, setActif] = useState(calendrier.actif);
  const [confirme, setConfirme] = useState(false);
  const [enAttente, demarrer] = useTransition();

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border border-bordure p-4"
      style={{ opacity: actif ? 1 : 0.6 }}
    >
      <span className="text-[15px] text-texte">{calendrier.nom || "Calendrier"}</span>
      <span className="text-[12px] break-all text-tres-doux">
        {abreger(calendrier.url)}
      </span>

      <p className="text-[12.5px] leading-relaxed text-tres-doux">
        {calendrier.dernierResultat ? (
          <span className="text-doux">{calendrier.dernierResultat}</span>
        ) : (
          <>
            {calendrier.nbOccurrences} créneau
            {calendrier.nbOccurrences > 1 ? "x" : ""} du{" "}
            {formaterDateLongue(calendrier.fenetre.debut)} au{" "}
            {formaterDateLongue(calendrier.fenetre.fin)}. Relu {quand(calendrier.derniereMaj)}.
            {calendrier.reglesIgnorees > 0 && (
              <>
                {" "}
                {calendrier.reglesIgnorees} répétition
                {calendrier.reglesIgnorees > 1 ? "s" : ""} trop complexe
                {calendrier.reglesIgnorees > 1 ? "s" : ""} pour être déroulée
                {calendrier.reglesIgnorees > 1 ? "s" : ""} : ces événements
                n&apos;apparaissent qu&apos;à leur date de départ.
              </>
            )}
          </>
        )}
      </p>

      <div className="mt-1 flex gap-2">
        <button
          type="button"
          disabled={enAttente}
          onClick={() =>
            demarrer(async () => {
              const suivant = !actif;
              setActif(suivant);
              setRetour(await actionBasculerCalendrier(calendrier.id, suivant));
            })
          }
          className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux transition-colors duration-300 active:bg-surface-haut disabled:opacity-40"
        >
          {actif ? "Mettre de côté" : "Reprendre en compte"}
        </button>
      </div>

      {confirme ? (
        <div className="flex flex-col gap-2 rounded-xl border border-bordure-vive p-3">
          <p className="text-[12.5px] leading-relaxed text-doux">
            L&apos;abonnement et ses créneaux importés partent. Ton calendrier Apple,
            lui, n&apos;est pas touché : Questline ne l&apos;a jamais qu&apos;en
            lecture.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirme(false)}
              className="min-h-11 flex-1 rounded-xl border border-bordure text-[13px] text-doux"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={enAttente}
              onClick={() =>
                demarrer(async () => {
                  setRetour(await actionRetirerCalendrier(calendrier.id));
                  setConfirme(false);
                })
              }
              className="min-h-11 flex-1 rounded-xl border border-bordure-vive bg-surface-haut text-[13px] text-texte disabled:opacity-50"
            >
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirme(true)}
          className="min-h-10 self-start text-left text-[12.5px] text-tres-doux transition-colors duration-300 active:text-doux"
        >
          Retirer cet abonnement
        </button>
      )}

      <p aria-live="polite" className="min-h-4 text-[12px] text-tres-doux">
        {retour.erreur ?? retour.message ?? ""}
      </p>
    </div>
  );
}

export function Calendriers({ calendriers }: { calendriers: FicheCalendrier[] }) {
  const [url, setUrl] = useState("");
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {calendriers.map((c) => (
        <Fiche key={c.id} calendrier={c} />
      ))}

      {calendriers.length > 0 && (
        <button
          type="button"
          disabled={enAttente}
          onClick={() => demarrer(async () => setRetour(await actionRelireCalendriers()))}
          className="min-h-12 rounded-xl border border-bordure text-[13.5px] text-doux transition-colors duration-300 active:bg-surface-haut disabled:opacity-40"
        >
          {enAttente ? "…" : "Relire maintenant"}
        </button>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-bordure px-5 py-4">
        <span className={etiquette}>Ajouter un calendrier</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="webcal://… ou https://…"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={champ}
        />
        <button
          type="button"
          disabled={enAttente || url.trim().length === 0}
          onClick={() =>
            demarrer(async () => {
              setRetour(await actionAjouterCalendrier(url));
              setUrl("");
            })
          }
          className="min-h-12 rounded-xl border border-bordure-vive bg-surface-haut text-[15px] text-texte disabled:opacity-40"
        >
          {enAttente ? "…" : "S'abonner"}
        </button>
      </div>

      <p aria-live="polite" className="min-h-4 text-[12.5px] text-doux">
        {retour.erreur ?? retour.message ?? ""}
      </p>
    </div>
  );
}
