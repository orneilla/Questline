import { BarreNavigation } from "@/components/barre-navigation";

/**
 * Coque des écrans applicatifs. La marge basse laisse la place à la barre
 * fixe, y compris sous l'encoche des appareils récents.
 */
export default function LayoutApplication({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))]">{children}</div>
      <BarreNavigation />
    </>
  );
}
