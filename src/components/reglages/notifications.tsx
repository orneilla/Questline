"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import {
  actionReglagesRappels,
  actionTestCanal,
  type BilanTest,
} from "@/app/(app)/reglages/notifications/actions";
import { champ, etiquette } from "@/components/reglages/briques";
import type { Canal } from "@/db/schema";

/**
 * Notifications de Questline.
 *
 * ── Le moment de la demande
 *
 * Jamais au premier lancement. Une permission demandée avant qu'on sache à quoi
 * elle sert est une permission refusée, et un refus sur iOS ne se redemande pas
 * : il faut passer par les réglages du système. L'écran explique donc d'abord
 * ce que la permission déclenche — deux rappels par jour, aux heures choisies —
 * et ne la demande qu'au toucher explicite.
 *
 * ── iOS
 *
 * Safari n'accorde le push web que si l'application est installée sur l'écran
 * d'accueil. Tant qu'elle tourne dans l'onglet, `PushManager` n'existe même
 * pas. On le détecte et l'on explique comment installer, plutôt que d'échouer
 * sur une erreur incompréhensible.
 *
 * ── Ce qui peut se défaire
 *
 * La permission peut être révoquée depuis le système, et l'abonnement peut
 * expirer sans prévenir. Les deux sont relus à chaque affichage, et l'écran dit
 * l'état réel plutôt que celui qu'il espère.
 */

type Etat =
  | "inconnu"
  | "non_supporte"
  | "ios_non_installe"
  | "refuse"
  | "a_demander"
  | "abonne";

export type ReglagesAffiches = {
  canal: Canal;
  matinActif: boolean;
  soirActif: boolean;
  heureMatin: number;
  heureSoir: number;
  pauseJusqua: string | null;
};

const CANAUX: { valeur: Canal; libelle: string; detail: string }[] = [
  { valeur: "push", libelle: "Notifications", detail: "Questline seule." },
  { valeur: "telegram", libelle: "Telegram", detail: "Le bot seul." },
  { valeur: "les_deux", libelle: "Les deux", detail: "Chaque rappel sur les deux canaux." },
];

function enHeure(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function enMinutes(heure: string): number {
  const [h, m] = heure.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Vrai quand la page tourne comme application installée, pas dans un onglet. */
function installee(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function estIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS se présente comme un Mac depuis la 13.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** La clé VAPID arrive en base64url ; `subscribe` veut des octets. */
function enOctets(base64url: string): Uint8Array {
  const complement = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + complement).replace(/-/g, "+").replace(/_/g, "/");
  const brut = window.atob(base64);
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  return octets;
}

export function Notifications({
  reglages,
  appareils,
}: {
  reglages: ReglagesAffiches;
  appareils: { id: number; agent: string; dernierEnvoi: string | null; derniereErreur: string | null }[];
}) {
  const [etat, setEtat] = useState<Etat>("inconnu");
  const [message, setMessage] = useState<string | null>(null);
  const [enAttente, demarrer] = useTransition();

  const [canal, setCanal] = useState<Canal>(reglages.canal);
  const [matin, setMatin] = useState(reglages.matinActif);
  const [soir, setSoir] = useState(reglages.soirActif);
  const [heureMatin, setHeureMatin] = useState(enHeure(reglages.heureMatin));
  const [heureSoir, setHeureSoir] = useState(enHeure(reglages.heureSoir));
  const [test, setTest] = useState<BilanTest | null>(null);

  const relire = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setEtat(estIOS() && !installee() ? "ios_non_installe" : "non_supporte");
      return;
    }

    if (Notification.permission === "denied") {
      setEtat("refuse");
      return;
    }

    try {
      const enregistrement = await navigator.serviceWorker.getRegistration("/sw.js");
      const abonnement = await enregistrement?.pushManager.getSubscription();
      setEtat(abonnement && Notification.permission === "granted" ? "abonne" : "a_demander");
    } catch {
      setEtat("a_demander");
    }
  }, []);

  useEffect(() => {
    void relire();
  }, [relire]);

  async function activer() {
    setMessage(null);
    try {
      const enregistrement = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEtat(permission === "denied" ? "refuse" : "a_demander");
        setMessage(
          permission === "denied"
            ? "Permission refusée. Elle se redonne depuis les réglages du système, " +
              "pas depuis ici — iOS ne la redemande pas."
            : "Permission non accordée.",
        );
        return;
      }

      const reponse = await fetch("/api/push/cle");
      const { cle, erreur } = (await reponse.json()) as { cle?: string; erreur?: string };
      if (!cle) throw new Error(erreur ?? "Clé publique indisponible.");

      // Un abonnement existant posé avec une autre clé doit partir d'abord,
      // sinon `subscribe` échoue sur un conflit de clé applicative.
      const ancien = await enregistrement.pushManager.getSubscription();
      if (ancien) {
        const memeCle =
          ancien.options.applicationServerKey &&
          new Uint8Array(ancien.options.applicationServerKey).every(
            (octet, i) => octet === enOctets(cle)[i],
          );
        if (!memeCle) await ancien.unsubscribe();
      }

      const abonnement =
        (await enregistrement.pushManager.getSubscription()) ??
        (await enregistrement.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: enOctets(cle) as BufferSource,
        }));

      const envoi = await fetch("/api/push/abonner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          abonnement: abonnement.toJSON(),
          agent: navigator.userAgent,
        }),
      });
      if (!envoi.ok) {
        const corps = (await envoi.json()) as { erreur?: string };
        throw new Error(corps.erreur ?? `Le serveur a répondu ${envoi.status}.`);
      }

      setEtat("abonne");
      setMessage("Cet appareil recevra les rappels.");
    } catch (probleme) {
      setMessage(probleme instanceof Error ? probleme.message : String(probleme));
      await relire();
    }
  }

  async function desactiver() {
    setMessage(null);
    try {
      const enregistrement = await navigator.serviceWorker.getRegistration("/sw.js");
      const abonnement = await enregistrement?.pushManager.getSubscription();
      if (abonnement) {
        await fetch("/api/push/desabonner", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: abonnement.endpoint }),
        });
        await abonnement.unsubscribe();
      }
      setEtat("a_demander");
      setMessage("Cet appareil ne recevra plus rien.");
    } catch (probleme) {
      setMessage(probleme instanceof Error ? probleme.message : String(probleme));
    }
  }

  function enregistrer() {
    demarrer(async () => {
      await actionReglagesRappels({
        canal,
        matinActif: matin,
        soirActif: soir,
        heureMatin: enMinutes(heureMatin),
        heureSoir: enMinutes(heureSoir),
      });
      setMessage("Réglages enregistrés.");
    });
  }

  return (
    <div className="flex flex-col gap-9">
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Notifications de Questline
        </h2>
        <EtatPush
          etat={etat}
          surActivation={() => void activer()}
          surDesactivation={() => void desactiver()}
        />
        {message && (
          <p className="text-[12.5px] leading-relaxed text-doux">{message}</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Canal</h2>
        <p className="-mt-2 text-[12px] leading-relaxed text-tres-doux">
          Telegram reste en place. Ce réglage dit seulement par où les rappels
          arrivent ; rien n'est supprimé quand on change d'avis.
        </p>

        <div className="flex flex-col gap-2">
          {CANAUX.map((c) => {
            const choisi = canal === c.valeur;
            return (
              <button
                key={c.valeur}
                type="button"
                onClick={() => setCanal(c.valeur)}
                aria-pressed={choisi}
                className="flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 text-left transition-colors duration-200"
                style={{
                  borderColor: choisi
                    ? "var(--color-bordure-vive)"
                    : "var(--color-bordure)",
                  backgroundColor: choisi ? "var(--color-surface-haut)" : "transparent",
                }}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] text-texte">{c.libelle}</span>
                  <span className="text-[12px] text-tres-doux">{c.detail}</span>
                </span>
                {choisi && (
                  <span aria-hidden className="text-[15px] text-doux">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Créneaux</h2>

        <Creneau
          libelle="Matin"
          aide="Les quêtes du jour, les tâches en attente, les cartes dues."
          actif={matin}
          surBascule={setMatin}
          heure={heureMatin}
          surHeure={setHeureMatin}
        />
        <Creneau
          libelle="Soir"
          aide="Ce qui a été validé, ce qui reste. Sans reproche."
          actif={soir}
          surBascule={setSoir}
          heure={heureSoir}
          surHeure={setHeureSoir}
        />

        <p className="text-[11.5px] leading-relaxed text-tres-doux">
          Les horaires sont en heure de Paris. Le déclencheur de Vercel n'est pas
          garanti à la minute sur le palier gratuit : un rappel peut arriver dans
          l'heure qui suit, jamais avant.
        </p>

        {reglages.pauseJusqua && (
          <p className="text-[12.5px] leading-relaxed text-doux">
            Rappels en pause jusqu'au {reglages.pauseJusqua} inclus.
          </p>
        )}

        <button
          type="button"
          disabled={enAttente}
          onClick={enregistrer}
          className="min-h-12 rounded-xl border border-bordure-vive bg-surface-haut text-[15px] text-texte disabled:opacity-50"
        >
          {enAttente ? "…" : "Enregistrer"}
        </button>
      </section>

      <Diagnostic
        appareils={appareils}
        etatPush={etat}
        test={test}
        surTest={(quoi) =>
          demarrer(async () => setTest(await actionTestCanal(quoi)))
        }
        enAttente={enAttente}
      />
    </div>
  );
}

/* ───────────────────────────── Pièces ───────────────────────────── */

function EtatPush({
  etat,
  surActivation,
  surDesactivation,
}: {
  etat: Etat;
  surActivation: () => void;
  surDesactivation: () => void;
}) {
  if (etat === "inconnu") {
    return <p className="text-[13px] text-tres-doux">Vérification…</p>;
  }

  if (etat === "ios_non_installe") {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-bordure-vive bg-surface p-4">
        <p className="text-[14px] leading-relaxed text-texte">
          Installe Questline sur l'écran d'accueil pour recevoir des notifications.
        </p>
        <p className="text-[12.5px] leading-relaxed text-doux">
          Sur iPad, Safari n'autorise les notifications web que pour une
          application installée. Dans Safari : le bouton <b>Partager</b>, puis{" "}
          <b>Sur l'écran d'accueil</b>. Ouvre ensuite Questline depuis l'icône, et
          reviens ici — le bouton d'activation apparaîtra.
        </p>
        <p className="text-[12px] leading-relaxed text-tres-doux">
          En attendant, le bot Telegram fonctionne : choisis « Telegram » comme
          canal ci-dessous.
        </p>
      </div>
    );
  }

  if (etat === "non_supporte") {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-bordure bg-surface p-4">
        <p className="text-[14px] leading-relaxed text-texte">
          Ce navigateur ne gère pas les notifications web.
        </p>
        <p className="text-[12.5px] leading-relaxed text-doux">
          Le bot Telegram reste disponible : choisis-le comme canal ci-dessous.
        </p>
      </div>
    );
  }

  if (etat === "refuse") {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-bordure bg-surface p-4">
        <p className="text-[14px] leading-relaxed text-texte">
          Les notifications sont refusées pour Questline.
        </p>
        <p className="text-[12.5px] leading-relaxed text-doux">
          Le navigateur ne redemandera pas. Sur iPad : <b>Réglages</b> →{" "}
          <b>Notifications</b> → <b>Questline</b>, puis autorise. Reviens ensuite
          ici et touche « Activer ».
        </p>
      </div>
    );
  }

  if (etat === "abonne") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-bordure bg-surface p-4">
        <p className="text-[14px] leading-relaxed text-texte">
          Cet appareil est abonné.
        </p>
        <button
          type="button"
          onClick={surDesactivation}
          className="min-h-12 rounded-xl border border-bordure text-[13.5px] text-doux"
        >
          Ne plus recevoir sur cet appareil
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-bordure bg-surface p-4">
      <p className="text-[14px] leading-relaxed text-texte">
        Recevoir deux rappels par jour, de Questline.
      </p>
      <p className="text-[12.5px] leading-relaxed text-doux">
        Le matin, les quêtes du jour et ce qui attend. Le soir, ce qui a été fait.
        Rien d'autre : aucune relance, aucune alerte, et jamais quand tu es en
        pause. Toucher le bouton demandera la permission au système.
      </p>
      <button
        type="button"
        onClick={surActivation}
        className="min-h-12 rounded-xl border border-bordure-vive bg-surface-haut text-[14px] text-texte"
      >
        Activer les notifications
      </button>
    </div>
  );
}

function Creneau({
  libelle,
  aide,
  actif,
  surBascule,
  heure,
  surHeure,
}: {
  libelle: string;
  aide: string;
  actif: boolean;
  surBascule: (actif: boolean) => void;
  heure: string;
  surHeure: (heure: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-bordure p-4">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={actif}
          onChange={(evenement) => surBascule(evenement.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[#6fa396]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] text-texte">{libelle}</span>
          <span className="text-[12px] leading-relaxed text-tres-doux">{aide}</span>
        </span>
      </label>

      <label className="flex items-center justify-between gap-3">
        <span className={etiquette}>Heure</span>
        <input
          type="time"
          value={heure}
          onChange={(evenement) => surHeure(evenement.target.value)}
          className={`${champ} w-[8.5rem]`}
        />
      </label>
    </div>
  );
}

/* ───────────────────────────── Diagnostic ───────────────────────────── */

function Diagnostic({
  appareils,
  etatPush,
  test,
  surTest,
  enAttente,
}: {
  appareils: { id: number; agent: string; dernierEnvoi: string | null; derniereErreur: string | null }[];
  etatPush: Etat;
  test: BilanTest | null;
  surTest: (quoi: "push" | "telegram") => void;
  enAttente: boolean;
}) {
  const [permission, setPermission] = useState<string>("—");

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, [etatPush]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Diagnostic</h2>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-bordure bg-surface p-4 text-[13px]">
        <dt className="text-tres-doux">Permission</dt>
        <dd className="text-doux">{permission}</dd>
        <dt className="text-tres-doux">Cet appareil</dt>
        <dd className="text-doux">{etatPush === "abonne" ? "abonné" : "non abonné"}</dd>
        <dt className="text-tres-doux">Appareils abonnés</dt>
        <dd className="text-doux tabular-nums">{appareils.length}</dd>
      </dl>

      {appareils.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {appareils.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-0.5 rounded-xl border border-bordure p-3"
            >
              <span className="truncate text-[12.5px] text-doux">{a.agent || "appareil"}</span>
              <span className="text-[11.5px] text-tres-doux">
                {a.dernierEnvoi ? `dernier envoi ${a.dernierEnvoi}` : "aucun envoi encore"}
              </span>
              {a.derniereErreur && (
                <span className="text-[11.5px] leading-relaxed text-doux">
                  {a.derniereErreur}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={enAttente}
          onClick={() => surTest("push")}
          className="min-h-12 flex-1 rounded-xl border border-bordure text-[13.5px] text-doux disabled:opacity-40"
        >
          Tester les notifications
        </button>
        <button
          type="button"
          disabled={enAttente}
          onClick={() => surTest("telegram")}
          className="min-h-12 flex-1 rounded-xl border border-bordure text-[13.5px] text-doux disabled:opacity-40"
        >
          Tester Telegram
        </button>
      </div>

      {test && <RapportTest test={test} />}
    </section>
  );
}

function RapportTest({ test }: { test: BilanTest }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-bordure-vive bg-surface p-4">
      <p className="text-[13.5px] leading-relaxed text-texte">
        {test.reussi ? "Envoyé." : "Pas envoyé."}
      </p>
      <p className="text-[12.5px] leading-relaxed break-words text-doux">{test.detail}</p>

      {test.lignes.length > 0 && (
        <ul className="flex flex-col gap-1">
          {test.lignes.map((ligne) => (
            <li key={ligne} className="text-[11.5px] leading-relaxed break-words text-tres-doux">
              {ligne}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
