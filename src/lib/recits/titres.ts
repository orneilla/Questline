import type { TypeJour } from "@/db/schema";

/**
 * Catalogue des titres du jour.
 *
 * Le registre : constatif, un peu littéraire, jamais encourageant. Un titre
 * nomme la journée telle qu'elle se présente — il ne la commente pas et ne
 * demande rien. Aucun point d'exclamation, aucun impératif, aucun « tu ».
 *
 * Un titre sans condition entre dans le fond commun ; un titre conditionné ne
 * sort que si toutes ses conditions tiennent, et passe alors devant les autres.
 */

export type Saison = "hiver" | "printemps" | "ete" | "automne";
export type NiveauElan = "bas" | "moyen" | "haut";

export type ContexteTitre = {
  charge: TypeJour;
  recuperation: boolean;
  modeBas: boolean;
  elan: NiveauElan;
  saison: Saison;
  /** 0 = dimanche … 6 = samedi. */
  jourSemaine: number;
  heure: number;
};

export type Titre = {
  cle: string;
  texte: string;
  charge?: TypeJour[];
  recuperation?: true;
  modeBas?: true;
  elan?: NiveauElan[];
  saison?: Saison[];
  jours?: number[];
  /** Bornes horaires, en heures pleines. */
  avant?: number;
  apres?: number;
};

export const TITRES: Titre[] = [
  // Fond commun — aucune condition.
  { cle: "fil-reprend", texte: "Le fil reprend" },
  { cle: "jour-ordinaire", texte: "Un jour ordinaire" },
  { cle: "rien-ne-presse", texte: "Rien ne presse" },
  { cle: "ce-qui-tient", texte: "Ce qui tient" },
  { cle: "travail-du-fond", texte: "Le travail du fond" },
  { cle: "sans-hate", texte: "Sans hâte" },
  { cle: "voix-basse", texte: "À voix basse" },
  { cle: "geste-suffit", texte: "Le geste suffit" },
  { cle: "se-continue", texte: "Ce qui se continue" },
  { cle: "ordinaire-encore", texte: "L'ordinaire, encore" },
  { cle: "poser-pierre", texte: "Poser une pierre" },
  { cle: "temps-qu-il-faut", texte: "Le temps qu'il faut" },
  { cle: "rien-urgent", texte: "Rien d'urgent" },
  { cle: "continuer-simplement", texte: "Continuer simplement" },
  { cle: "un-pas", texte: "Un pas, puis l'autre" },
  { cle: "au-present", texte: "Au présent" },
  { cle: "pas-de-ceremonie", texte: "Sans cérémonie" },
  { cle: "jour-de-plus", texte: "Un jour de plus, simplement" },

  // Journée pleine — presque pas de temps.
  { cle: "journee-etroite", texte: "Journée étroite", charge: ["pleine"] },
  { cle: "peu-mais-tenu", texte: "Peu, mais tenu", charge: ["pleine"] },
  { cle: "strict-necessaire", texte: "Le strict nécessaire", charge: ["pleine"] },
  { cle: "une-seule-chose", texte: "Une seule chose", charge: ["pleine"] },
  { cle: "serre", texte: "Serré", charge: ["pleine"] },
  { cle: "reste-de-place", texte: "Ce qu'il reste de place", charge: ["pleine"] },

  // Journée chargée.
  { cle: "entre-deux", texte: "Entre deux", charge: ["chargee"] },
  { cle: "temps-compte", texte: "Le temps compté", charge: ["chargee"] },
  { cle: "a-la-marge", texte: "À la marge", charge: ["chargee"] },
  { cle: "deux-gestes", texte: "Deux gestes", charge: ["chargee"] },
  { cle: "interstices", texte: "Dans les interstices", charge: ["chargee"] },

  // Journée libre.
  { cle: "devant-soi", texte: "Devant soi", charge: ["libre"] },
  { cle: "journee-entiere", texte: "La journée entière", charge: ["libre"] },
  { cle: "rien-qui-borne", texte: "Rien qui borne", charge: ["libre"] },
  { cle: "champ-libre", texte: "Le champ libre" , charge: ["libre"] },
  { cle: "large", texte: "Large", charge: ["libre"] },
  { cle: "de-la-place", texte: "De la place", charge: ["libre"] },

  // Lendemain d'une nuit entamée.
  { cle: "apres-la-nuit", texte: "Après la nuit", recuperation: true },
  { cle: "le-lendemain", texte: "Le lendemain", recuperation: true },
  { cle: "reprendre-lentement", texte: "Reprendre lentement", recuperation: true },
  { cle: "corps-d-abord", texte: "Le corps d'abord", recuperation: true },
  { cle: "sortir-du-sommeil", texte: "Sortir du sommeil", recuperation: true },
  { cle: "dette-de-sommeil", texte: "La dette se rembourse", recuperation: true },

  // Jour bas.
  { cle: "au-plus-simple", texte: "Au plus simple", modeBas: true },
  { cle: "un-geste-pas-plus", texte: "Un geste, pas plus", modeBas: true },
  { cle: "assez", texte: "Assez", modeBas: true },
  { cle: "tenir-seulement", texte: "Tenir, seulement", modeBas: true },
  { cle: "jour-creux", texte: "Jour creux, jour valable", modeBas: true },

  // Élan bas — les piliers se sont tus.
  { cle: "rallumer", texte: "Rallumer", elan: ["bas"] },
  { cle: "repartir-de-peu", texte: "Repartir de peu", elan: ["bas"] },
  { cle: "premiere-braise", texte: "La première braise", elan: ["bas"] },
  { cle: "ce-qui-redemarre", texte: "Ce qui redémarre", elan: ["bas"] },
  { cle: "silence-assez-dure", texte: "Le silence a assez duré", elan: ["bas"] },
  { cle: "bas-de-pente", texte: "Le bas de la pente", elan: ["bas"] },

  // Élan haut.
  { cle: "elan-est-la", texte: "L'élan est là", elan: ["haut"] },
  { cle: "porte", texte: "Porté", elan: ["haut"] },
  { cle: "ce-qui-roule", texte: "Ce qui roule", elan: ["haut"] },
  { cle: "pente-est-bonne", texte: "La pente est bonne", elan: ["haut"] },
  { cle: "regime-de-croisiere", texte: "Régime de croisière", elan: ["haut"] },

  // Jours de la semaine.
  { cle: "lundi-sans-ceremonie", texte: "Lundi, sans cérémonie", jours: [1] },
  { cle: "debut-de-quelque-chose", texte: "Le début de quelque chose", jours: [1] },
  { cle: "milieu-de-semaine", texte: "Milieu de semaine", jours: [3] },
  { cle: "creux-de-semaine", texte: "Le creux de la semaine", jours: [3] },
  { cle: "jeudi-deja", texte: "Jeudi, déjà", jours: [4] },
  { cle: "vendredi-lent", texte: "Vendredi lent", jours: [5] },
  { cle: "bord-du-weekend", texte: "Le bord du week-end", jours: [5] },
  { cle: "samedi-ouvert", texte: "Samedi ouvert", jours: [6] },
  { cle: "dimanche-bas", texte: "Dimanche bas", jours: [0] },
  { cle: "fin-de-boucle", texte: "Fin de boucle", jours: [0] },

  // Saisons.
  { cle: "hiver-tient", texte: "L'hiver tient", saison: ["hiver"] },
  { cle: "lumiere-courte", texte: "Lumière courte", saison: ["hiver"] },
  { cle: "froid-net", texte: "Froid net", saison: ["hiver"] },
  { cle: "jours-s-allongent", texte: "Les jours s'allongent", saison: ["printemps"] },
  { cle: "quelque-chose-repousse", texte: "Quelque chose repousse", saison: ["printemps"] },
  { cle: "air-neuf", texte: "Air neuf", saison: ["printemps"] },
  { cle: "chaleur-lourde", texte: "Chaleur lourde", saison: ["ete"] },
  { cle: "plein-ete", texte: "Plein été", saison: ["ete"] },
  { cle: "lenteur-d-aout", texte: "Lenteur d'août", saison: ["ete"] },
  { cle: "automne-s-installe", texte: "L'automne s'installe", saison: ["automne"] },
  { cle: "lumiere-baisse", texte: "La lumière baisse", saison: ["automne"] },
  { cle: "saison-rentrante", texte: "Saison rentrante", saison: ["automne"] },

  // Heures extrêmes.
  { cle: "nuit-calme", texte: "Nuit calme", avant: 5 },
  { cle: "avant-le-jour", texte: "Avant le jour", avant: 7 },
  { cle: "tot", texte: "Tôt", avant: 7 },
  { cle: "fin-de-soiree", texte: "Fin de soirée", apres: 21 },
  { cle: "jour-s-acheve", texte: "Le jour s'achève", apres: 21 },
];

/**
 * Spécificité d'un titre : à quel point il parle de cette journée-ci.
 *
 * Toutes les conditions ne se valent pas. Qu'on sorte d'une nuit entamée ou
 * qu'on ait déclaré un jour bas dit quelque chose de la journée ; qu'on soit en
 * été n'en dit presque rien. Sans cette pondération, un titre de saison
 * l'emporterait une fois sur deux sur un titre de récupération, et la journée
 * serait mal nommée.
 */
export function specificite(titre: Titre): number {
  let poids = 0;
  if (titre.modeBas) poids += 5;
  if (titre.recuperation) poids += 4;
  if (titre.avant !== undefined || titre.apres !== undefined) poids += 3;
  if (titre.charge) poids += 2;
  if (titre.elan) poids += 2;
  if (titre.jours) poids += 1;
  if (titre.saison) poids += 1;
  return poids;
}

export function convient(titre: Titre, ctx: ContexteTitre): boolean {
  if (titre.charge && !titre.charge.includes(ctx.charge)) return false;
  if (titre.recuperation && !ctx.recuperation) return false;
  if (titre.modeBas && !ctx.modeBas) return false;
  if (titre.elan && !titre.elan.includes(ctx.elan)) return false;
  if (titre.saison && !titre.saison.includes(ctx.saison)) return false;
  if (titre.jours && !titre.jours.includes(ctx.jourSemaine)) return false;
  if (titre.avant !== undefined && ctx.heure >= titre.avant) return false;
  if (titre.apres !== undefined && ctx.heure < titre.apres) return false;
  return true;
}
