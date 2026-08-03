import type { Pilier } from "@/db/schema";

/**
 * Quêtes rares.
 *
 * Elles ne viennent d'aucun arc et ne servent aucun objectif : ce sont des
 * écarts, tenables dans la journée, qui font respirer le catalogue habituel.
 * Elles nourrissent le momentum de leur pilier — au double, parce qu'elles
 * demandent de sortir de l'ornière — mais n'entrent dans la progression
 * d'aucun arc.
 *
 * Elles ne sont jamais obligatoires et disparaissent à minuit sans rien laisser.
 */

export type QueteRare = {
  cle: string;
  texte: string;
  pilier: Pilier;
  /** Doublé au moment de créditer le momentum. */
  poids: number;
  dureeMin: number;
};

export const QUETES_RARES: QueteRare[] = [
  // Corps
  { cle: "marche-sans-tel", texte: "Marche 30 min sans téléphone", pilier: "corps", poids: 3, dureeMin: 30 },
  { cle: "escaliers", texte: "Prends les escaliers, toute la journée", pilier: "corps", poids: 2, dureeMin: 0 },
  { cle: "etirements-silence", texte: "Étire-toi dix minutes en silence", pilier: "corps", poids: 2, dureeMin: 10 },
  { cle: "avant-le-jour", texte: "Sors marcher avant que le jour se lève", pilier: "corps", poids: 4, dureeMin: 30 },
  { cle: "trajet-a-pied", texte: "Fais un trajet entier à pied", pilier: "corps", poids: 3, dureeMin: 40 },
  { cle: "danser", texte: "Danse une chanson en entier", pilier: "corps", poids: 2, dureeMin: 5 },
  { cle: "porter-lourd", texte: "Porte quelque chose de lourd, sans aide", pilier: "corps", poids: 2, dureeMin: 10 },

  // Deen
  { cle: "sourate-inconnue", texte: "Lis une sourate que tu ne connais pas", pilier: "deen", poids: 3, dureeMin: 15 },
  { cle: "un-mot-arabe", texte: "Apprends un seul mot arabe, en profondeur", pilier: "deen", poids: 3, dureeMin: 15 },
  { cle: "dhikr-en-marchant", texte: "Fais un dhikr en marchant, sans compter", pilier: "deen", poids: 2, dureeMin: 15 },
  { cle: "recitation-entiere", texte: "Écoute une récitation en entier, sans rien faire d'autre", pilier: "deen", poids: 3, dureeMin: 20 },
  { cle: "invocation-mots", texte: "Écris une invocation avec tes mots", pilier: "deen", poids: 3, dureeMin: 15 },
  { cle: "donner-sans-dire", texte: "Offre quelque chose sans le dire à personne", pilier: "deen", poids: 4, dureeMin: 15 },
  { cle: "pardonner-silence", texte: "Laisse passer une rancune, en silence", pilier: "deen", poids: 4, dureeMin: 0 },

  // Table
  { cle: "plat-de-chez-toi", texte: "Cuisine un plat de chez toi", pilier: "table", poids: 4, dureeMin: 60 },
  { cle: "repas-sans-ecran", texte: "Mange un repas sans écran, à table", pilier: "table", poids: 2, dureeMin: 30 },
  { cle: "fruit-inconnu", texte: "Achète un fruit que tu n'as jamais goûté", pilier: "table", poids: 2, dureeMin: 15 },
  { cle: "repas-de-demain", texte: "Prépare le repas de demain ce soir", pilier: "table", poids: 3, dureeMin: 40 },
  { cle: "eau-avant-cafe", texte: "Bois un verre d'eau avant chaque café", pilier: "table", poids: 2, dureeMin: 0 },
  { cle: "liste-a-la-main", texte: "Fais ta liste de courses à la main", pilier: "table", poids: 2, dureeMin: 10 },

  // Savoir
  { cle: "livre-abandonne", texte: "Lis 10 pages d'un livre commencé et abandonné", pilier: "savoir", poids: 3, dureeMin: 25 },
  { cle: "expliquer-a-voix-haute", texte: "Explique à voix haute un concept que tu crois savoir", pilier: "savoir", poids: 4, dureeMin: 15 },
  { cle: "vieille-copie", texte: "Relis une copie ancienne sans te juger", pilier: "savoir", poids: 3, dureeMin: 20 },
  { cle: "origine-d-un-mot", texte: "Cherche l'origine d'un mot de ton domaine", pilier: "savoir", poids: 2, dureeMin: 15 },
  { cle: "question-non-posee", texte: "Écris la question que tu n'oses pas poser", pilier: "savoir", poids: 4, dureeMin: 15 },
  { cle: "these-au-hasard", texte: "Lis l'introduction d'une thèse au hasard", pilier: "savoir", poids: 3, dureeMin: 25 },

  // Œuvre
  { cle: "page-que-personne", texte: "Écris une page que personne ne lira", pilier: "oeuvre", poids: 3, dureeMin: 25 },
  { cle: "dessiner-fenetre", texte: "Dessine ce que tu vois par la fenêtre", pilier: "oeuvre", poids: 2, dureeMin: 20 },
  { cle: "trois-mauvaises-idees", texte: "Note trois mauvaises idées, exprès", pilier: "oeuvre", poids: 2, dureeMin: 10 },
  { cle: "ecrire-a-quelqu-un", texte: "Écris à quelqu'un dont le travail t'a marquée", pilier: "oeuvre", poids: 4, dureeMin: 20 },
  { cle: "photographier-longuement", texte: "Photographie une seule chose, longuement", pilier: "oeuvre", poids: 2, dureeMin: 15 },
  { cle: "montrer-inacheve", texte: "Montre quelque chose d'inachevé à quelqu'un", pilier: "oeuvre", poids: 4, dureeMin: 15 },

  // Sève
  { cle: "appeler-famille", texte: "Appelle quelqu'un de ta famille", pilier: "seve", poids: 4, dureeMin: 20 },
  { cle: "dehors-sans-rien", texte: "Reste dix minutes dehors sans rien faire", pilier: "seve", poids: 2, dureeMin: 10 },
  { cle: "lettre-non-envoyee", texte: "Écris une lettre que tu n'enverras pas", pilier: "seve", poids: 3, dureeMin: 25 },
  { cle: "album-entier", texte: "Écoute un album en entier, sans rien faire d'autre", pilier: "seve", poids: 3, dureeMin: 40 },
  { cle: "endroit-jamais-vu", texte: "Marche jusqu'à un endroit où tu n'es jamais allée", pilier: "seve", poids: 4, dureeMin: 45 },
  { cle: "avenir-il-y-a-cinq-ans", texte: "Note ce que tu voyais de l'avenir il y a cinq ans", pilier: "seve", poids: 3, dureeMin: 20 },
  { cle: "une-heure-sans-parler", texte: "Ne dis rien pendant une heure", pilier: "seve", poids: 3, dureeMin: 60 },
  { cle: "regarder-le-ciel", texte: "Regarde le ciel jusqu'à ce que ça devienne long", pilier: "seve", poids: 2, dureeMin: 10 },
];
