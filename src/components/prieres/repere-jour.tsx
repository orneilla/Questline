"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { lignesDuJour, repere } from "@/lib/prieres/partage";
import type { Reperes } from "@/lib/prieres/astronomie";
import { minutesLocales } from "@/lib/dates";

/**
 * Le repère des prières sur l'écran du jour.
 *
 * Une ligne, pas une section. Elle dit où l'on en est dans la journée — la
 * prière en cours, ou la prochaine et son heure — et mène à l'écran du suivi.
 *
 * Elle ne compte rien et ne coche rien : cocher se fait sur l'écran dédié.
 * Les cinq points disent ce qui est fait, sans total ni couleur d'alerte —
 * cinq points vides sont un affichage possible comme un autre.
 */
export function ReperePrieres({
  reperes,
  faites,
}: {
  reperes: Reperes;
  faites: string[];
}) {
  const [maintenant, setMaintenant] = useState<number | null>(null);

  // Lue au navigateur seulement : le serveur et l'écran ne liraient pas l'heure
  // au même instant, et le repère sauterait au premier rendu.
  useEffect(() => {
    const relire = () => setMaintenant(minutesLocales());
    relire();
    const battement = setInterval(relire, 60_000);
    return () => clearInterval(battement);
  }, []);

  const lignes = lignesDuJour(reperes, faites, maintenant);
  const texte = repere(lignes, maintenant);

  return (
    <Link
      href="/prieres"
      className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-bordure bg-surface px-5 transition-colors duration-300 active:bg-surface-haut"
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[14px] text-texte">Prières</span>
        {texte && (
          <span className="truncate text-[12px] text-tres-doux tabular-nums">{texte}</span>
        )}
      </span>

      <span aria-hidden className="flex shrink-0 items-center gap-1.5">
        {lignes.map((ligne) => (
          <span
            key={ligne.cle}
            className="size-[7px] rounded-full"
            style={{
              backgroundColor: ligne.faite ? "var(--color-doux)" : "transparent",
              border: ligne.faite ? "none" : "1px solid var(--color-bordure-vive)",
            }}
          />
        ))}
      </span>
    </Link>
  );
}
