import { BarreNavigation } from "@/components/barre-navigation";

/**
 * Coque des écrans applicatifs. La marge suit la forme de la navigation :
 * en bas quand elle est une barre — jusque sous l'encoche — et à gauche
 * quand elle devient une colonne, sur tablette en paysage.
 */
export default function LayoutApplication({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:landscape:pb-0 lg:landscape:pl-[13rem]">
        {children}
      </div>
      <BarreNavigation />
    </>
  );
}
