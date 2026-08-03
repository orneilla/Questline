import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { COULEURS_PILIERS, LIBELLES_PILIERS, MOIS } from "@/lib/constantes";
import { formaterDateLongue } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";
import { chargerSaisonsArchivees, type SaisonArchivee } from "@/lib/saisons";
import { chargerParcours, type LigneParcours } from "@/lib/seuils";

export const metadata: Metadata = { title: "Questline — Parcours" };
export const dynamic = "force-dynamic";

function intervalle(debut: string, fin: string): string {
  const [, moisD, jourD] = debut.split("-").map(Number);
  const [, moisF, jourF] = fin.split("-").map(Number);
  return moisD === moisF
    ? `${jourD} – ${jourF} ${MOIS[moisF - 1]}`
    : `${jourD} ${MOIS[moisD - 1]} – ${jourF} ${MOIS[moisF - 1]}`;
}

export default async function PageParcours() {
  let seuils: LigneParcours[];
  let saisons: SaisonArchivee[];

  try {
    [seuils, saisons] = await Promise.all([
      chargerParcours(),
      chargerSaisonsArchivees(),
    ]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-9 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/bilan" libelle="Bilan" />
        <h1 className="police-titre text-[34px] leading-none">Parcours</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          La seule page qui regarde loin en arrière. Les seuils franchis et les
          saisons closes, dans l'ordre où ils sont arrivés.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Seuils franchis
        </h2>

        {seuils.length === 0 ? (
          <p className="rounded-2xl border border-bordure/60 px-5 py-6 text-center text-[14px] leading-relaxed text-doux">
            Aucun seuil pour l'instant. Le premier arrive à 10 % d'un arc.
          </p>
        ) : (
          <ol className="flex flex-col">
            {seuils.map((ligne, index) => {
              const couleur = COULEURS_PILIERS[ligne.pilier];
              return (
                <li key={ligne.id} className="flex gap-4">
                  {/* Filet vertical : la trajectoire, littéralement. */}
                  <div className="flex w-3 shrink-0 flex-col items-center">
                    <span
                      aria-hidden
                      className="h-2 w-px"
                      style={{
                        backgroundColor: index === 0 ? "transparent" : "var(--color-bordure)",
                      }}
                    />
                    <span
                      aria-hidden
                      className="size-[7px] shrink-0 rounded-full"
                      style={{ backgroundColor: couleur }}
                    />
                    <span
                      aria-hidden
                      className="w-px flex-1"
                      style={{
                        backgroundColor:
                          index === seuils.length - 1 ? "transparent" : "var(--color-bordure)",
                      }}
                    />
                  </div>

                  <div className="flex flex-1 flex-col gap-0.5 pb-6">
                    <span className="text-[11.5px] tracking-[0.14em] text-tres-doux uppercase">
                      {formaterDateLongue(ligne.atteintLe)}
                    </span>
                    <span className="text-[16px] leading-snug text-texte">
                      {ligne.arcNom} — {ligne.seuil} %
                    </span>
                    <span className="text-[12px]" style={{ color: couleur }}>
                      {LIBELLES_PILIERS[ligne.pilier]}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Saisons closes
        </h2>

        {saisons.length === 0 ? (
          <p className="rounded-2xl border border-bordure/60 px-5 py-6 text-center text-[14px] leading-relaxed text-doux">
            Aucune saison close. La première se clôt après quatre semaines.
          </p>
        ) : (
          <ul className="flex flex-col gap-6">
            {saisons.map((saison) => (
              <li key={saison.numero} className="flex flex-col gap-2">
                <span className="text-[11.5px] tracking-[0.14em] text-tres-doux uppercase">
                  Saison {saison.numero} · {intervalle(saison.debut, saison.fin)}
                </span>
                <p className="police-titre text-[16.5px] leading-relaxed text-doux">
                  {saison.question}
                </p>
                {saison.reponse ? (
                  <p className="border-l border-bordure-vive pl-4 text-[15px] leading-relaxed text-texte">
                    {saison.reponse}
                  </p>
                ) : (
                  <p className="text-[13px] text-tres-doux">Sans réponse.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
