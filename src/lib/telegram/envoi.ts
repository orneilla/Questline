import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { messagesEnvoyes } from "@/db/schema";
import { chargerBilan } from "@/lib/bilan";
import { libelleCharge } from "@/lib/charge";
import { LIBELLES_PILIERS, MOIS } from "@/lib/constantes";
import { aujourdhui, formaterDateLongue } from "@/lib/dates";
import { chargerJour } from "@/lib/jour";
import { texteDuTitre } from "@/lib/recit";
import { saisonCourante } from "@/lib/saisons";
import { echapper, envoyer, type Bouton } from "./api";

/**
 * Composition et envoi des trois messages.
 *
 * Le ton suit celui de l'app : on annonce, on constate, on ne pousse pas. Une
 * journée sans rien de validé reçoit exactement le même égard qu'une autre.
 */

export type TypeMessage = "matin" | "soir" | "bilan";

/** Un message n'est envoyé qu'une fois par jour et par type. */
async function dejaEnvoye(date: string, type: TypeMessage): Promise<boolean> {
  const [ligne] = await db
    .select({ type: messagesEnvoyes.type })
    .from(messagesEnvoyes)
    .where(and(eq(messagesEnvoyes.date, date), eq(messagesEnvoyes.type, type)))
    .limit(1);
  return Boolean(ligne);
}

async function consigner(
  date: string,
  type: TypeMessage,
  messageId: number | null,
): Promise<void> {
  await db
    .insert(messagesEnvoyes)
    .values({ date, type, envoyeLe: new Date().toISOString(), messageId })
    .onConflictDoNothing();
}

function capitale(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/* ---------------------------------- Matin ---------------------------------- */

export async function composerMatin() {
  const etat = await chargerJour();
  const cycle = await saisonCourante();

  const lignes: string[] = [];

  lignes.push(`<b>${echapper(texteDuTitre(etat.titre))}</b>`);
  lignes.push(
    `${capitale(formaterDateLongue(etat.date))} · ${echapper(libelleCharge(etat.charge))}`,
  );
  lignes.push(`<i>Saison ${cycle.numero}, jour ${cycle.jourDansLaSaison}</i>`);

  // Lendemain de nuit : on ouvre autrement. Le shift du samedi finit à 1 h,
  // donc le dimanche tombe systématiquement dans ce cas.
  if (etat.charge.recuperation) {
    lignes.push("");
    lignes.push(
      "La nuit a été entamée. La journée est allégée d'office — rien à rattraper.",
    );
  }

  lignes.push("");

  if (etat.quetesDuJour.length === 0) {
    lignes.push(
      etat.quetesFaites.length > 0
        ? "Tout est déjà fait pour aujourd'hui."
        : "Rien de prévu aujourd'hui. C'est un jour valable aussi.",
    );
  } else {
    etat.quetesDuJour.forEach((quete, index) => {
      const duree = quete.dureeMin > 0 ? `${quete.dureeMin} min` : "au fil du jour";
      lignes.push(`${index + 1}. ${echapper(quete.titre)} — <i>${duree}</i>`);
    });
  }

  if (etat.queteRare && !etat.queteRareFaite) {
    lignes.push("");
    lignes.push(`◇ <i>De passage</i> — ${echapper(etat.queteRare.texte)}`);
    lignes.push("<i>Facultative. Elle disparaît à minuit.</i>");
  }

  const boutons: Bouton[] = etat.quetesDuJour.map((quete, index) => ({
    texte: `${index + 1} ✓`,
    donnee: `v:${quete.id}`,
  }));

  if (etat.queteRare && !etat.queteRareFaite) {
    boutons.push({ texte: "◇ ✓", donnee: "r" });
  }
  if (!etat.journee.modeBas) {
    boutons.push({ texte: "Jour bas", donnee: "b" });
  }

  return { texte: lignes.join("\n"), boutons };
}

/* ----------------------------------- Soir ---------------------------------- */

export async function composerSoir() {
  const etat = await chargerJour();
  const lignes: string[] = [];

  if (etat.quetesFaites.length === 0 && !etat.queteRareFaite) {
    // Aucun reproche, aucune relance : la question, et c'est tout.
    lignes.push("<b>Fin de journée</b>");
    lignes.push("");
    lignes.push("Rien de coché aujourd'hui. Le momentum s'érode à peine, il tient.");
  } else {
    lignes.push("<b>Ce qui a été fait</b>");
    lignes.push("");
    for (const faite of etat.quetesFaites) {
      lignes.push(`✓ ${echapper(faite.titre)}`);
    }
    if (etat.queteRareFaite && etat.queteRare) {
      lignes.push(`◇ ${echapper(etat.queteRare.texte)}`);
    }
  }

  lignes.push("");
  lignes.push("<i>Une phrase sur la journée ? Réponds à ce message.</i>");

  return { texte: lignes.join("\n"), boutons: [] as Bouton[] };
}

/* ---------------------------------- Bilan ---------------------------------- */

function intervalle(debut: string, fin: string): string {
  const [, moisD, jourD] = debut.split("-").map(Number);
  const [, moisF, jourF] = fin.split("-").map(Number);
  return moisD === moisF
    ? `${jourD} – ${jourF} ${MOIS[moisF - 1]}`
    : `${jourD} ${MOIS[moisD - 1]} – ${jourF} ${MOIS[moisF - 1]}`;
}

export async function composerBilan() {
  const bilan = await chargerBilan();
  const lignes: string[] = [];

  lignes.push(`<b>Semaine du ${intervalle(bilan.debut, bilan.fin)}</b>`);
  lignes.push("");

  if (bilan.total === 0) {
    lignes.push("Aucune validation cette semaine. Rien n'est remis à zéro pour autant.");
  } else {
    const delta = bilan.total - bilan.totalAvant;
    const ecart =
      delta === 0
        ? "autant que la semaine passée"
        : `${delta > 0 ? "+" : "−"} ${Math.abs(delta)} par rapport à la semaine passée`;
    lignes.push(
      `${bilan.total} validation${bilan.total > 1 ? "s" : ""} sur ${bilan.joursActifs} jour${bilan.joursActifs > 1 ? "s" : ""}, ${ecart}.`,
    );
    lignes.push("");

    for (const ligne of bilan.parPilier.filter((l) => l.validations > 0)) {
      lignes.push(
        `${LIBELLES_PILIERS[ligne.pilier]} · ${ligne.validations} · ${ligne.points} pts`,
      );
    }
  }

  if (bilan.plusDelaisse) {
    lignes.push("");
    lignes.push(
      `<i>${LIBELLES_PILIERS[bilan.plusDelaisse]} est resté le plus silencieux — il passera devant.</i>`,
    );
  }

  if (bilan.joursBas.length > 0) {
    lignes.push("");
    lignes.push(
      `${bilan.joursBas.length} jour${bilan.joursBas.length > 1 ? "s" : ""} bas cette semaine.`,
    );
  }

  return { texte: lignes.join("\n"), boutons: [] as Bouton[] };
}

/* ---------------------------------- Envoi ---------------------------------- */

const COMPOSITEURS = {
  matin: composerMatin,
  soir: composerSoir,
  bilan: composerBilan,
} as const;

export type Resultat = { envoye: boolean; raison: string };

/**
 * Compose puis envoie. Si Telegram ne répond pas, rien n'est consigné : le
 * prochain déclenchement retentera, et l'application n'en sait rien.
 */
export async function envoyerMessage(
  type: TypeMessage,
  options: { forcer?: boolean } = {},
): Promise<Resultat> {
  const date = aujourdhui();

  if (!options.forcer && (await dejaEnvoye(date, type))) {
    return { envoye: false, raison: "déjà envoyé aujourd'hui" };
  }

  const { texte, boutons } = await COMPOSITEURS[type]();
  const messageId = await envoyer(texte, boutons);

  if (messageId === null) {
    return { envoye: false, raison: "Telegram injoignable" };
  }

  await consigner(date, type, messageId);
  return { envoye: true, raison: "envoyé" };
}

/** Identifiant du message du matin, pour en rafraîchir les boutons. */
export async function messageDuMatin(date: string): Promise<number | null> {
  const [ligne] = await db
    .select({ messageId: messagesEnvoyes.messageId })
    .from(messagesEnvoyes)
    .where(and(eq(messagesEnvoyes.date, date), eq(messagesEnvoyes.type, "matin")))
    .limit(1);
  return ligne?.messageId ?? null;
}
