"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ONGLETS = [
  { href: "/jour", libelle: "Jour" },
  { href: "/semaine", libelle: "Semaine" },
  { href: "/cartes", libelle: "Cartes" },
  { href: "/coran", libelle: "Coran" },
  { href: "/arcs", libelle: "Arcs" },
] as const;

function estActif(chemin: string, href: string): boolean {
  return chemin === href || chemin.startsWith(`${href}/`);
}

/**
 * Navigation principale.
 *
 * Deux formes selon la place : une barre en bas — le pouce y arrive — et, sur
 * tablette en paysage, une colonne à gauche. En paysage, la hauteur est la
 * ressource rare : une barre horizontale y prendrait la place d'une carte.
 */
export function BarreNavigation() {
  const chemin = usePathname();

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-bordure bg-fond/95 backdrop-blur-sm lg:landscape:hidden"
      >
        <ul className="mx-auto flex w-full max-w-md">
          {ONGLETS.map((onglet) => {
            const actif = estActif(chemin, onglet.href);
            return (
              <li key={onglet.href} className="flex-1">
                <Link
                  href={onglet.href}
                  aria-current={actif ? "page" : undefined}
                  className="relative flex min-h-14 flex-col items-center justify-center gap-1 pb-[env(safe-area-inset-bottom)] text-[11.5px] tracking-[0.06em] transition-colors duration-300"
                  style={{
                    color: actif ? "var(--color-texte)" : "var(--color-tres-doux)",
                  }}
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

      <nav
        aria-label="Navigation principale"
        className="fixed inset-y-0 left-0 z-20 hidden w-[13rem] flex-col justify-center gap-1 border-r border-bordure bg-fond/95 px-4 backdrop-blur-sm lg:landscape:flex"
      >
        <p className="police-titre mb-4 px-3 text-[19px] text-doux">Questline</p>

        <ul className="flex flex-col gap-1">
          {ONGLETS.map((onglet) => {
            const actif = estActif(chemin, onglet.href);
            return (
              <li key={onglet.href}>
                <Link
                  href={onglet.href}
                  aria-current={actif ? "page" : undefined}
                  className="relative flex min-h-12 items-center rounded-xl px-3 text-[15px] transition-colors duration-300"
                  style={{
                    color: actif ? "var(--color-texte)" : "var(--color-tres-doux)",
                    backgroundColor: actif ? "var(--color-surface)" : "transparent",
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute top-1/2 left-0 h-5 w-px -translate-y-1/2 transition-opacity duration-500 ease-calme"
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

        <Link
          href="/reglages"
          className="mt-6 flex min-h-12 items-center gap-2.5 rounded-xl px-3 text-[14px] text-tres-doux transition-colors duration-300 active:text-doux"
        >
          <RoueDentee />
          Réglages
        </Link>
      </nav>
    </>
  );
}

function RoueDentee() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3.2" />
      <path
        strokeLinecap="round"
        d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4"
      />
    </svg>
  );
}

/**
 * Accès aux réglages depuis l'en-tête d'un écran. Sur tablette en paysage, la
 * colonne de gauche porte déjà le lien : on n'en montre pas deux.
 */
export function LienReglages() {
  return (
    <Link
      href="/reglages"
      aria-label="Réglages"
      className="-m-2 shrink-0 p-2 text-tres-doux transition-colors duration-300 active:text-doux lg:landscape:hidden"
    >
      <RoueDentee />
    </Link>
  );
}
