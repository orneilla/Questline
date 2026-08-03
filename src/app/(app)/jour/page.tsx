import type { Metadata } from "next";
import Link from "next/link";

import { LienReglages } from "@/components/barre-navigation";
import { BarresMomentum } from "@/components/barres-momentum";
import { EcranSaison } from "@/components/ecran-saison";
import { EcranSeuil } from "@/components/ecran-seuil";
import { QueteRare } from "@/components/quete-rare";
import { BasculeJourBas } from "@/components/bascule-jour-bas";
import { EcranInstallation } from "@/components/ecran-installation";
import { ListeQuetes } from "@/components/liste-quetes";
import { PhraseDuSoir } from "@/components/phrase-du-soir";
import { libelleCharge } from "@/lib/charge";
import { formaterDateLongue } from "@/lib/dates";
import { diagnostiquer } from "@/lib/erreurs";
import { cartesDues } from "@/lib/cartes/donnees";
import { chargerJour, type EtatJour } from "@/lib/jour";
import { texteDuTitre } from "@/lib/recit";
import { saisonAClore, saisonCourante } from "@/lib/saisons";
import { consignerSeuils, seuilAAnnoncer } from "@/lib/seuils";

/** Au-delà, la révision pèse assez pour alléger le reste de la journée. */
const SEUIL_CHARGE_CARTES = 50;

export const metadata: Metadata = { title: "Questline" };
export const dynamic = "force-dynamic";

export default async function PageJour() {
  let etat: EtatJour;
  let seuil: Awaited<ReturnType<typeof seuilAAnnoncer>> = null;
  let saison: Awaited<ReturnType<typeof saisonAClore>> = null;
  let cycle: Awaited<ReturnType<typeof saisonCourante>>;
  let dues = 0;

  try {
    etat = await chargerJour();
    dues = await cartesDues();
    await consignerSeuils();
    // Un seuil franchi passe devant tout le reste ; la clôture de saison
    // attend son tour.
    seuil = await seuilAAnnoncer();
    saison = seuil ? null : await saisonAClore();
    cycle = await saisonCourante();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  if (seuil) return <EcranSeuil seuil={seuil} />;
  if (saison) return <EcranSaison saison={saison} />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-11 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10">
      <header className="apparait flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
            {formaterDateLongue(etat.date)}
          </p>
          <LienReglages />
        </div>
        <h1 className="police-titre text-[34px] leading-tight">
          {texteDuTitre(etat.titre)}
        </h1>
        <p className="text-[13.5px] text-doux">{libelleCharge(etat.charge)}</p>
        <p className="text-[11.5px] tracking-[0.14em] text-tres-doux uppercase">
          Saison {cycle.numero} · jour {cycle.jourDansLaSaison}
          {dues > 0 ? ` · ${dues} cartes dues` : ""}
        </p>
      </header>

      {dues > 0 && (
        <Link
          href="/cartes"
          className="flex min-h-16 items-center justify-between rounded-2xl border border-bordure bg-surface px-5 transition-colors duration-300 active:bg-surface-haut"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-[16px] text-texte">Réviser les cartes dues</span>
            <span className="text-[12px] text-tres-doux">
              {dues} carte{dues > 1 ? "s" : ""} en attente
              {dues > SEUIL_CHARGE_CARTES ? " · la journée en tient compte" : ""}
            </span>
          </span>
          <span aria-hidden className="text-tres-doux">
            →
          </span>
        </Link>
      )}

      <ListeQuetes quetes={etat.quetesDuJour} faites={etat.quetesFaites} />

      {etat.queteRare && (
        <QueteRare quete={etat.queteRare} faite={etat.queteRareFaite} />
      )}

      <BarresMomentum momentums={etat.momentums} />

      <BasculeJourBas actif={etat.journee.modeBas} />

      <div aria-hidden className="h-px w-full bg-bordure/60" />

      <PhraseDuSoir valeurInitiale={etat.journee.phrase} />
    </main>
  );
}
