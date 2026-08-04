import type { Metadata } from "next";

import { EcranInstallation } from "@/components/ecran-installation";
import { Notifications } from "@/components/reglages/notifications";
import { Retour } from "@/components/retour";
import { diagnostiquer } from "@/lib/erreurs";
import { derniersEnvois } from "@/lib/notifications/envoi";
import { abonnements } from "@/lib/notifications/push";
import { chargerReglagesRappels } from "@/lib/notifications/reglages";
import { identiteBot, variablesPresentes } from "@/lib/telegram/api";

/**
 * Rappels et diagnostic.
 *
 * Tout ce qu'il faut pour comprendre pourquoi un rappel n'est pas arrivé, sans
 * accès aux journaux du serveur : l'état de la permission, les appareils
 * abonnés avec leur dernière erreur, la réponse de Telegram à `getMe`, la
 * présence de chaque variable — jamais le jeton — et la date du dernier envoi
 * réussi de chaque créneau sur chaque canal.
 */

export const metadata: Metadata = { title: "Questline — Rappels" };
export const dynamic = "force-dynamic";

const LIBELLES_ENVOIS: Record<string, string> = {
  "push:matin": "Notification du matin",
  "push:soir": "Notification du soir",
  matin: "Telegram — matin",
  soir: "Telegram — soir",
  bilan: "Telegram — bilan du dimanche",
};

function quand(iso: string | undefined): string {
  if (!iso) return "jamais";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

export default async function PageNotifications() {
  let reglages: Awaited<ReturnType<typeof chargerReglagesRappels>>;
  let appareils: Awaited<ReturnType<typeof abonnements>>;
  let envois: Record<string, string>;

  try {
    [reglages, appareils, envois] = await Promise.all([
      chargerReglagesRappels(),
      abonnements(),
      derniersEnvois(),
    ]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const variables = variablesPresentes();
  // L'appel réseau ne doit pas empêcher la page de s'afficher : il est fait
  // seulement si un jeton existe, et son échec est un résultat, pas une panne.
  const bot = variables.jeton ? await identiteBot() : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-9 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/reglages" libelle="Réglages" />
        <h1 className="police-titre text-[34px] leading-none">Rappels</h1>
        <p className="text-[13px] leading-relaxed text-doux">
          Deux rappels par jour, par le canal de ton choix. L'application ne compte
          pas sur le fait qu'on pense à l'ouvrir.
        </p>
      </header>

      <Notifications
        reglages={{
          canal: reglages.canal,
          matinActif: reglages.matinActif,
          soirActif: reglages.soirActif,
          heureMatin: reglages.heureMatin,
          heureSoir: reglages.heureSoir,
          pauseJusqua: reglages.pauseJusqua,
        }}
        appareils={appareils.map((a) => ({
          id: a.id,
          agent: a.agent,
          dernierEnvoi: a.dernierEnvoi ? quand(a.dernierEnvoi) : null,
          derniereErreur: a.derniereErreur,
        }))}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">Telegram</h2>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-bordure bg-surface p-4 text-[13px]">
          <dt className="text-tres-doux">Jeton</dt>
          <dd className="text-doux">
            {variables.jeton ? variables.empreinteJeton : "absent"}
          </dd>
          <dt className="text-tres-doux">Conversation</dt>
          <dd className="text-doux">{variables.salon ? "renseignée" : "absente"}</dd>
          <dt className="text-tres-doux">CRON_SECRET</dt>
          <dd className="text-doux">{variables.cronSecret ? "renseignée" : "absente"}</dd>
          <dt className="text-tres-doux">Le bot répond</dt>
          <dd className="text-doux">
            {bot === null
              ? "non interrogé — jeton absent"
              : bot.ok
                ? `${bot.nom} ${bot.identifiant}`
                : bot.raison}
          </dd>
        </dl>

        {!variables.cronSecret && (
          <p className="text-[12.5px] leading-relaxed text-doux">
            Sans <code className="text-[11.5px]">CRON_SECRET</code>, le déclencheur
            planifié répond 500 avant même de regarder l'heure : aucun rappel ne peut
            partir, sur aucun canal. C'est la première chose à renseigner dans Vercel.
          </p>
        )}

        <p className="text-[11.5px] leading-relaxed text-tres-doux">
          Commandes du bot : <code className="text-[11px]">/aujourdhui</code>,{" "}
          <code className="text-[11px]">/fait 2</code>,{" "}
          <code className="text-[11px]">/cartes</code>,{" "}
          <code className="text-[11px]">/pause 3</code>. Tout autre texte devient la
          phrase du soir. Seule ta conversation est acceptée.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Derniers envois réussis
        </h2>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-xl border border-bordure bg-surface p-4 text-[13px]">
          {Object.entries(LIBELLES_ENVOIS).map(([cle, libelle]) => (
            <div key={cle} className="contents">
              <dt className="text-tres-doux">{libelle}</dt>
              <dd className="text-right text-doux tabular-nums">{quand(envois[cle])}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[11.5px] leading-relaxed text-tres-doux">
          « Jamais » sur toutes les lignes signifie que le déclencheur ne s'exécute
          pas — vérifie les tâches planifiées et <code className="text-[11px]">CRON_SECRET</code>{" "}
          dans Vercel. Un envoi réussi sur un canal et pas sur l'autre isole le
          problème au canal.
        </p>
      </section>
    </main>
  );
}
