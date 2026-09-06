import Link from "next/link";

import { COUVERTURE_ENTIERE } from "@/lib/cuisine/instantane";
import { LIBELLES, NUTRIMENTS, formater } from "@/lib/cuisine/nutrition";
import {
  FACTEURS_ATWATER,
  hauteurs,
  LIBELLES_REPAS,
  ORDRE_REPAS,
  type Semaine,
} from "@/lib/cuisine/tendances";
import { decalerJours, formaterDateLongue } from "@/lib/dates";

/**
 * La semaine, en tendance.
 *
 * Elle montre ce qui a été mangé et comment ça évolue. Elle ne dit pas si
 * c'était bien : aucun objectif, aucun seuil, aucun score. La barre la plus
 * haute de la semaine sert d'échelle — c'est une échelle de lecture, pas une
 * cible.
 *
 * Tout ce qui rendrait un chiffre moins solide est dit à côté du chiffre :
 * les entrées estimées, les nutriments qu'une entrée ne renseigne pas, les
 * totaux sous-estimés faute de fiche.
 */

const INITIALES = ["L", "M", "M", "J", "V", "S", "D"];

function Barres({ semaine }: { semaine: Semaine }) {
  const echelle = hauteurs(semaine.jours, "kcal100g");
  const plafond = Math.max(...semaine.jours.map((j) => j.totaux.kcal100g ?? 0));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-1.5" style={{ height: 96 }}>
        {semaine.jours.map((jour, rang) => {
          const valeur = jour.totaux.kcal100g;
          return (
            <div key={jour.date} className="flex h-full flex-1 flex-col justify-end gap-1">
              <span className="text-center text-[10px] text-tres-doux tabular-nums">
                {valeur === undefined ? "" : Math.round(valeur)}
              </span>
              <div
                className="rounded-t-[3px] transition-all duration-500 ease-calme"
                style={{
                  height: `${Math.max(echelle[rang] * 100, valeur === undefined ? 0 : 2)}%`,
                  // Un jour entièrement pesé se lit plein ; dès qu'une entrée
                  // y est estimée, la barre reste volontairement en retrait.
                  backgroundColor:
                    jour.nbEstimees === 0 && jour.entrees.length > 0
                      ? "var(--color-doux)"
                      : "var(--color-bordure-vive)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-1.5">
        {semaine.jours.map((jour, rang) => (
          <span
            key={jour.date}
            className="flex-1 text-center text-[11px] text-tres-doux"
            title={formaterDateLongue(jour.date)}
          >
            {INITIALES[rang]}
          </span>
        ))}
      </div>
      <p className="text-[11.5px] leading-relaxed text-tres-doux">
        Énergie par jour, en kcal.
        {plafond > 0
          ? ` L'échelle va jusqu'au jour le plus haut de la semaine (${Math.round(plafond)}).`
          : ""}{" "}
        Un jour entièrement pesé est dessiné plein ; dès qu&apos;une entrée y est
        estimée, la barre reste en retrait.
      </p>
    </div>
  );
}

function Repartition({ semaine }: { semaine: Semaine }) {
  const r = semaine.repartition;
  if (!r) {
    return (
      <p className="text-[12.5px] leading-relaxed text-tres-doux">
        La répartition demande les protéines, les glucides et les lipides : au
        moins l&apos;un des trois manque cette semaine.
      </p>
    );
  }

  const parts = [
    { nom: "Protéines", valeur: r.proteines, couleur: "#b58a93" },
    { nom: "Glucides", valeur: r.glucides, couleur: "#c2a567" },
    { nom: "Lipides", valeur: r.lipides, couleur: "#a8926f" },
  ];

  const ecart =
    r.energieCiqual !== null && r.energieCiqual > 0
      ? Math.abs(r.energieAtwater - r.energieCiqual)
      : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 overflow-hidden rounded-full">
        {parts.map((part) => (
          <div
            key={part.nom}
            style={{ width: `${part.valeur}%`, backgroundColor: part.couleur }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((part) => (
          <li key={part.nom} className="flex items-center gap-1.5 text-[12.5px] text-doux">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: part.couleur }}
            />
            {part.nom}{" "}
            <span className="text-tres-doux tabular-nums">
              {Math.round(part.valeur)} %
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt className="text-[12.5px] text-tres-doux">Énergie Ciqual</dt>
        <dd className="text-right text-[12.5px] text-doux tabular-nums">
          {r.energieCiqual === null ? "—" : `${Math.round(r.energieCiqual)} kcal`}
        </dd>
        <dt className="text-[12.5px] text-tres-doux">Reconstituée en 4/4/9</dt>
        <dd className="text-right text-[12.5px] text-doux tabular-nums">
          {Math.round(r.energieAtwater)} kcal
        </dd>
      </dl>

      <p className="text-[11.5px] leading-relaxed text-tres-doux">
        Les parts sont calculées sur le total reconstitué, pour qu&apos;elles fassent
        exactement 100 %. Les facteurs sont ceux d&apos;Atwater —{" "}
        {FACTEURS_ATWATER.proteines} kcal par gramme de protéines,{" "}
        {FACTEURS_ATWATER.glucides} pour les glucides, {FACTEURS_ATWATER.lipides} pour
        les lipides : des conventions, pas des mesures.
        {ecart !== null && ecart >= 1
          ? ` L'énergie Ciqual reste le chiffre de référence ; l'écart de ${Math.round(ecart)} kcal entre les deux vient de sa propre convention, qui compte notamment les fibres et les polyols.`
          : " L'énergie Ciqual reste le chiffre de référence : elle suit sa propre convention, qui compte notamment les fibres et les polyols."}
      </p>
    </div>
  );
}

export function Tendances({ semaine }: { semaine: Semaine }) {
  const precedente = decalerJours(semaine.debut, -7);
  const suivante = decalerJours(semaine.debut, 7);

  return (
    <div className="flex flex-col gap-7">
      <nav className="flex items-center justify-between gap-3">
        <Link
          href={`/cuisine/journal?semaine=${precedente}`}
          className="flex min-h-11 items-center rounded-xl border border-bordure px-4 text-[13px] text-doux transition-colors duration-300 active:bg-surface-haut"
        >
          ← Avant
        </Link>
        <span className="text-center text-[12.5px] text-tres-doux">
          {formaterDateLongue(semaine.debut)} — {formaterDateLongue(semaine.fin)}
        </span>
        <Link
          href={`/cuisine/journal?semaine=${suivante}`}
          className="flex min-h-11 items-center rounded-xl border border-bordure px-4 text-[13px] text-doux transition-colors duration-300 active:bg-surface-haut"
        >
          Après →
        </Link>
      </nav>

      {semaine.nbEntrees === 0 ? (
        <p className="rounded-2xl border border-bordure/60 px-5 py-6 text-center text-[13.5px] leading-relaxed text-doux">
          Rien de noté cette semaine. Une seule entrée suffit à faire apparaître
          une ligne — il n&apos;y a rien à rattraper.
        </p>
      ) : (
        <>
          <Barres semaine={semaine} />

          <section className="flex flex-col gap-3 border-t border-bordure pt-5">
            <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
              Par jour renseigné
            </h2>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
              {NUTRIMENTS.map((cle) => {
                const part = semaine.couverture[cle] ?? 1;
                return (
                  <div key={cle} className="contents">
                    <dt className="text-[13px] text-tres-doux">{LIBELLES[cle]}</dt>
                    <dd className="text-right text-[13px] text-doux tabular-nums">
                      {formater(cle, semaine.moyenne[cle])}
                      {part < COUVERTURE_ENTIERE && (
                        <span className="text-tres-doux">
                          {" "}
                          · {Math.round(part * 100)} % du poids couvert
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="text-[11.5px] leading-relaxed text-tres-doux">
              Moyenne sur les {semaine.joursRenseignes} jour
              {semaine.joursRenseignes > 1 ? "s" : ""} où quelque chose a été noté, pas
              sur les sept — diviser par sept ferait paraître basse une semaine notée à
              moitié.
              {semaine.incomplets.length > 0 &&
                " La couverture dit quelle part du poids mangé repose sur une donnée réelle : le reste n'est pas compté, et le total est donc sous-estimé d'autant."}
            </p>
          </section>

          <section className="flex flex-col gap-3 border-t border-bordure pt-5">
            <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
              Répartition
            </h2>
            <Repartition semaine={semaine} />
          </section>

          <section className="flex flex-col gap-2 border-t border-bordure pt-5">
            <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
              Solidité des chiffres
            </h2>
            <p className="text-[13px] leading-relaxed text-doux">
              {semaine.nbEntrees} entrée{semaine.nbEntrees > 1 ? "s" : ""} ·{" "}
              {semaine.nbPesees} pesée{semaine.nbPesees > 1 ? "s" : ""} ·{" "}
              {semaine.nbEntrees - semaine.nbPesees} estimée
              {semaine.nbEntrees - semaine.nbPesees > 1 ? "s" : ""}
            </p>
            {semaine.sansFiche.length > 0 && (
              <p className="text-[12.5px] leading-relaxed text-tres-doux">
                {semaine.sansFiche.length > 1 ? "Ces ingrédients n'ont" : "Cet ingrédient n'a"}{" "}
                aucune fiche : {semaine.sansFiche.join(", ")}. Leur poids ne compte dans
                aucun nutriment — relie-les au catalogue depuis leur recette et
                resynchronise l&apos;entrée pour que les totaux se referment.
              </p>
            )}
            {semaine.sansValeur.length > 0 && (
              <p className="text-[12.5px] leading-relaxed text-tres-doux">
                Fiches muettes sur{" "}
                {semaine.sansValeur.map((cle) => LIBELLES[cle].toLowerCase()).join(", ")}{" "}
                : l&apos;aliment est bien relié, mais sa fiche ne donne pas cette valeur.
                C&apos;est fréquent dans Ciqual, et ça ne se voit nulle part ailleurs.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2 border-t border-bordure pt-5">
            <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
              Le détail
            </h2>
            <ul className="flex flex-col gap-3">
              {semaine.jours
                .filter((j) => j.entrees.length > 0)
                .map((jour) => (
                  <li key={jour.date} className="flex flex-col gap-1">
                    <span className="text-[12.5px] text-doux">
                      {formaterDateLongue(jour.date)}
                      <span className="text-tres-doux">
                        {" "}
                        · {formater("kcal100g", jour.totaux.kcal100g)}
                      </span>
                    </span>
                    <ul className="flex flex-col gap-0.5">
                      {/* Dans l'ordre des repas, pas dans celui de la saisie :
                          une journée se relit du matin au soir. */}
                      {ORDRE_REPAS.flatMap((repas) =>
                        jour.entrees.filter((e) => e.repas === repas),
                      ).map((entree) => (
                        <li key={entree.id} className="text-[12.5px] text-tres-doux">
                          {LIBELLES_REPAS[entree.repas]} · {entree.libelle}
                          {entree.precision === "estime" ? " · estimé" : ""}
                          {entree.sansFiche.length > 0 ? " · sans fiche" : ""}
                          {entree.dateModification !== null ? " · corrigée" : ""}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
