import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { ReglagesPrieresEcran } from "@/components/prieres/reglages";
import { chargerReglagesPrieres, reperesPour } from "@/lib/prieres/donnees";
import { formaterHeure, PRIERES } from "@/lib/prieres/partage";
import { aujourdhui } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";
import type { ReglagesPrieres } from "@/db/schema";

export const metadata: Metadata = { title: "Questline — Réglages des prières" };
export const dynamic = "force-dynamic";

/**
 * Ce que la ponctualité des rappels vaut réellement.
 *
 * Elle ne dépend pas du code mais de la fréquence à laquelle quelque chose
 * appelle la route planifiée. Le dire ici évite de laisser croire à cinq
 * notifications à la minute quand le socle n'en permet que deux par jour.
 */
const PONCTUALITE =
  "À dire franchement : les rappels ne partent que lorsque la tâche planifiée " +
  "passe, et sur le palier gratuit de Vercel elle ne passe que deux fois par " +
  "jour. Une prière entrée depuis plus d'une heure et demie est laissée de côté " +
  "plutôt qu'annoncée trop tard — donc en l'état, seules celles qui tombent " +
  "près de ces deux passages arrivent, soit deux sur cinq. Pour les avoir " +
  "toutes, il faut que quelque chose appelle l'adresse /api/cron toutes les " +
  "quinze minutes : un planificateur gratuit s'en charge depuis un navigateur, " +
  "et le code est déjà prêt. Demande-moi si tu veux la marche à suivre.";

export default async function PageReglagesPrieres() {
  let reglages: ReglagesPrieres;

  try {
    reglages = await chargerReglagesPrieres();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const cejour = aujourdhui();
  const calcul = reperesPour(cejour, reglages);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/prieres" libelle="Prières" />
        <h1 className="police-titre text-[30px] leading-tight">Réglages des prières</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Les heures sont calculées ici, sans service extérieur. Ce qui relève
          d&apos;un choix — la convention, l&apos;école pour l&apos;Asr, la règle des
          nuits courtes — se règle ci-dessous : l&apos;application applique, elle ne
          tranche pas.
        </p>
      </header>

      {/* L'aperçu du jour, pour vérifier un réglage sans quitter l'écran. */}
      {calcul && (
        <section className="flex flex-col gap-2 rounded-2xl border border-bordure bg-surface px-5 py-4">
          <span className="text-[12px] tracking-[0.1em] text-tres-doux uppercase">
            Aujourd&apos;hui, avec ces réglages
          </span>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[13px]">
            {PRIERES.map((priere) => (
              <div key={priere.cle} className="contents">
                <dt className="text-tres-doux">{priere.nom}</dt>
                <dd className="text-right text-doux tabular-nums">
                  {formaterHeure(calcul.reperes[priere.cle]) || "—"}
                </dd>
              </div>
            ))}
            <dt className="text-tres-doux">Lever du soleil</dt>
            <dd className="text-right text-tres-doux tabular-nums">
              {formaterHeure(calcul.reperes.lever) || "—"}
            </dd>
          </dl>
          {calcul.nuitCourte && (
            <p className="text-[11.5px] leading-relaxed text-tres-doux">
              La nuit est trop courte en ce moment pour que le Fajr et l&apos;Isha
              aient une heure calculable : la règle de repli a servi.
            </p>
          )}
        </section>
      )}

      <ReglagesPrieresEcran reglages={reglages} ponctualite={PONCTUALITE} />

      <section className="flex flex-col gap-2 border-t border-bordure pt-5">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Ce que ce suivi ne fait pas
        </h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[12.5px] leading-relaxed text-tres-doux">
          <li>
            Il ne crédite <span className="text-doux">aucun pilier</span>, ne fait
            pas bouger l&apos;élan, n&apos;ouvre aucune journée dans le journal et
            n&apos;entre dans aucune saison.
          </li>
          <li>
            Il ne compte rien : ni total, ni série, ni pourcentage, ni moyenne. Une
            prière est cochée ou elle ne l&apos;est pas, et deux jours ne se
            comparent pas.
          </li>
          <li>
            Il n&apos;interprète rien. Les angles et les écoles proposés sont ceux
            que publient les institutions nommées ; rien n&apos;est calculé à partir
            d&apos;une moyenne entre elles.
          </li>
          <li>
            Je ne peux pas comparer ces heures à celles de ta mosquée depuis
            l&apos;endroit où je tourne. Fais-le une fois, et dis-moi
            l&apos;écart s&apos;il y en a un.
          </li>
        </ul>
      </section>
    </main>
  );
}
