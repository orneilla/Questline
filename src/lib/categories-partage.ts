/**
 * Les catégories de créneau — partagé serveur et navigateur.
 *
 * Pas de dépendance à la base ici : ce fichier est importé par des composants
 * client, qui n'y ont pas accès. Il ne porte que la forme, les repères de
 * secours et les fonctions de lecture.
 */

export type CategorieAffichee = {
  cle: string;
  nom: string;
  couleur: string;
  ordre: number;
};

/**
 * La palette proposée au choix.
 *
 * Sept teintes tenues ensemble : deux verts, trois roses, une sauge, un crème.
 * Elles servent d'abord aux catégories, où la lisibilité vient du contraste
 * entre elles plutôt que de leur éclat pris un par un.
 */
export const PALETTE_CRENEAUX = [
  "#4A6644",
  "#9FAA74",
  "#D7DAB3",
  "#C66F80",
  "#F4C7D0",
  "#FCEBF1",
  "#ECE3D2",
] as const;

/**
 * Ce que valent les catégories quand la base ne répond pas.
 *
 * Un composant peut être rendu hors de la coque — un écran d'installation, un
 * test — et doit alors afficher quelque chose de juste plutôt que de casser.
 */
export const CATEGORIES_ORIGINE: CategorieAffichee[] = [
  { cle: "cours", nom: "Cours", couleur: "#4A6644", ordre: 1 },
  { cle: "revisions", nom: "Révisions", couleur: "#9FAA74", ordre: 2 },
  { cle: "travail", nom: "Travail", couleur: "#C66F80", ordre: 3 },
  { cle: "sport", nom: "Sport", couleur: "#ECE3D2", ordre: 4 },
  { cle: "priere", nom: "Prière", couleur: "#D7DAB3", ordre: 5 },
  { cle: "perso", nom: "Personnel", couleur: "#F4C7D0", ordre: 6 },
  { cle: "autre", nom: "Autre", couleur: "#FCEBF1", ordre: 7 },
];

export function nomCategorieBloc(
  liste: CategorieAffichee[],
  cle: string | null,
): string {
  if (!cle) return "Autre";
  return liste.find((c) => c.cle === cle)?.nom ?? cle;
}

export function couleurCategorieBloc(
  liste: CategorieAffichee[],
  cle: string | null,
): string {
  const trouvee = cle ? liste.find((c) => c.cle === cle) : undefined;
  if (trouvee) return trouvee.couleur;
  return liste.find((c) => c.cle === "autre")?.couleur ?? "#8a8f98";
}

/** Plie une chaîne pour la comparer : minuscules, sans accent ni ponctuation. */
export function replier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Une clé utilisable, dérivée d'un nom. */
export function clePropre(nom: string): string {
  return replier(nom).replace(/ /g, "_").slice(0, 24);
}

export function couleurValide(valeur: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(valeur);
}

/** Luminance relative, au sens de la norme d'accessibilité. */
function luminance(couleur: string): number {
  const canaux = [1, 3, 5].map((debut) => {
    const brut = parseInt(couleur.slice(debut, debut + 2), 16) / 255;
    return brut <= 0.04045 ? brut / 12.92 : ((brut + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2];
}

/**
 * Quelle part de la teinte poser dans le fond d'un bloc.
 *
 * La palette est faite pour du papier ; l'application est noire. Un même voile
 * pour tous ferait disparaître le vert profond — celui des cours, donc le bloc
 * le plus fréquent de la semaine — pendant que les roses pâles éclateraient.
 *
 * La teinte n'est jamais retouchée : c'est celle qui a été choisie, et elle
 * doit se reconnaître. Seule sa couverture varie, à l'inverse de sa clarté.
 */
export function voileCategorie(couleur: string): number {
  if (!couleurValide(couleur)) return 0.15;
  const part = 0.52 - 0.42 * Math.sqrt(luminance(couleur));
  return Math.min(0.42, Math.max(0.13, part));
}

/** La même teinte, posée en fond : `rgb(… / …)` plutôt qu'un suffixe alpha. */
export function fondCategorie(couleur: string, facteur = 1): string {
  const canaux = [1, 3, 5].map((debut) => parseInt(couleur.slice(debut, debut + 2), 16));
  if (canaux.some((c) => Number.isNaN(c))) return "transparent";
  const alpha = (voileCategorie(couleur) * facteur).toFixed(3);
  return `rgb(${canaux[0]} ${canaux[1]} ${canaux[2]} / ${alpha})`;
}

export type RegleAffichee = {
  id: number;
  motif: string;
  categorie: string;
  ordre: number;
};

/**
 * Le motif est-il le début d'un mot du titre ?
 *
 * Pas une simple inclusion : « td » se retrouve dans « étude », « cm » dans
 * « documentaire », et un mot-clé de deux lettres classerait alors n'importe
 * quoi. Pas une égalité de mot non plus : « révision » doit attraper
 * « Révisions », et « sport » « Sportive ». Le début d'un mot est le seul
 * repère qui tient les deux.
 *
 * Un motif de plusieurs mots marche pareil : il doit commencer sur un mot.
 */
function commenceUnMot(plie: string, motif: string): boolean {
  let depuis = 0;
  for (;;) {
    const trouve = plie.indexOf(motif, depuis);
    if (trouve < 0) return false;
    if (trouve === 0 || plie[trouve - 1] === " ") return true;
    depuis = trouve + 1;
  }
}

/**
 * À quelle catégorie appartient un créneau importé, d'après son titre.
 *
 * La première règle dont le mot-clé commence un mot du titre gagne : l'ordre
 * des règles est la seule autorité. Rien n'est deviné autrement — aucun
 * modèle, aucune heuristique cachée — et on peut donc toujours dire pourquoi
 * un bloc a telle couleur.
 */
export function classer(
  titre: string,
  regles: RegleAffichee[],
  defaut = "autre",
): string {
  const plie = replier(titre);
  if (plie.length === 0) return defaut;

  for (const regle of [...regles].sort((a, b) => a.ordre - b.ordre || a.id - b.id)) {
    const motif = replier(regle.motif);
    if (motif.length === 0) continue;
    if (commenceUnMot(plie, motif)) return regle.categorie;
  }

  return defaut;
}
