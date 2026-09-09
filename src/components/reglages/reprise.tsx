"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { actionRepartirDeZero, type Retour } from "@/app/(app)/reglages/reprise-actions";
import { champ, etiquette } from "@/components/reglages/briques";
import type { ApercuReprise, ChoixReprise } from "@/lib/reprise";

/**
 * Repartir de zéro.
 *
 * L'écran montre des nombres avant de demander quoi que ce soit : on ne
 * confirme pas « des données », on confirme 314 validations et 87 révisions.
 * Chaque bloc dit aussi ce qu'il ne touche pas — c'est ce qui permet de décider
 * sans avoir à faire confiance.
 */

type Bloc = {
  cle: keyof ChoixReprise;
  titre: string;
  lignes: { nom: string; valeur: number }[];
  epargne: string;
};

function nombre(n: number): string {
  return n.toLocaleString("fr-FR");
}

function Case({
  coche,
  surClic,
  titre,
  children,
}: {
  coche: boolean;
  surClic: () => void;
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-bordure p-4">
      <button
        type="button"
        onClick={surClic}
        aria-pressed={coche}
        className="flex items-center gap-3 text-left"
      >
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-200"
          style={{
            borderColor: coche ? "var(--color-texte)" : "var(--color-bordure-vive)",
            backgroundColor: coche ? "var(--color-texte)" : "transparent",
            color: "var(--color-fond)",
          }}
        >
          {coche ? "✓" : ""}
        </span>
        <span className="text-[15px] text-texte">{titre}</span>
      </button>
      {children}
    </div>
  );
}

function Detail({ lignes }: { lignes: { nom: string; valeur: number }[] }) {
  const utiles = lignes.filter((l) => l.valeur > 0);
  if (utiles.length === 0) {
    return <p className="text-[12.5px] text-tres-doux">Rien à effacer ici.</p>;
  }

  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
      {utiles.map((l) => (
        <div key={l.nom} className="contents">
          <dt className="text-[12.5px] text-tres-doux">{l.nom}</dt>
          <dd className="text-right text-[12.5px] text-doux tabular-nums">
            {nombre(l.valeur)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Reprise({ apercu }: { apercu: ApercuReprise }) {
  const router = useRouter();
  const [choix, setChoix] = useState<ChoixReprise>({
    journal: true,
    cartes: true,
    coran: true,
    cuisine: true,
  });
  const [mot, setMot] = useState("");
  const [retour, setRetour] = useState<Retour>({});
  const [enAttente, demarrer] = useTransition();

  const blocs: Bloc[] = [
    {
      cle: "journal",
      titre: "Le journal et les saisons",
      lignes: [
        { nom: "Jours notés", valeur: apercu.jours },
        { nom: "dont phrases du soir", valeur: apercu.phrases },
        { nom: "Saisons archivées", valeur: apercu.saisons },
      ],
      epargne: "Les réponses de fin de saison partent avec.",
    },
    {
      cle: "cartes",
      titre: "Les cartes",
      lignes: [
        { nom: "Cartes", valeur: apercu.cartes },
        { nom: "Paquets", valeur: apercu.paquets },
        { nom: "Révisions", valeur: apercu.revisions },
        { nom: "Images", valeur: apercu.images },
      ],
      epargne: "Le jardin repart du premier stade, puisqu'il lit les révisions.",
    },
    {
      cle: "coran",
      titre: "La lecture du Coran",
      lignes: [
        { nom: "Versets distincts lus", valeur: apercu.versetsLus },
        { nom: "Séances", valeur: apercu.seances },
        { nom: "Marque-pages", valeur: apercu.marquePages },
      ],
      epargne:
        "Le texte arabe, les traductions et le mot à mot ne sont pas touchés : ils ont été importés une fois et restent en place.",
    },
    {
      cle: "cuisine",
      titre: "La cuisine",
      lignes: [
        { nom: "Recettes", valeur: apercu.recettes },
        { nom: "Articles d'inventaire", valeur: apercu.articles },
        { nom: "Repas notés", valeur: apercu.repas },
      ],
      epargne: "La table Ciqual reste : elle ne se redépose pas d'un tap.",
    },
  ];

  if (retour.bilan) {
    const lignes = Object.entries(retour.bilan.efface).filter(([, n]) => n > 0);
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed text-texte">
          C&apos;est reparti. Saison 1, jour {retour.bilan.jourDansLaSaison}.
        </p>
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          La saison a commencé lundi, pas aujourd&apos;hui : elle fait quatre
          semaines pleines, et la faire démarrer en milieu de semaine
          désaxerait le bilan hebdomadaire pour toujours.
        </p>
        {lignes.length > 0 && (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-2xl border border-bordure p-4">
            {lignes.map(([nom, n]) => (
              <div key={nom} className="contents">
                <dt className="text-[12.5px] text-tres-doux">{nom}</dt>
                <dd className="text-right text-[12.5px] text-doux tabular-nums">
                  {nombre(n)}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {retour.sauvegarde && (
          <p className="text-[12.5px] leading-relaxed text-tres-doux">
            Une sauvegarde a été prise juste avant, le {retour.sauvegarde}. Elle
            couvre les arcs, les quêtes, le journal, les cartes et la lecture —
            pas les images ni la cuisine. Elle se retrouve dans Réglages →
            Sauvegardes.
          </p>
        )}
        <button
          type="button"
          onClick={() => router.push("/jour")}
          className="min-h-12 rounded-xl border border-bordure-vive bg-surface-haut text-[15px] text-texte"
        >
          Ouvrir le premier jour
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2 rounded-2xl border border-bordure-vive p-4">
        <span className={etiquette}>Effacé dans tous les cas</span>
        <Detail
          lignes={[
            { nom: "Quêtes validées", valeur: apercu.validations },
            { nom: "Quêtes rares faites", valeur: apercu.quetesRares },
            { nom: "Seuils d'arcs franchis", valeur: apercu.seuils },
            { nom: "Tâches", valeur: apercu.taches },
          ]}
        />
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          L&apos;élan des {nombre(apercu.piliers)} piliers retombe à zéro, et le
          compte des saisons repart du lundi de cette semaine.
        </p>
      </section>

      {blocs.map((bloc) => (
        <Case
          key={bloc.cle}
          coche={choix[bloc.cle]}
          surClic={() => setChoix((c) => ({ ...c, [bloc.cle]: !c[bloc.cle] }))}
          titre={bloc.titre}
        >
          <Detail lignes={bloc.lignes} />
          <p className="text-[12px] leading-relaxed text-tres-doux">{bloc.epargne}</p>
        </Case>
      ))}

      <section className="flex flex-col gap-2 rounded-2xl border border-bordure p-4">
        <span className={etiquette}>Ce qui reste debout</span>
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          Tes {nombre(apercu.arcs)} arcs et {nombre(apercu.quetes)} quêtes restent,
          ainsi que tes piliers, tes créneaux récurrents et tous tes réglages. Ce
          sont des structures, pas des traces : un arc qui n&apos;a plus lieu
          d&apos;être se supprime à l&apos;unité, depuis l&apos;arc lui-même, avec le
          détail de ce qu&apos;il emporte.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-bordure-vive p-4">
        <p className="text-[13.5px] leading-relaxed text-doux">
          Rien de tout cela ne se récupère depuis l&apos;application. Une sauvegarde
          est prise automatiquement juste avant — elle ne couvre ni les images des
          cartes, ni la cuisine.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className={etiquette}>Tape RECOMMENCER pour confirmer</span>
          <input
            value={mot}
            onChange={(e) => setMot(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="RECOMMENCER"
            className={champ}
          />
        </label>
        <button
          type="button"
          disabled={enAttente || mot.trim().toUpperCase() !== "RECOMMENCER"}
          onClick={() =>
            demarrer(async () => setRetour(await actionRepartirDeZero(mot, choix)))
          }
          className="min-h-12 rounded-xl border border-bordure-vive bg-surface-haut text-[15px] text-texte disabled:opacity-40"
        >
          {enAttente ? "…" : "Repartir de zéro"}
        </button>
        <p aria-live="polite" className="min-h-4 text-[12.5px] text-doux">
          {retour.erreur ?? ""}
        </p>
      </section>
    </div>
  );
}
