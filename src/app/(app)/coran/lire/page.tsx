import type { Metadata } from "next";
import Link from "next/link";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { Lecteur, type Sources } from "@/components/coran/lecteur";
import {
  bornesJuz,
  chargerReglagesCoran,
  chargerSourates,
  chargerTrancheSourate,
  chargerVersets,
  texteBasmala,
  compterMots,
  positionDansSourate,
} from "@/lib/coran/donnees";
import { CORPUS_MORPHOLOGIE, EDITION_ARABE, editionProposee } from "@/lib/coran/sources";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Lecture" };
export const dynamic = "force-dynamic";

/** Au-delà, une page devient trop lourde à rendre d'un bloc. */
const VERSETS_MAX = 300;

export default async function PageLecture({
  searchParams,
}: {
  searchParams: Promise<{ sourate?: string; juz?: string; verset?: string }>;
}) {
  const parametres = await searchParams;

  try {
    const [sourates, reglages, motsAnalyses] = await Promise.all([
      chargerSourates(),
      chargerReglagesCoran(),
      compterMots(),
    ]);

    if (sourates.length === 0) {
      return (
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)]">
          <Retour vers="/coran" libelle="Coran" />
          <p className="text-[14.5px] leading-relaxed text-doux">
            Le texte n'est pas encore importé.
          </p>
        </main>
      );
    }

    let debut = 1;
    let fin = 1;
    let titre = "";
    let sourateOuverte: number | null = null;

    const numeroSourate = Number(parametres.sourate);
    const numeroJuz = Number(parametres.juz);
    const numeroVerset = Number(parametres.verset);

    if (Number.isInteger(numeroSourate) && numeroSourate >= 1 && numeroSourate <= 114) {
      const sourate = sourates[numeroSourate - 1];
      debut = sourate.premierVerset;
      fin = sourate.premierVerset + sourate.versets - 1;
      titre = `${sourate.numero}. ${sourate.nomTranslittere}`;
      sourateOuverte = sourate.numero;
    } else if (Number.isInteger(numeroJuz) && numeroJuz >= 1 && numeroJuz <= 30) {
      const bornes = await bornesJuz(numeroJuz);
      if (bornes) {
        debut = bornes.debut;
        fin = bornes.fin;
      }
      titre = `Juz’ ${numeroJuz}`;
    } else {
      // Par défaut, on ouvre la sourate qui contient le verset demandé.
      const cible = Number.isInteger(numeroVerset) ? numeroVerset : 1;
      const sourate =
        [...sourates].reverse().find((s) => s.premierVerset <= cible) ?? sourates[0];
      debut = sourate.premierVerset;
      fin = sourate.premierVerset + sourate.versets - 1;
      titre = `${sourate.numero}. ${sourate.nomTranslittere}`;
      sourateOuverte = sourate.numero;
    }

    // Un juz' peut dépasser la limite : on le sert par tranches.
    const tranche = Math.min(fin, debut + VERSETS_MAX - 1);

    const versets = await chargerVersets(debut, tranche, {
      traduction: reglages.traduction,
      translitteration: reglages.translitteration,
    });

    // L'enchaînement continu n'a de sens que sur une sourate entière : un juz'
    // ou une plage n'ont pas de « suivante » évidente.
    const [trancheOuverte, basmala] = await Promise.all([
      sourateOuverte !== null && tranche >= fin
        ? chargerTrancheSourate(sourateOuverte)
        : Promise.resolve(null),
      texteBasmala(),
    ]);

    if (versets.length === 0) {
      return (
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)]">
          <Retour vers="/coran" libelle="Coran" />
          <p className="text-[14.5px] leading-relaxed text-doux">
            Cette portion n'est pas encore importée. L'import reprend là où il s'est
            arrêté.
          </p>
        </main>
      );
    }

    const traduction = reglages.traduction ? editionProposee(reglages.traduction) : null;
    const translitteration = reglages.translitteration
      ? editionProposee(reglages.translitteration)
      : null;

    const sources: Sources = {
      riwaya: EDITION_ARABE.riwaya,
      graphie: EDITION_ARABE.graphie,
      sourceArabe: EDITION_ARABE.source,
      corpus:
        motsAnalyses > 0
          ? {
              nom: CORPUS_MORPHOLOGIE.nom,
              auteur: CORPUS_MORPHOLOGIE.auteur,
              lien: CORPUS_MORPHOLOGIE.lien,
            }
          : null,
      traduction: traduction
        ? { nom: traduction.nom, auteur: traduction.auteur }
        : null,
      translitteration: translitteration
        ? { nom: translitteration.nom, auteur: translitteration.auteur }
        : null,
    };

    // Une adresse qui désigne un verset l'emporte ; sinon on propose de
    // reprendre là où cette sourate avait été quittée, sans y sauter d'office.
    const versetDemande =
      Number.isInteger(numeroVerset) && numeroVerset >= debut && numeroVerset <= tranche
        ? numeroVerset
        : null;

    const reprise =
      versetDemande === null && sourateOuverte !== null
        ? await positionDansSourate(sourateOuverte)
        : null;

    const repriseUtile =
      reprise !== null && reprise > debut && reprise <= tranche ? reprise : null;

    const versetInitial = versetDemande ?? repriseUtile ?? debut;

    const versetRepris = repriseUtile
      ? versets.find((v) => v.numero === repriseUtile)
      : undefined;

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
        <header className="flex flex-col gap-2">
          <Retour vers="/coran" libelle="Coran" />
          <h1 className="police-titre text-[26px] leading-tight">{titre}</h1>
        </header>

        <Lecteur
          versets={versets}
        tranche={trancheOuverte}
        basmala={basmala}
          reglages={{
            reciteur: reglages.reciteur,
            tailleArabe: reglages.tailleArabe,
            tailleTranslitteration: reglages.tailleTranslitteration,
            tailleTraduction: reglages.tailleTraduction,
            modeMemorisation: reglages.modeMemorisation,
            policeArabe: reglages.policeArabe,
            afficherArabe: reglages.afficherArabe,
            afficherTranslitteration: reglages.afficherTranslitteration,
            afficherTraduction: reglages.afficherTraduction,
          }}
          sources={sources}
          versetInitial={versetInitial}
          repriseSuggeree={
            versetRepris
              ? {
                  numero: versetRepris.numero,
                  reference: `${versetRepris.sourate}:${versetRepris.numeroDansSourate}`,
                }
              : null
          }
          motAMotDisponible={motsAnalyses > 0}
        />

        {tranche < fin && (
          <Link
            href={`/coran/lire?verset=${tranche + 1}`}
            className="flex min-h-14 items-center justify-center rounded-2xl border border-bordure-vive bg-surface-haut text-[15px] text-texte"
          >
            Suite
          </Link>
        )}
      </main>
    );
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }
}
