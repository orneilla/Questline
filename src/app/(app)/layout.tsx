import { BarreNavigation } from "@/components/barre-navigation";
import { PiliersProvider } from "@/components/piliers-contexte";
import { chargerPiliers } from "@/lib/piliers";

/**
 * Coque des écrans applicatifs. La marge suit la forme de la navigation :
 * en bas quand elle est une barre — jusque sous l'encoche — et à gauche
 * quand elle devient une colonne, sur tablette en paysage.
 *
 * C'est aussi ici que les piliers sont chargés une fois pour toute
 * l'application : ils viennent de la base, et les écrans qui affichent leur
 * nom ou leur teinte sont pour beaucoup des composants client.
 */
export default async function LayoutApplication({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ne lève jamais : voir `chargerPiliers`. Une base absente rend les piliers
  // d'origine, et chaque page garde sa propre gestion de l'installation.
  const piliers = await chargerPiliers();

  return (
    <PiliersProvider valeur={piliers}>
      <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:landscape:pb-0 lg:landscape:pl-[13rem]">
        {children}
      </div>
      <BarreNavigation />
    </PiliersProvider>
  );
}
