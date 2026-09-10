import Link from "next/link";

import { PRIERES } from "@/lib/prieres/partage";
import type { JourDuMois } from "@/lib/prieres/donnees";

/**
 * Le mois en cours, jour par jour.
 *
 * ── Ce qu'il n'y a pas
 *
 * Aucun total en bas de colonne, aucun pourcentage, aucune série, aucune
 * couleur qui dirait qu'un jour vaut moins qu'un autre. Un point plein, un
 * point vide. La lecture s'arrête au mois : rien ne s'accumule sur des années,
 * donc il n'y a pas de courbe à faire monter.
 *
 * ── Pourquoi c'est cliquable
 *
 * Une prière rattrapée le soir se coche le soir, et un jour qu'on a oublié de
 * remplir se corrige. Toucher un jour l'ouvre ; l'application ne juge pas de
 * quand un geste a eu lieu.
 */

export function Mois({
  libelle,
  jours,
  dateChoisie,
}: {
  libelle: string;
  jours: JourDuMois[];
  dateChoisie: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">{libelle}</h2>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-fond pb-2 text-left font-normal text-tres-doux">
                <span className="sr-only">Jour</span>
              </th>
              {PRIERES.map((priere) => (
                <th
                  key={priere.cle}
                  scope="col"
                  className="pb-2 text-center font-normal text-tres-doux"
                >
                  {priere.nom.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jours.map((jour) => {
              const choisi = jour.date === dateChoisie;
              return (
                <tr key={jour.date}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-fond py-0.5 pr-2 text-left font-normal"
                  >
                    <Link
                      href={`/prieres?jour=${jour.date}`}
                      scroll={false}
                      aria-current={choisi ? "date" : undefined}
                      className="flex min-h-8 min-w-9 items-center justify-center rounded-lg px-1.5 tabular-nums transition-colors duration-200"
                      style={{
                        backgroundColor: choisi ? "var(--color-surface-haut)" : "transparent",
                        color: jour.avenir
                          ? "var(--color-bordure-vive)"
                          : choisi
                            ? "var(--color-texte)"
                            : "var(--color-tres-doux)",
                      }}
                    >
                      {jour.numero}
                    </Link>
                  </th>

                  {PRIERES.map((priere) => {
                    const faite = jour.faites.includes(priere.cle);
                    return (
                      <td key={priere.cle} className="py-0.5 text-center">
                        <span
                          aria-label={
                            faite ? `${priere.nom} cochée` : `${priere.nom} non cochée`
                          }
                          className="inline-block size-[9px] rounded-full"
                          style={{
                            backgroundColor: faite ? "var(--color-doux)" : "transparent",
                            border: faite
                              ? "none"
                              : `1px solid ${
                                  jour.avenir
                                    ? "var(--color-bordure)"
                                    : "var(--color-bordure-vive)"
                                }`,
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11.5px] leading-relaxed text-tres-doux">
        Touche un jour pour l&apos;ouvrir et le corriger. Le mois précédent n&apos;est
        pas conservé.
      </p>
    </section>
  );
}
