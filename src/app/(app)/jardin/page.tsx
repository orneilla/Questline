import type { Metadata } from "next";

import { LienReglages } from "@/components/barre-navigation";
import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import {
  especePour,
  LIBELLES_STADES,
  Plante,
  stadePour,
} from "@/components/jardin/plante";
import { chargerPaquets, type ResumePaquet } from "@/lib/cartes/donnees";
import { COULEURS_PILIERS, LIBELLES_PILIERS, PILIERS } from "@/lib/constantes";
import { db } from "@/db";
import { momentum } from "@/db/schema";
import { diagnostiquer } from "@/lib/erreurs";
import { intensite } from "@/lib/momentum";

export const metadata: Metadata = { title: "Questline — Jardin" };
export const dynamic = "force-dynamic";

const SOMMEIL_JOURS = 14;

export default async function PageJardin() {
  let paquets: ResumePaquet[];
  let elans: { pilier: string; valeur: number }[];

  try {
    [paquets, elans] = await Promise.all([
      chargerPaquets(),
      db.select({ pilier: momentum.pilier, valeur: momentum.valeur }).from(momentum),
    ]);
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  const espaces = [...new Map(paquets.map((p) => [p.espaceId, p])).values()];
  const parPilier = new Map(elans.map((e) => [e.pilier, e.valeur]));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-9 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-3xl">
      <header className="apparait flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Retour vers="/cartes" libelle="Cartes" />
          <p className="text-[12px] tracking-[0.22em] text-tres-doux uppercase">
            {paquets.length + PILIERS.length} plantes
          </p>
          <h1 className="police-titre text-[34px] leading-none">Jardin</h1>
        </div>
        <div className="pt-1">
          <LienReglages />
        </div>
      </header>

      <p className="text-[13.5px] leading-relaxed text-doux">
        Tout ce que tu apprends, au même endroit. Chaque plante suit la maîtrise réelle
        de son paquet ; celles qu'on laisse de côté pâlissent, sans jamais mourir. Une
        seule session suffit à les raviver.
      </p>

      {espaces.map((tete) => (
        <section key={tete.espaceId} className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2.5 text-[13px] tracking-[0.14em] text-doux uppercase">
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ backgroundColor: tete.couleur }}
            />
            {tete.espaceNom}
          </h2>

          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {paquets
              .filter((p) => p.espaceId === tete.espaceId)
              .map((paquet) => {
                const stade = stadePour(paquet.repartition.maitrise);
                const endormie =
                  paquet.joursSansRevision !== null &&
                  paquet.joursSansRevision > SOMMEIL_JOURS;
                return (
                  <div key={paquet.id} className="flex flex-col items-center gap-1.5">
                    <Plante
                      stade={stade}
                      espece={especePour(paquet.espaceId)}
                      taille={72}
                      endormie={endormie}
                      teinte={paquet.couleur}
                      titre={`${paquet.nom} — ${LIBELLES_STADES[stade]}`}
                    />
                    <span className="line-clamp-2 text-center text-[11px] leading-tight text-doux">
                      {paquet.nom}
                    </span>
                    <span className="text-[10px] tabular-nums text-tres-doux">
                      {paquet.repartition.maitrise} %
                    </span>
                  </div>
                );
              })}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-4">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Les six piliers
        </h2>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {PILIERS.map((pilier, rang) => {
            const valeur = parPilier.get(pilier) ?? 0;
            const stade = stadePour(Math.round(intensite(valeur) * 100));
            return (
              <div key={pilier} className="flex flex-col items-center gap-1.5">
                <Plante
                  stade={stade}
                  espece={especePour(rang)}
                  taille={72}
                  endormie={valeur < 1}
                  teinte={COULEURS_PILIERS[pilier]}
                  titre={`${LIBELLES_PILIERS[pilier]} — ${LIBELLES_STADES[stade]}`}
                />
                <span className="text-[11px] text-doux">{LIBELLES_PILIERS[pilier]}</span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
