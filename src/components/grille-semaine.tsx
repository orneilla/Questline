"use client";

import { useTransition } from "react";

import { annulerCreneau, retablirCreneau } from "@/app/semaine/actions";
import { COULEURS_CRENEAUX, JOURS_SEMAINE } from "@/lib/constantes";
import type { Bloc } from "@/lib/creneaux";
import type { JourSemaine } from "@/lib/semaine";
import { EVEIL, enHeure, formaterDuree } from "@/lib/temps";

/** Hauteur d'une heure, en pixels. */
const PAS = 27;
const HAUTEUR = ((EVEIL.fin - EVEIL.debut) / 60) * PAS;

function position(bloc: Bloc) {
  const haut = ((Math.max(bloc.plage.debut, EVEIL.debut) - EVEIL.debut) / 60) * PAS;
  const bas = ((Math.min(bloc.plage.fin, EVEIL.fin) - EVEIL.debut) / 60) * PAS;
  return { top: haut, height: Math.max(bas - haut, 14) };
}

/** Un bloc entièrement hors de la fenêtre d'éveil n'a rien à montrer. */
function visible(bloc: Bloc) {
  return bloc.plage.fin > EVEIL.debut && bloc.plage.debut < EVEIL.fin;
}

export function GrilleSemaine({ jours }: { jours: JourSemaine[] }) {
  const [enAttente, demarrer] = useTransition();

  const heures = Array.from(
    { length: (EVEIL.fin - EVEIL.debut) / 60 / 2 + 1 },
    (_, i) => EVEIL.debut + i * 120,
  );

  function basculer(bloc: Bloc, date: string, annule: boolean) {
    if (!bloc.recurrentId || enAttente) return;
    demarrer(async () => {
      if (annule) await retablirCreneau(bloc.recurrentId!, date);
      else await annulerCreneau(bloc.recurrentId!, date);
    });
  }

  return (
    <section aria-label="Emploi du temps de la semaine" className="flex flex-col gap-3">
      <div className="flex gap-1">
        {/* Colonne des heures */}
        <div className="w-7 shrink-0" style={{ paddingTop: 26 }}>
          <div className="relative" style={{ height: HAUTEUR }}>
            {heures.map((minute) => (
              <span
                key={minute}
                className="absolute right-1 -translate-y-1/2 text-[9.5px] text-tres-doux tabular-nums"
                style={{ top: ((minute - EVEIL.debut) / 60) * PAS }}
              >
                {enHeure(minute).slice(0, 2)}
              </span>
            ))}
          </div>
        </div>

        {jours.map((jour) => (
          <div key={jour.date} className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-col items-center gap-0.5">
              <span
                className={`text-[10px] tracking-[0.1em] uppercase ${
                  jour.aujourdhui ? "text-texte" : "text-tres-doux"
                }`}
              >
                {JOURS_SEMAINE[jour.jourSemaine].slice(0, 3)}
              </span>
              <span
                className={`text-[11px] tabular-nums ${
                  jour.aujourdhui ? "text-texte" : "text-tres-doux"
                }`}
              >
                {Number(jour.date.slice(8, 10))}
              </span>
            </div>

            <div
              className="relative rounded-md border"
              style={{
                height: HAUTEUR,
                borderColor: jour.aujourdhui
                  ? "var(--color-bordure-vive)"
                  : "var(--color-bordure)",
                backgroundColor: jour.aujourdhui ? "var(--color-voile)" : "transparent",
              }}
            >
              {/* Repères de deux heures */}
              {heures.slice(1, -1).map((minute) => (
                <span
                  key={minute}
                  aria-hidden
                  className="absolute inset-x-0 h-px bg-bordure/45"
                  style={{ top: ((minute - EVEIL.debut) / 60) * PAS }}
                />
              ))}

              {jour.annules.filter(visible).map((bloc) => {
                const { top, height } = position(bloc);
                return (
                  <button
                    key={bloc.cle}
                    type="button"
                    onClick={() => basculer(bloc, jour.date, true)}
                    title={`${bloc.titre} — annulé. Toucher pour rétablir.`}
                    className="absolute inset-x-[2px] overflow-hidden rounded-[4px] border border-dashed border-bordure-vive/70 px-[3px] text-left"
                    style={{ top, height }}
                  >
                    <span className="block truncate text-[8.5px] text-tres-doux line-through">
                      {bloc.titre}
                    </span>
                  </button>
                );
              })}

              {jour.blocs.filter(visible).map((bloc) => {
                const { top, height } = position(bloc);
                const couleur = COULEURS_CRENEAUX[bloc.type] ?? COULEURS_CRENEAUX.autre;
                const recurrent = bloc.source === "recurrent";
                return (
                  <button
                    key={bloc.cle}
                    type="button"
                    disabled={!recurrent}
                    onClick={() => basculer(bloc, jour.date, false)}
                    title={
                      recurrent
                        ? `${bloc.titre} · ${bloc.debut.slice(0, 5)}–${bloc.fin.slice(0, 5)}. Toucher pour annuler ce jour-là.`
                        : `${bloc.titre} · ${bloc.debut.slice(0, 5)}–${bloc.fin.slice(0, 5)}`
                    }
                    className="absolute inset-x-[2px] overflow-hidden rounded-[4px] px-[3px] py-[2px] text-left disabled:cursor-default"
                    style={{
                      top,
                      height,
                      backgroundColor: `${couleur}26`,
                      borderLeft: `2px solid ${couleur}`,
                    }}
                  >
                    <span className="block truncate text-[8.5px] leading-tight text-texte/90">
                      {bloc.titre}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-1.5 text-center text-[9.5px] text-tres-doux tabular-nums">
              {formaterDuree(jour.charge.tempsDispoMin)}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[11.5px] leading-relaxed text-tres-doux">
        Sous chaque jour, le temps disponible une fois les créneaux et les deux heures
        incompressibles retirés. Toucher un bloc récurrent l'annule pour ce jour-là ;
        toucher le filigrane le rétablit.
      </p>
    </section>
  );
}
