import type { Metadata } from "next";

import { Retour } from "@/components/retour";
import { EcranInstallation } from "@/components/ecran-installation";
import { Calendriers } from "@/components/reglages/calendrier";
import { listerCalendriers, type FicheCalendrier } from "@/lib/calendrier/abonnements";
import { diagnostiquer } from "@/lib/erreurs";

export const metadata: Metadata = { title: "Questline — Calendrier" };
export const dynamic = "force-dynamic";

export default async function PageCalendrier() {
  let calendriers: FicheCalendrier[];

  try {
    calendriers = await listerCalendriers();
  } catch (erreur) {
    const probleme = diagnostiquer(erreur);
    if (!probleme) throw erreur;
    return <EcranInstallation probleme={probleme} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-10 lg:max-w-2xl">
      <header className="apparait flex flex-col gap-2.5">
        <Retour vers="/reglages" libelle="Réglages" />
        <h1 className="police-titre text-[30px] leading-tight">Calendrier extérieur</h1>
        <p className="text-[13.5px] leading-relaxed text-doux">
          Questline peut lire un calendrier publié — Apple, Google, l&apos;emploi du
          temps d&apos;un établissement — et compter ses créneaux dans tes heures
          disponibles. La lecture est à sens unique : rien n&apos;est jamais écrit
          dans ton calendrier, et aucun identifiant n&apos;est demandé.
        </p>
      </header>

      <Calendriers calendriers={calendriers} />

      {/*
        Ces étapes existent parce que le chemin n'est pas devinable : publier un
        calendrier iCloud se cache dans un sous-menu de partage, et l'adresse
        obtenue commence par un schéma que rien n'ouvre.
      */}
      <section className="flex flex-col gap-2 border-t border-bordure pt-5">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Depuis un iPhone ou un iPad
        </h2>
        <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-[12.5px] leading-relaxed text-tres-doux">
          <li>
            Ouvre l&apos;app <span className="text-doux">Calendrier</span> et va dans la
            liste des calendriers.
          </li>
          <li>
            Appuie sur le bouton d&apos;information à côté du calendrier voulu, puis
            active <span className="text-doux">Calendrier public</span>.
          </li>
          <li>
            Copie le lien proposé — il commence par{" "}
            <span className="text-doux">webcal://</span> — et colle-le ci-dessus.
          </li>
        </ol>
        <p className="text-[12.5px] leading-relaxed text-tres-doux">
          Je ne peux pas atteindre le site d&apos;Apple depuis l&apos;endroit où je
          tourne : le libellé exact des menus peut donc différer de ce que j&apos;écris
          là. Si tu ne trouves pas, dis-moi ce que l&apos;écran affiche.
        </p>
      </section>

      <section className="flex flex-col gap-2 border-t border-bordure pt-5">
        <h2 className="text-[13px] tracking-[0.14em] text-doux uppercase">
          Ce qu&apos;il faut savoir
        </h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[12.5px] leading-relaxed text-tres-doux">
          <li>
            Un calendrier publié est <span className="text-doux">lisible par qui a le
            lien</span>. Publie un calendrier dédié — tes cours, ton travail — plutôt
            que ton agenda personnel entier.
          </li>
          <li>
            Les créneaux importés occupent ton temps comme tes créneaux récurrents. Un
            événement de journée entière, lui, s&apos;affiche sans rien occuper :
            marquer un jour « vacances » ne veut pas dire qu&apos;il est plein.
          </li>
          <li>
            La relecture se fait deux fois par jour, en même temps que les rappels. Le
            bouton ci-dessus force une relecture immédiate.
          </li>
          <li>
            Apple met parfois un moment à répercuter une modification dans le flux
            publié : un cours ajouté à l&apos;instant peut n&apos;arriver ici
            qu&apos;un peu plus tard.
          </li>
        </ul>
      </section>
    </main>
  );
}
