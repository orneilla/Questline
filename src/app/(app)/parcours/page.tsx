import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { EntreeJournal } from "@/components/parcours/entree-journal";
import { MOIS } from "@/lib/constantes";
import { chargerPiliers } from "@/lib/piliers";
import { couleurPilier, nomPilier, type PilierAffiche } from "@/lib/piliers-partage";
import { formaterDateLongue } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";
import { chargerPhrases, type PhraseJournal } from "@/lib/journal";
import { chargerSaisonsArchivees, type SaisonArchivee } from "@/lib/saisons";
import { chargerParcours, type LigneParcours } from "@/lib/seuils";

export const metadata: Metadata = { title: "Questline — Parcours" };
export const dynamic = "force-dynamic";

/**
 * Les phrases rangées par mois, le plus récent d'abord.
 *
 * Une longue liste de dates nues se lit mal ; les mois donnent des paliers à
 * l'œil sans rien ajouter au texte.
 */
function parMois(phrases: PhraseJournal[]) {
  const groupes: { cle: string; libelle: string; phrases: PhraseJournal[] }[] = [];

  for (const phrase of phrases) {
    const [annee, mois] = phrase.date.split("-");
    const cle = `${annee}-${mois}`;
    const dernier = groupes[groupes.length - 1];
    if (dernier?.cle === cle) {
      dernier.phrases.push(phrase);
      continue;
    }
    groupes.push({
      cle,
      libelle: `${MOIS[Number(mois) - 1]} ${annee}`,
      phrases: [phrase],
    });
  }

  return groupes;
}

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
  let phrases: PhraseJournal[];
  let listePiliers: PilierAffiche[];

  try {
    [seuils, saisons, phrases, listePiliers] = await Promise.all([
      chargerParcours(),
      chargerSaisonsArchivees(),
      chargerPhrases(),
      chargerPiliers(),
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
          La seule page qui regarde loin en arrière. Les phrases du soir, les seuils
          franchis et les saisons closes, dans l'ordre où ils sont arrivés.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Phrases du soir
        </h2>

        {phrases.length === 0 ? (
          <p className="rounded-2xl border border-bordure/60 px-5 py-6 text-center text-[14px] leading-relaxed text-doux">
            Aucune phrase pour l'instant. Celles écrites le soir se retrouvent ici,
            de la plus récente à la plus ancienne, et se corrigent sur place.
          </p>
        ) : (
          <ul className="flex flex-col gap-6">
            {parMois(phrases).map((mois) => (
              <li key={mois.cle} className="flex flex-col gap-3">
                <span className="text-[11.5px] tracking-[0.14em] text-tres-doux uppercase">
                  {mois.libelle}
                </span>
                <ul className="flex flex-col gap-4">
                  {mois.phrases.map((phrase) => (
                    <li key={phrase.date} className="flex flex-col gap-1">
                      <span className="text-[11.5px] text-tres-doux">
                        {formaterDateLongue(phrase.date)}
                      </span>
                      {/* Le texte tel qu'il a été écrit, retours à la ligne compris. */}
                      <EntreeJournal
                        texte={phrase.texte}
                        cle={{ type: "phrase", date: phrase.date }}
                        limite={2000}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

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
              const couleur = couleurPilier(listePiliers, ligne.pilier);
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
                      {nomPilier(listePiliers, ligne.pilier)}
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
                  <EntreeJournal
                    texte={saison.reponse}
                    cle={{ type: "saison", numero: saison.numero }}
                    limite={4000}
                  />
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
