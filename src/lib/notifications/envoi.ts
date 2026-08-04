import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { messagesEnvoyes } from "@/db/schema";
import { cartesDues } from "@/lib/cartes/donnees";
import { aujourdhui } from "@/lib/dates";
import { chargerJour } from "@/lib/jour";
import { chargerTaches } from "@/lib/taches";
import { envoyerMessage, type TypeMessage } from "@/lib/telegram/envoi";
import { envoyerPush, type ChargePush, type ResultatEnvoi } from "./push";
import { chargerReglagesRappels, enPause } from "./reglages";

/**
 * Les rappels, quel que soit le canal qui les porte.
 *
 * Deux canaux coexistent : les notifications de Questline et le bot Telegram.
 * Ce fichier décide lequel — ou les deux — puis compose et envoie. Telegram n'a
 * rien perdu au passage : son module est intact, appelé tel quel, et reste
 * utilisable seul.
 *
 * ── Le ton
 *
 * Le même que partout : on annonce, on constate, on ne pousse pas. Une journée
 * sans rien de coché reçoit exactement le même égard qu'une autre. Il n'y a ni
 * série brisée, ni retard souligné, ni relance.
 *
 * ── L'idempotence
 *
 * Elle est portée par `messages_envoyes`, avec une clé par canal :
 * `matin` pour Telegram, `push:matin` pour les notifications. Un déclencheur
 * qui passe deux fois n'envoie donc qu'une fois par canal et par jour, et un
 * canal en panne n'empêche pas l'autre de partir.
 */

export type Creneau = "matin" | "soir";

export type BilanCanal = {
  envoye: boolean;
  raison: string;
  detail?: ResultatEnvoi;
};

export type BilanCreneau = {
  creneau: Creneau;
  push?: BilanCanal;
  telegram?: BilanCanal;
};

/* ───────────────────────────── Composition ───────────────────────────── */

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

/**
 * Le rappel du matin.
 *
 * Les quêtes du jour avec leur pilier, les tâches en attente, les cartes dues.
 * Le lien mène à l'écran du jour, parce que c'est de là qu'on agit.
 */
export async function composerPushMatin(): Promise<ChargePush> {
  const [etat, dues, taches] = await Promise.all([
    chargerJour(),
    cartesDues(),
    chargerTaches(),
  ]);

  const lignes: string[] = [];

  if (etat.quetesDuJour.length === 0) {
    lignes.push(
      etat.quetesFaites.length > 0
        ? "Tout est déjà fait pour aujourd'hui."
        : "Rien de prévu aujourd'hui.",
    );
  } else {
    for (const quete of etat.quetesDuJour) {
      lignes.push(`· ${quete.titre} — ${quete.pilier}`);
    }
  }

  const annexes: string[] = [];
  if (taches.ouvertes.length > 0) {
    annexes.push(pluriel(taches.ouvertes.length, "tâche") + " en attente");
  }
  if (dues > 0) annexes.push(pluriel(dues, "carte") + " à réviser");
  if (annexes.length > 0) lignes.push(annexes.join(" · "));

  return {
    titre: etat.charge.recuperation ? "Journée allégée" : "Aujourd'hui",
    corps: lignes.join("\n"),
    url: "/jour",
    etiquette: "questline-matin",
  };
}

/**
 * Le rappel du soir.
 *
 * Ce qui a été validé, ce qui reste. Rien de plus : pas de bilan chiffré, pas
 * de comparaison, et surtout aucune formule qui ferait d'une journée creuse un
 * échec.
 */
export async function composerPushSoir(): Promise<ChargePush> {
  const [etat, taches] = await Promise.all([chargerJour(), chargerTaches()]);

  const faites = etat.quetesFaites.length + (etat.queteRareFaite ? 1 : 0);
  const restantes = etat.quetesDuJour.length;
  const lignes: string[] = [];

  if (faites === 0) {
    lignes.push("Rien de coché aujourd'hui. Le momentum s'érode à peine, il tient.");
  } else {
    lignes.push(etat.quetesFaites.map((q) => `✓ ${q.titre}`).join("\n"));
    if (etat.queteRareFaite && etat.queteRare) {
      lignes.push(`◇ ${etat.queteRare.texte}`);
    }
  }

  const reste: string[] = [];
  if (restantes > 0) reste.push(pluriel(restantes, "quête") + " non cochée");
  if (taches.ouvertes.length > 0) {
    reste.push(pluriel(taches.ouvertes.length, "tâche") + " ouverte");
  }
  if (reste.length > 0) lignes.push(reste.join(" · ") + ".");

  return {
    titre: "Fin de journée",
    corps: lignes.join("\n"),
    url: "/jour",
    etiquette: "questline-soir",
  };
}

const COMPOSITEURS: Record<Creneau, () => Promise<ChargePush>> = {
  matin: composerPushMatin,
  soir: composerPushSoir,
};

/* ───────────────────────────── Idempotence ───────────────────────────── */

async function dejaEnvoye(date: string, cle: string): Promise<boolean> {
  const [ligne] = await db
    .select({ type: messagesEnvoyes.type })
    .from(messagesEnvoyes)
    .where(and(eq(messagesEnvoyes.date, date), eq(messagesEnvoyes.type, cle)))
    .limit(1);
  return Boolean(ligne);
}

async function consigner(date: string, cle: string): Promise<void> {
  await db
    .insert(messagesEnvoyes)
    .values({ date, type: cle, envoyeLe: new Date().toISOString(), messageId: null })
    .onConflictDoNothing();
}

/** Quand chaque canal a réussi pour la dernière fois, par créneau. */
export async function derniersEnvois(): Promise<Record<string, string>> {
  const lignes = await db
    .select({ type: messagesEnvoyes.type, envoyeLe: messagesEnvoyes.envoyeLe })
    .from(messagesEnvoyes)
    .orderBy(messagesEnvoyes.envoyeLe);

  const derniers: Record<string, string> = {};
  for (const ligne of lignes) {
    // Les crédits de piliers passent par la même table : ils n'ont rien à faire
    // dans un état des envois.
    if (ligne.type.startsWith("credit:")) continue;
    derniers[ligne.type] = ligne.envoyeLe;
  }
  return derniers;
}

/* ───────────────────────────── Envoi ───────────────────────────── */

/**
 * Envoie un créneau sur les canaux choisis.
 *
 * `forcer` court-circuite l'idempotence et la pause : c'est ce qu'utilisent les
 * boutons de test, qui doivent partir même si le message du jour est déjà passé.
 */
export async function envoyerCreneau(
  creneau: Creneau,
  options: { forcer?: boolean } = {},
): Promise<BilanCreneau> {
  const date = aujourdhui();
  const reglages = await chargerReglagesRappels();
  const bilan: BilanCreneau = { creneau };

  if (!options.forcer && enPause(reglages, date)) {
    return {
      creneau,
      push: { envoye: false, raison: `en pause jusqu'au ${reglages.pauseJusqua}` },
    };
  }

  const actif = creneau === "matin" ? reglages.matinActif : reglages.soirActif;
  if (!options.forcer && !actif) {
    return { creneau, push: { envoye: false, raison: "créneau désactivé" } };
  }

  const versPush = reglages.canal === "push" || reglages.canal === "les_deux";
  const versTelegram = reglages.canal === "telegram" || reglages.canal === "les_deux";

  if (versPush) {
    const cle = `push:${creneau}`;
    if (!options.forcer && (await dejaEnvoye(date, cle))) {
      bilan.push = { envoye: false, raison: "déjà envoyé aujourd'hui" };
    } else {
      const resultat = await envoyerPush(await COMPOSITEURS[creneau]());
      if (resultat.envoyes > 0) {
        if (!options.forcer) await consigner(date, cle);
        bilan.push = {
          envoye: true,
          raison: `${resultat.envoyes} appareil(s)`,
          detail: resultat,
        };
      } else {
        bilan.push = {
          envoye: false,
          raison:
            resultat.echecs[0]?.raison ??
            "aucun appareil abonné — active les notifications depuis les réglages",
          detail: resultat,
        };
      }
    }
  }

  if (versTelegram) {
    const resultat = await envoyerMessage(creneau as TypeMessage, {
      forcer: options.forcer,
    });
    bilan.telegram = { envoye: resultat.envoye, raison: resultat.raison };
  }

  return bilan;
}
