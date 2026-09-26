"use client";

import { useActionState } from "react";

import { installerCatalogue, type Retour } from "@/app/(app)/cartes/edition-actions";
import type { EtatCatalogue } from "@/lib/cartes/catalogues/installation";
import { Envoyer, Retourner } from "@/components/reglages/briques";

/**
 * Les catalogues de cours : des paquets tout faits, installés d'un geste.
 * Réinstaller un catalogue le met à jour sans rien coûter de la progression.
 */
export function Catalogues({ catalogues }: { catalogues: EtatCatalogue[] }) {
  return (
    <div className="flex flex-col gap-3">
      {catalogues.map((catalogue) => (
        <FicheCatalogue key={catalogue.id} catalogue={catalogue} />
      ))}
    </div>
  );
}

function FicheCatalogue({ catalogue }: { catalogue: EtatCatalogue }) {
  const [etat, action] = useActionState<Retour, FormData>(installerCatalogue, {});
  const installe = catalogue.installees > 0;

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-bordure bg-surface p-5">
      <input type="hidden" name="catalogue" value={catalogue.id} />

      <div className="flex flex-col gap-1">
        <span className="police-titre text-[22px] leading-tight text-texte">{catalogue.titre}</span>
        <span className="text-[12px] text-tres-doux">{catalogue.source}</span>
      </div>

      <p className="text-[13px] leading-relaxed text-doux">{catalogue.description}</p>

      <p className="text-[12px] text-tres-doux tabular-nums">
        {catalogue.cartes} cartes, structures dessinées
        {installe &&
          ` · installé : ${catalogue.installees} carte(s), dont ${catalogue.jamaisVues} jamais vue(s)`}
      </p>

      <Envoyer libelle={installe ? "Mettre à jour" : "Ajouter à mes cartes"} />
      {installe && (
        <p className="-mt-1 text-[11.5px] leading-relaxed text-tres-doux">
          La mise à jour réécrit le texte des cartes du catalogue et ajoute les nouvelles ;
          échéances et historique restent intacts. Une retouche faite à la main dans
          l'éditeur serait écrasée.
        </p>
      )}
      <Retourner etat={etat} />
    </form>
  );
}
