"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ONGLETS = [
  { href: "/jour", libelle: "Jour" },
  { href: "/semaine", libelle: "Semaine" },
  { href: "/cartes", libelle: "Cartes" },
  { href: "/arcs", libelle: "Arcs" },
  { href: "/bilan", libelle: "Bilan" },
] as const;

/**
 * Barre du bas, cinq onglets. Discrète : un trait au-dessus de l'onglet
 * courant plutôt qu'un pavé coloré.
 */
export function BarreNavigation() {
  const chemin = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-bordure bg-fond/95 backdrop-blur-sm"
    >
      <ul className="mx-auto flex w-full max-w-md">
        {ONGLETS.map((onglet) => {
          const actif = chemin === onglet.href || chemin.startsWith(`${onglet.href}/`);
          return (
            <li key={onglet.href} className="flex-1">
              <Link
                href={onglet.href}
                aria-current={actif ? "page" : undefined}
                className="relative flex min-h-14 flex-col items-center justify-center gap-1 pb-[env(safe-area-inset-bottom)] text-[11.5px] tracking-[0.06em] transition-colors duration-300"
                style={{ color: actif ? "var(--color-texte)" : "var(--color-tres-doux)" }}
              >
                <span
                  aria-hidden
                  className="absolute top-0 h-px w-8 transition-opacity duration-500 ease-calme"
                  style={{
                    backgroundColor: "var(--color-texte)",
                    opacity: actif ? 1 : 0,
                  }}
                />
                {onglet.libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Accès aux réglages : une roue discrète, en haut de chaque écran. */
export function LienReglages() {
  return (
    <Link
      href="/reglages"
      aria-label="Réglages"
      className="-m-2 shrink-0 p-2 text-tres-doux transition-colors duration-300 active:text-doux"
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="3.2" />
        <path
          strokeLinecap="round"
          d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4"
        />
      </svg>
    </Link>
  );
}
