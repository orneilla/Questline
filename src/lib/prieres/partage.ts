/**
 * Les cinq prières — partagé serveur et navigateur.
 *
 * Aucune dépendance à la base : ce fichier est importé par des composants
 * client. Il porte la liste, les fenêtres, et la mise en forme.
 *
 * ── Ce qui n'est pas ici, et ne le sera pas
 *
 * Aucun total, aucun compte, aucune série, aucun pourcentage, aucun palier.
 * Une prière est cochée ou elle ne l'est pas ; deux jours ne se comparent pas.
 * Le suivi ne communique avec rien : il ne touche ni aux piliers, ni à l'élan,
 * ni aux quêtes, ni au journal, ni aux saisons. Ce qui est fait là ne se
 * comptabilise nulle part ailleurs — c'est la condition posée pour qu'il
 * existe.
 */

export const CLES_PRIERE = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

export type ClePriere = (typeof CLES_PRIERE)[number];

export type FichePriere = {
  cle: ClePriere;
  nom: string;
  /** Ce que le moment est, en clair. Pas un commentaire, un repère. */
  moment: string;
};

export const PRIERES: FichePriere[] = [
  { cle: "fajr", nom: "Fajr", moment: "avant le lever du soleil" },
  { cle: "dhuhr", nom: "Dhuhr", moment: "après que le soleil a passé le zénith" },
  { cle: "asr", nom: "Asr", moment: "l'après-midi" },
  { cle: "maghrib", nom: "Maghrib", moment: "au coucher du soleil" },
  { cle: "isha", nom: "Isha", moment: "la nuit tombée" },
];

export function fichePriere(cle: string): FichePriere | undefined {
  return PRIERES.find((p) => p.cle === cle);
}

export function estClePriere(valeur: string): valeur is ClePriere {
  return (CLES_PRIERE as readonly string[]).includes(valeur);
}

/* ────────────────────── Affichage d'une heure ────────────────────── */

/**
 * Une heure sur le cadran, à partir de minutes qui peuvent dépasser minuit.
 *
 * Rend une chaîne vide quand le repère n'existe pas — ce qui arrive vraiment,
 * en juin, si aucune règle de nuit courte n'est choisie. Mieux vaut un vide
 * assumé qu'un chiffre inventé.
 */
export function formaterHeure(minutes: number): string {
  if (!Number.isFinite(minutes)) return "";
  const sur24 = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(sur24 / 60);
  const m = sur24 % 60;
  return `${String(h).padStart(2, "0")} h ${String(m).padStart(2, "0")}`;
}

/* ────────────────────── L'état d'une prière ────────────────────── */

export type EtatPriere =
  /** Son heure n'est pas encore venue. */
  | "avenir"
  /** On est dans sa fenêtre. */
  | "en_cours"
  /** Sa fenêtre est passée. */
  | "passee"
  /** Cochée, quel que soit le moment où elle l'a été. */
  | "faite"
  /** Le calcul ne donne pas d'heure ce jour-là. */
  | "sans_heure";

export type LignePriere = {
  cle: ClePriere;
  nom: string;
  moment: string;
  /** Minutes depuis minuit ; peut dépasser 1440. NaN si le repère manque. */
  debut: number;
  /** Fin de la fenêtre, même échelle. */
  fin: number;
  faite: boolean;
  etat: EtatPriere;
};

/**
 * Les cinq lignes d'une journée, avec leur fenêtre.
 *
 * Les fenêtres s'enchaînent : le Fajr court jusqu'au lever du soleil, le Dhuhr
 * jusqu'à l'Asr, l'Asr jusqu'au Maghrib, le Maghrib jusqu'à l'Isha, l'Isha
 * jusqu'au Fajr du lendemain. C'est ce qui permet de dire « on est dedans »
 * sans jamais dire « tu es en retard ».
 */
export function lignesDuJour(
  reperes: {
    fajr: number;
    lever: number;
    dhuhr: number;
    asr: number;
    maghrib: number;
    isha: number;
  },
  faites: readonly string[],
  /** Minutes depuis minuit dans la journée regardée, ou null si ce n'est pas aujourd'hui. */
  maintenant: number | null,
): LignePriere[] {
  const fins: Record<ClePriere, number> = {
    fajr: reperes.lever,
    dhuhr: reperes.asr,
    asr: reperes.maghrib,
    maghrib: reperes.isha,
    // Le Fajr du lendemain tombe à peu près à la même heure que celui du jour :
    // l'ajouter d'une journée est une approximation d'une poignée de minutes,
    // et elle ne sert qu'à savoir si la fenêtre est encore ouverte.
    isha: reperes.fajr + 1440,
  };

  return PRIERES.map((priere) => {
    const debut = reperes[priere.cle];
    const fin = fins[priere.cle];
    const faite = faites.includes(priere.cle);

    let etat: EtatPriere;
    if (faite) etat = "faite";
    else if (!Number.isFinite(debut)) etat = "sans_heure";
    else if (maintenant === null) etat = "passee";
    else if (maintenant < debut) etat = "avenir";
    else if (Number.isFinite(fin) && maintenant >= fin) etat = "passee";
    else etat = "en_cours";

    return { ...priere, debut, fin, faite, etat };
  });
}

/**
 * Ce qu'on affiche en tête d'écran.
 *
 * Un fait : la prière en cours, ou la prochaine et son heure. Jamais un compte
 * de ce qui manque, jamais un encouragement.
 */
export function repere(lignes: LignePriere[], maintenant: number | null): string {
  if (maintenant === null) return "";

  const enCours = lignes.find((l) => l.etat === "en_cours" || (l.faite && dansLaFenetre(l, maintenant)));
  if (enCours) return `${enCours.nom} — jusqu'à ${formaterHeure(enCours.fin)}`;

  const suivante = lignes.find((l) => Number.isFinite(l.debut) && maintenant < l.debut);
  if (suivante) return `${suivante.nom} à partir de ${formaterHeure(suivante.debut)}`;

  return "";
}

/* ────────────────────── Quels rappels sont dus ────────────────────── */

/**
 * Passé ce retard, le rappel n'a plus d'objet et n'est pas envoyé.
 *
 * Recevoir « Fajr — 06 h 06 » à midi n'aide personne, et rattraper cinq
 * messages d'un coup au milieu de la nuit serait pire que de n'en envoyer
 * aucun.
 */
export const RETARD_MAX = 90;

/**
 * Les prières dont l'heure est entrée, dans l'ordre, sans celles déjà cochées.
 *
 * La question n'est pas « est-on à la minute pile ? » — le déclencheur planifié
 * ne le garantit pas — mais « cette prière est-elle entrée depuis peu et son
 * message n'est-il pas déjà parti ? ». L'idempotence de l'envoi fait le reste.
 */
export function prieresDues(
  reperes: Record<string, number>,
  voulues: readonly string[],
  faites: readonly string[],
  maintenant: number,
): ClePriere[] {
  return voulues
    .filter((cle): cle is ClePriere => estClePriere(cle) && cle in reperes)
    .filter((cle) => {
      if (faites.includes(cle)) return false;
      const heure = reperes[cle];
      if (!Number.isFinite(heure)) return false;
      const ecart = maintenant - heure;
      return ecart >= 0 && ecart <= RETARD_MAX;
    })
    .sort((a, b) => reperes[a] - reperes[b]);
}

function dansLaFenetre(ligne: LignePriere, maintenant: number): boolean {
  if (!Number.isFinite(ligne.debut)) return false;
  if (maintenant < ligne.debut) return false;
  return !Number.isFinite(ligne.fin) || maintenant < ligne.fin;
}
