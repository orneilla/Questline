"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Les signes des onglets.
 *
 * Traits fins, jamais de remplissage, même facture que la loupe et la roue
 * dentée déjà dans les en-têtes : un dessin trop chargé ferait illustration là
 * où il ne faut qu'un repère.
 */
function Trait({ d, ...reste }: { d: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[19px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...reste}
    >
      <path d={d} />
    </svg>
  );
}

/** Le jour : une page unique, celle qu'on a sous les yeux. */
const SigneJour = () => (
  <Trait d="M6 3.5h12a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Zm2 5h8m-8 4h8m-8 4h4" />
);

/** La semaine : la grille des sept jours. */
const SigneSemaine = () => (
  <Trait d="M4 5.5h16a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Zm-1 4.5h18M8 3.5v3m8-3v3M8.5 14h1m4 0h1M8.5 17h1m4 0h1" />
);

/** Les cartes : deux fiches, l'une derrière l'autre. */
const SigneCartes = () => (
  <Trait d="M8 7.5h11a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1ZM4 16.5V5a1 1 0 0 1 1-1h11" />
);

/** Le Coran : un livre ouvert, sans autre ornement. */
const SigneCoran = () => (
  <Trait d="M12 6.5v13m0-13C10.6 5.2 8.7 4.5 6.5 4.5H4v13h2.5c2.2 0 4.1.7 5.5 2m0-15c1.4-1.3 3.3-2 5.5-2H20v13h-2.5c-2.2 0-4.1.7-5.5 2" />
);

/** Les arcs : trois arcs emboîtés, du plus long au plus court. */
const SigneArcs = () => (
  <Trait d="M2.5 18.5a9.5 9.5 0 0 1 19 0M7 18.5a5 5 0 0 1 10 0M11 18.5a1 1 0 0 1 2 0" />
);

/** La cuisine : une casserole couverte, vue de côté, avec sa queue. */
const SigneCuisine = () => (
  <Trait d="M4.5 11h11v4a3 3 0 0 1-3 3H7.5a3 3 0 0 1-3-3v-4Zm11 1.5H19M3 11h14M10 8.5V7" />
);

const ONGLETS = [
  { href: "/jour", libelle: "Jour", signe: SigneJour },
  { href: "/semaine", libelle: "Semaine", signe: SigneSemaine },
  { href: "/cartes", libelle: "Cartes", signe: SigneCartes },
  { href: "/coran", libelle: "Coran", signe: SigneCoran },
  { href: "/arcs", libelle: "Arcs", signe: SigneArcs },
  { href: "/cuisine", libelle: "Cuisine", signe: SigneCuisine },
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
        {/*
          Six mots sur une ligne de 390 px ne tiennent pas, et aucun réglage de
          marge n'y changeait rien : la police système d'iOS est sensiblement
          plus large que celle sur laquelle je mesurais, si bien que « Jour » et
          « Cuisine » se retrouvaient rognés aux deux bouts.
          Un signe au-dessus du mot lève la contrainte : les repères tombent sur
          une grille régulière quelle que soit la longueur des mots, la rangée
          est enfin d'aplomb, et six cellules égales ne peuvent pas déborder —
          leur somme fait toujours la largeur disponible. Le mot reste dessous,
          en plus petit, et se tronque plutôt que de pousser la barre.
        */}
        <ul className="mx-auto flex w-full max-w-md">
          {ONGLETS.map((onglet) => {
            const actif = estActif(chemin, onglet.href);
            const Signe = onglet.signe;
            return (
              <li key={onglet.href} className="min-w-0 flex-1">
                <Link
                  href={onglet.href}
                  aria-current={actif ? "page" : undefined}
                  className="relative flex min-h-14 flex-col items-center justify-center gap-[3px] px-0.5 pb-[env(safe-area-inset-bottom)] transition-colors duration-300"
                  style={{
                    color: actif ? "var(--color-texte)" : "var(--color-tres-doux)",
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-1 top-0 h-px transition-opacity duration-500 ease-calme"
                    style={{
                      backgroundColor: "var(--color-texte)",
                      opacity: actif ? 1 : 0,
                    }}
                  />
                  <Signe />
                  <span className="w-full truncate text-center text-[9.5px] tracking-[0.02em]">
                    {onglet.libelle}
                  </span>
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
            const Signe = onglet.signe;
            return (
              <li key={onglet.href}>
                <Link
                  href={onglet.href}
                  aria-current={actif ? "page" : undefined}
                  className="relative flex min-h-12 items-center gap-2.5 rounded-xl px-3 text-[15px] transition-colors duration-300"
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
                  <Signe />
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

function Loupe() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  );
}

/**
 * Recherche et réglages, depuis l'en-tête de n'importe quel écran.
 *
 * La recherche n'a pas d'onglet à elle : cinq onglets suffisent en bas, et un
 * sixième les rendrait tous plus étroits. Elle vit donc dans l'en-tête, où elle
 * est atteignable partout — c'est ce que demandait « accessible depuis
 * n'importe quel écran ».
 *
 * La roue dentée disparaît en paysage sur tablette : la colonne de gauche porte
 * déjà le lien, et on n'en montre pas deux. La loupe, elle, reste : la colonne
 * ne la porte pas.
 */
export function LienReglages() {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Link
        href="/recherche"
        aria-label="Chercher"
        className="-m-1 p-1 text-tres-doux transition-colors duration-300 active:text-doux"
      >
        <Loupe />
      </Link>
      <Link
        href="/reglages"
        aria-label="Réglages"
        className="-m-1 p-1 text-tres-doux transition-colors duration-300 active:text-doux lg:landscape:hidden"
      >
        <RoueDentee />
      </Link>
    </span>
  );
}
