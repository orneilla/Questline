import type { NextRequest } from "next/server";

import { versCsv } from "@/lib/cartes/csv";
import { exporterCartes } from "@/lib/cartes/edition";
import { aujourdhui } from "@/lib/dates";

/**
 * Export des cartes, en JSON ou en CSV.
 *
 * Le JSON conserve tout — mémoire FSRS comprise — et sert de sauvegarde
 * complète. Le CSV ne garde que ce qu'Anki sait relire : recto, verso,
 * étiquettes. Le second est une porte de sortie, pas une sauvegarde ; c'est
 * dit sur l'écran qui propose les deux.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(requete: NextRequest): Promise<Response> {
  const format = requete.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const lignes = await exporterCartes();
  const jour = aujourdhui();

  if (format === "csv") {
    const csv = versCsv([
      ["recto", "verso", "tags", "espace", "paquet"],
      ...lignes.map((l) => [
        l.recto,
        l.verso,
        l.tags.join(" "),
        l.espace,
        l.paquet,
      ]),
    ]);

    return new Response(`﻿${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="questline-cartes-${jour}.csv"`,
      },
    });
  }

  const contenu = {
    application: "Questline",
    version: 1,
    exporteLe: new Date().toISOString(),
    cartes: lignes,
  };

  return new Response(JSON.stringify(contenu, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="questline-cartes-${jour}.json"`,
    },
  });
}
