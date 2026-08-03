import Link from "next/link";

/**
 * Sortie d'un écran.
 *
 * Une flèche vers l'écran parent, en haut à gauche, identique partout. Elle
 * remonte la hiérarchie plutôt que l'historique : c'est toujours la même
 * destination, quel que soit le chemin emprunté pour arriver là. Le geste de
 * retour du navigateur, lui, continue de suivre l'historique — les deux se
 * complètent au lieu de se doubler.
 *
 * La zone de touche fait bien plus que le trait qu'elle contient.
 */
export function Retour({ vers, libelle }: { vers: string; libelle: string }) {
  return (
    <Link
      href={vers}
      className="-my-2 -ml-2 inline-flex min-h-11 w-fit items-center gap-2 py-2 pr-3 pl-2 text-[12px] tracking-[0.14em] text-tres-doux uppercase transition-colors duration-300 active:text-doux"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[15px] shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M14.5 5.5 8 12l6.5 6.5" />
      </svg>
      {libelle}
    </Link>
  );
}

/**
 * Croix de sortie, pour les écrans sans en-tête où l'on est entré
 * volontairement — la révision. Elle ferme, elle ne remonte pas.
 */
export function CroixSortie({
  onClick,
  libelle = "Quitter la session",
}: {
  onClick: () => void;
  libelle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={libelle}
      className="-m-2 flex size-11 shrink-0 items-center justify-center p-2 text-tres-doux transition-colors duration-300 active:text-texte"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[17px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
      </svg>
    </button>
  );
}
