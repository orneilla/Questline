import type { Metadata } from "next";

import Link from "next/link";

import { LienReglages } from "@/components/barre-navigation";
import { EcranInstallation } from "@/components/ecran-installation";
import { chargerBilan, type Bilan, type LignePilier } from "@/lib/bilan";
import { COULEURS_PILIERS, LIBELLES_PILIERS, MOIS } from "@/lib/constantes";
import { formaterDateLongue } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";
import { etatMomentum, intensite } from "@/lib/momentum";

export const metadata: Metadata = { title: "Questline — Bilan" };
export const dynamic = "force-dynamic";

function intervalle(debut: string, fin: string): string {
  const [, moisD, jourD] = debut.split("-").map(Number);
  const [, moisF, jourF] = fin.split("-").map(Number);
  return moisD === moisF
    ? `${jourD} – ${jourF} ${MOIS[moisF - 1]}`
    : `${jourD} ${MOIS[moisD - 1]} – ${jourF} ${MOIS[moisF - 1]}`;
}

/** Écart chiffré, sans adjectif. « + 2 » et « − 1 » se lisent seuls. */
function ecart(actuel: number, avant: number): string {
  const delta = actuel - avant;
  if (delta === 0) return "autant que la semaine passée";
  const signe = delta > 0 ? "+" : "−";
  return `${signe} ${Math.abs(delta)} par rapport à la semaine passée`;
}

function LigneMomentum({ ligne }: { ligne: LignePilier }) {
  const couleur = COULEURS_PILIERS[ligne.pilier];
  const part = intensite(ligne.momentum);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] tracking-[0.14em] text-doux uppercase">
          {LIBELLES_PILIERS[ligne.pilier]}
        </span>
        <span className="text-[12px] tabular-nums text-tres-doux">
          {ligne.validations} validation{ligne.validations > 1 ? "s" : ""}
        </span>
      </div>

      <div className="h-[3px] w-full overflow-hidden rounded-full bg-bordure">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(part * 100, ligne.momentum > 0 ? 2 : 0)}%`,
            backgroundColor: couleur,
          }}
        />
      </div>

      <p className="text-[12px] text-tres-doux">
        {ligne.points} point{ligne.points > 1 ? "s" : ""} cette semaine ·{" "}
        {ecart(ligne.validations, ligne.validationsAvant)} · momentum{" "}
        {etatMomentum(ligne.momentum)}
      </p>
    </div>
  );
}

function Constat({ bilan }: { bilan: Bilan }) {
  const phrases: string[] = [];

  phrases.push(
    bilan.total === 0
      ? "Aucune validation cette semaine. Le momentum s'érode doucement, il ne repart pas de zéro."
      : `${bilan.total} validation${bilan.total > 1 ? "s" : ""} sur ${bilan.joursActifs} jour${bilan.joursActifs > 1 ? "s" : ""}, ${ecart(bilan.total, bilan.totalAvant)}.`,
  );

  if (bilan.plusActif) {
    phrases.push(
      `Le pilier le plus nourri : ${LIBELLES_PILIERS[bilan.plusActif]}. Le plus silencieux : ${LIBELLES_PILIERS[bilan.plusDelaisse!]} — il passera devant dans la sélection.`,
    );
  }

  if (bilan.joursBas.length > 0) {
    phrases.push(
      `${bilan.joursBas.length} jour${bilan.joursBas.length > 1 ? "s" : ""} bas : ${bilan.joursBas.map(formaterDateLongue).join(", ")}.`,
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {phrases.map((p) => (
        <p key={p} className="text-[14px] leading-relaxed text-doux">
          {p}
        </p>
      ))}
    </div>
  );
}

export default async function PageBilan() {
  let bilan: Bilan;
  try {
    bilan = await chargerBilan();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-9 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10">
      <header className="apparait flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
            {intervalle(bilan.debut, bilan.fin)}
          </p>
          <h1 className="police-titre text-[34px] leading-none">Bilan</h1>
        </div>
        <div className="pt-1">
          <LienReglages />
        </div>
      </header>

      <Constat bilan={bilan} />

      <section className="flex flex-col gap-5">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Par pilier
        </h2>
        {bilan.parPilier.map((ligne) => (
          <LigneMomentum key={ligne.pilier} ligne={ligne} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Phrases du soir
        </h2>

        {bilan.phrases.length === 0 ? (
          <p className="rounded-2xl border border-bordure/60 px-5 py-6 text-center text-[14px] leading-relaxed text-doux">
            Aucune phrase notée cette semaine.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {bilan.phrases.map((ligne) => (
              <li key={ligne.date} className="flex flex-col gap-1.5">
                <span className="text-[11.5px] tracking-[0.14em] text-tres-doux uppercase">
                  {formaterDateLongue(ligne.date)}
                </span>
                <p className="police-titre text-[17px] leading-relaxed text-texte">
                  {ligne.phrase}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/parcours"
        className="flex min-h-14 items-center justify-between rounded-2xl border border-bordure px-5 text-[15px] text-texte transition-colors duration-300 active:bg-surface"
      >
        Le parcours
        <span aria-hidden className="text-tres-doux">
          →
        </span>
      </Link>

      <p className="text-[12px] leading-relaxed text-tres-doux">
        Ces chiffres sont comptés, pas interprétés. Il n'y a pas de note globale, et
        une semaine creuse ne retire rien à ce qui est déjà construit.
      </p>
    </main>
  );
}
