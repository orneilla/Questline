/**
 * Lecture d'un flux iCalendar — logique pure, sans base ni réseau.
 *
 * Un emploi du temps réel est fait de répétitions : un cours le mardi de 8 h à
 * 10 h n'apparaît qu'une fois dans le fichier, avec une règle. Un lecteur qui
 * ignorerait les règles n'importerait presque rien.
 *
 * Deux principes gouvernent ce fichier.
 *
 * Les répétitions se déroulent en heure murale, pas en instants. Un cours de
 * 9 h reste à 9 h quand l'heure d'été tombe ; le calculer en ajoutant sept fois
 * vingt-quatre heures le décalerait d'une heure à chaque changement. On répète
 * donc sur le calendrier, puis on convertit.
 *
 * Et ce qu'on ne comprend pas, on le dit. Une règle non gérée ne produit pas
 * une occurrence approximative : elle est signalée, l'événement est rendu tel
 * quel à sa première date, et le compte des cas ignorés remonte à l'écran.
 */

/* ────────────────────── Heure murale et fuseaux ────────────────────── */

/** Une date-heure telle qu'elle est écrite au mur, sans fuseau attaché. */
export type Murale = {
  annee: number;
  mois: number; // 1–12
  jour: number;
  heure: number;
  minute: number;
};

const MS_JOUR = 86_400_000;

function enUtc(m: Murale): number {
  return Date.UTC(m.annee, m.mois - 1, m.jour, m.heure, m.minute);
}

function depuisUtc(ms: number): Murale {
  const d = new Date(ms);
  return {
    annee: d.getUTCFullYear(),
    mois: d.getUTCMonth() + 1,
    jour: d.getUTCDate(),
    heure: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

const formateurs = new Map<string, Intl.DateTimeFormat>();

function formateur(zone: string): Intl.DateTimeFormat {
  let f = formateurs.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    formateurs.set(zone, f);
  }
  return f;
}

/** L'heure murale d'un instant, dans un fuseau donné. */
export function muraleDans(instant: number, zone: string): Murale {
  const parts = formateur(zone).formatToParts(new Date(instant));
  const lire = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // « 24 » apparaît à minuit dans certaines implémentations.
  const heure = lire("hour") % 24;
  return {
    annee: lire("year"),
    mois: lire("month"),
    jour: lire("day"),
    heure,
    minute: lire("minute"),
  };
}

/**
 * L'instant correspondant à une heure murale dans un fuseau.
 *
 * Deux passes : on suppose d'abord que le fuseau est à UTC, on mesure l'écart
 * réel à cet instant-là, on corrige, puis on vérifie une seconde fois. La
 * seconde passe rattrape les bascules d'heure d'été, où l'écart mesuré au
 * premier essai n'est pas celui qui s'applique à l'arrivée.
 */
export function instantDe(m: Murale, zone: string): number {
  let essai = enUtc(m);
  for (let i = 0; i < 2; i += 1) {
    const vu = muraleDans(essai, zone);
    const ecart = enUtc(m) - enUtc(vu);
    if (ecart === 0) break;
    essai += ecart;
  }
  return essai;
}

/* ────────────────────── Découpage du fichier ────────────────────── */

/**
 * Déplie les lignes.
 *
 * iCalendar coupe les lignes longues et préfixe la suite d'une espace ou d'une
 * tabulation. Un titre de cours un peu long arrive donc en deux morceaux.
 */
export function deplier(contenu: string): string[] {
  const brutes = contenu.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lignes: string[] = [];

  for (const ligne of brutes) {
    if ((ligne.startsWith(" ") || ligne.startsWith("\t")) && lignes.length > 0) {
      lignes[lignes.length - 1] += ligne.slice(1);
      continue;
    }
    lignes.push(ligne);
  }

  return lignes;
}

export type Propriete = {
  nom: string;
  parametres: Record<string, string>;
  valeur: string;
};

/** `DTSTART;TZID=Europe/Paris:20260901T080000` → nom, paramètres, valeur. */
export function lireLigne(ligne: string): Propriete | null {
  const separateur = ligne.indexOf(":");
  if (separateur < 0) return null;

  const gauche = ligne.slice(0, separateur);
  const valeur = ligne.slice(separateur + 1);
  const morceaux = gauche.split(";");
  const nom = morceaux[0].toUpperCase();

  const parametres: Record<string, string> = {};
  for (const morceau of morceaux.slice(1)) {
    const egal = morceau.indexOf("=");
    if (egal < 0) continue;
    parametres[morceau.slice(0, egal).toUpperCase()] = morceau
      .slice(egal + 1)
      .replace(/^"|"$/g, "");
  }

  return { nom, parametres, valeur };
}

/** Le texte d'un champ, échappements iCalendar défaits. */
function texte(valeur: string): string {
  return valeur
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

/* ────────────────────── Dates ────────────────────── */

export type Horodatage = {
  murale: Murale;
  /** Le fuseau à appliquer, ou null pour une heure flottante. */
  zone: string | null;
  /** Vrai pour une date sans heure : l'événement occupe la journée. */
  journeeEntiere: boolean;
};

/** `20260901T080000`, `20260901T060000Z`, `20260901`. */
export function lireDate(propriete: Propriete): Horodatage | null {
  const brut = propriete.valeur.trim();
  const dateSeule = /^(\d{4})(\d{2})(\d{2})$/.exec(brut);

  if (dateSeule) {
    return {
      murale: {
        annee: Number(dateSeule[1]),
        mois: Number(dateSeule[2]),
        jour: Number(dateSeule[3]),
        heure: 0,
        minute: 0,
      },
      zone: null,
      journeeEntiere: true,
    };
  }

  const avecHeure = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(brut);
  if (!avecHeure) return null;

  const murale: Murale = {
    annee: Number(avecHeure[1]),
    mois: Number(avecHeure[2]),
    jour: Number(avecHeure[3]),
    heure: Number(avecHeure[4]),
    minute: Number(avecHeure[5]),
  };

  if (avecHeure[7] === "Z") return { murale, zone: "UTC", journeeEntiere: false };
  return { murale, zone: propriete.parametres.TZID ?? null, journeeEntiere: false };
}

/* ────────────────────── Règles de répétition ────────────────────── */

export type Regle = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  /** 0 = dimanche … 6 = samedi. */
  byday: number[];
  bymonthday: number[];
  count: number | null;
  until: Horodatage | null;
};

const JOURS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function lireRegle(valeur: string): { regle: Regle | null; comprise: boolean } {
  const champs: Record<string, string> = {};
  for (const morceau of valeur.split(";")) {
    const egal = morceau.indexOf("=");
    if (egal > 0) champs[morceau.slice(0, egal).toUpperCase()] = morceau.slice(egal + 1);
  }

  const freq = (champs.FREQ ?? "").toUpperCase();
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") {
    return { regle: null, comprise: false };
  }

  // BYSETPOS, BYWEEKNO, BYYEARDAY et les BYDAY ordinaux (« 2TU ») ne sont pas
  // gérés. Plutôt que de produire des dates fausses, on le signale.
  const compliques = ["BYSETPOS", "BYWEEKNO", "BYYEARDAY", "BYMONTH", "BYHOUR"];
  const ordinal = /(^|,)[+-]?\d/.test(champs.BYDAY ?? "");
  const comprise = !compliques.some((c) => c in champs) && !ordinal;

  const byday = (champs.BYDAY ?? "")
    .split(",")
    .map((j) => JOURS.indexOf(j.trim().toUpperCase()))
    .filter((n) => n >= 0);

  const bymonthday = (champs.BYMONTHDAY ?? "")
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  const until = champs.UNTIL
    ? lireDate({ nom: "UNTIL", parametres: {}, valeur: champs.UNTIL })
    : null;

  return {
    regle: {
      freq,
      interval: Math.max(1, Number(champs.INTERVAL ?? 1) || 1),
      byday,
      bymonthday,
      count: champs.COUNT ? Number(champs.COUNT) : null,
      until,
    },
    comprise,
  };
}

/** Ajoute des mois à une date murale, en bornant au dernier jour du mois. */
function ajouterMois(m: Murale, n: number): Murale {
  const total = (m.annee * 12 + (m.mois - 1)) + n;
  const annee = Math.floor(total / 12);
  const mois = (total % 12) + 1;
  const dernier = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return { ...m, annee, mois, jour: Math.min(m.jour, dernier) };
}

function ajouterJours(m: Murale, n: number): Murale {
  return { ...depuisUtc(enUtc(m) + n * MS_JOUR), heure: m.heure, minute: m.minute };
}

function jourSemaine(m: Murale): number {
  return new Date(enUtc(m)).getUTCDay();
}

/**
 * Déroule une règle en heures murales, dans une fenêtre.
 *
 * Le déroulé est borné deux fois : par la règle (COUNT, UNTIL) et par la
 * fenêtre demandée. Sans la seconde borne, une règle sans fin produirait une
 * boucle infinie — un cas courant dans un vrai calendrier.
 */
export function derouler(
  depart: Murale,
  regle: Regle,
  zone: string,
  fenetre: { debut: number; fin: number },
): Murale[] {
  const sorties: Murale[] = [];
  const finRegle = regle.until
    ? instantDe(regle.until.murale, regle.until.zone ?? zone)
    : null;

  const MAX_TOURS = 4000;
  let curseur = depart;
  let produites = 0;

  const retenir = (m: Murale): boolean => {
    const instant = instantDe(m, zone);
    if (finRegle !== null && instant > finRegle) return false;
    if (regle.count !== null && produites >= regle.count) return false;
    produites += 1;
    if (instant >= fenetre.debut && instant <= fenetre.fin) sorties.push(m);
    return true;
  };

  for (let tour = 0; tour < MAX_TOURS; tour += 1) {
    if (instantDe(curseur, zone) > fenetre.fin) break;

    if (regle.freq === "WEEKLY" && regle.byday.length > 0) {
      // On se place au dimanche de la semaine du curseur, puis on prend les
      // jours demandés dans l'ordre : une règle « MO,TH » produit bien deux
      // occurrences par semaine, pas une.
      const dimanche = ajouterJours(curseur, -jourSemaine(curseur));
      for (const jour of [...regle.byday].sort((a, b) => a - b)) {
        const candidat = ajouterJours(dimanche, jour);
        if (instantDe(candidat, zone) < instantDe(depart, zone)) continue;
        if (!retenir(candidat)) return sorties;
      }
    } else if (regle.freq === "DAILY" && regle.byday.length > 0) {
      if (regle.byday.includes(jourSemaine(curseur))) {
        if (!retenir(curseur)) return sorties;
      }
    } else if (regle.freq === "MONTHLY" && regle.bymonthday.length > 0) {
      for (const jour of [...regle.bymonthday].sort((a, b) => a - b)) {
        const dernier = new Date(Date.UTC(curseur.annee, curseur.mois, 0)).getUTCDate();
        if (jour > dernier) continue;
        const candidat = { ...curseur, jour };
        if (instantDe(candidat, zone) < instantDe(depart, zone)) continue;
        if (!retenir(candidat)) return sorties;
      }
    } else if (!retenir(curseur)) {
      return sorties;
    }

    if (regle.freq === "DAILY") curseur = ajouterJours(curseur, regle.interval);
    else if (regle.freq === "WEEKLY") curseur = ajouterJours(curseur, 7 * regle.interval);
    else if (regle.freq === "MONTHLY") curseur = ajouterMois(curseur, regle.interval);
    else curseur = ajouterMois(curseur, 12 * regle.interval);
  }

  return sorties;
}

/* ────────────────────── Événements ────────────────────── */

export type EvenementIcs = {
  uid: string;
  titre: string;
  debut: Horodatage;
  /** Durée en minutes murales. Zéro pour un événement d'une journée entière. */
  dureeMinutes: number;
  joursEntiers: number;
  regle: Regle | null;
  /** Vrai si la règle a été comprise entièrement. */
  regleComprise: boolean;
  exdates: string[];
  /** Renseigné pour une occurrence qui en remplace une autre. */
  remplace: string | null;
  annule: boolean;
};

function cleOccurrence(m: Murale): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${m.annee}${p(m.mois)}${p(m.jour)}T${p(m.heure)}${p(m.minute)}`;
}

export function lireEvenements(contenu: string): {
  evenements: EvenementIcs[];
  nomCalendrier: string;
} {
  const lignes = deplier(contenu);
  const evenements: EvenementIcs[] = [];
  let nomCalendrier = "";

  let courant: Partial<EvenementIcs> & { exdates: string[] } = { exdates: [] };
  let dedans = false;
  let fin: Horodatage | null = null;

  for (const ligne of lignes) {
    const p = lireLigne(ligne);
    if (!p) continue;

    if (p.nom === "BEGIN" && p.valeur.trim().toUpperCase() === "VEVENT") {
      dedans = true;
      courant = { exdates: [], annule: false, remplace: null };
      fin = null;
      continue;
    }

    if (p.nom === "END" && p.valeur.trim().toUpperCase() === "VEVENT") {
      dedans = false;
      if (courant.debut && courant.uid) {
        const debut = courant.debut;
        let dureeMinutes = 60;
        let joursEntiers = 1;

        if (fin) {
          const zone = debut.zone ?? "UTC";
          if (debut.journeeEntiere) {
            joursEntiers = Math.max(
              1,
              Math.round((enUtc(fin.murale) - enUtc(debut.murale)) / MS_JOUR),
            );
            dureeMinutes = 0;
          } else {
            dureeMinutes = Math.max(
              0,
              Math.round(
                (instantDe(fin.murale, fin.zone ?? zone) -
                  instantDe(debut.murale, zone)) /
                  60_000,
              ),
            );
          }
        } else if (debut.journeeEntiere) {
          dureeMinutes = 0;
        }

        evenements.push({
          uid: courant.uid,
          titre: courant.titre ?? "Sans titre",
          debut,
          dureeMinutes,
          joursEntiers,
          regle: courant.regle ?? null,
          regleComprise: courant.regleComprise ?? true,
          exdates: courant.exdates,
          remplace: courant.remplace ?? null,
          annule: courant.annule ?? false,
        });
      }
      continue;
    }

    if (!dedans) {
      if (p.nom === "X-WR-CALNAME") nomCalendrier = texte(p.valeur);
      continue;
    }

    switch (p.nom) {
      case "UID":
        courant.uid = p.valeur.trim();
        break;
      case "SUMMARY":
        courant.titre = texte(p.valeur) || "Sans titre";
        break;
      case "DTSTART":
        courant.debut = lireDate(p) ?? undefined;
        break;
      case "DTEND":
        fin = lireDate(p);
        break;
      case "RRULE": {
        const lu = lireRegle(p.valeur);
        courant.regle = lu.regle;
        courant.regleComprise = lu.comprise;
        break;
      }
      case "EXDATE":
        for (const morceau of p.valeur.split(",")) {
          const d = lireDate({ ...p, valeur: morceau });
          if (d) courant.exdates.push(cleOccurrence(d.murale));
        }
        break;
      case "RECURRENCE-ID": {
        const d = lireDate(p);
        if (d) courant.remplace = cleOccurrence(d.murale);
        break;
      }
      case "STATUS":
        if (p.valeur.trim().toUpperCase() === "CANCELLED") courant.annule = true;
        break;
      default:
        break;
    }
  }

  return { evenements, nomCalendrier };
}

/* ────────────────────── Occurrences datées ────────────────────── */

/** Une occurrence, exprimée dans le fuseau de l'application. */
export type Occurrence = {
  uid: string;
  titre: string;
  /** Date locale, `AAAA-MM-JJ`. */
  date: string;
  /** `HH:MM` locales. Une journée entière va de 00:00 à 23:59. */
  debut: string;
  fin: string;
  journeeEntiere: boolean;
};

function iso(m: Murale): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${m.annee}-${p(m.mois)}-${p(m.jour)}`;
}

function hhmm(m: Murale): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(m.heure)}:${p(m.minute)}`;
}

/**
 * Découpe une occurrence sur les jours qu'elle traverse.
 *
 * Le modèle de journée de Questline ne connaît qu'un couple début/fin dans une
 * date. Un créneau qui passe minuit devient donc deux lignes — et l'affichage
 * reste juste des deux côtés, ce qu'un unique bloc « 22 h → 01 h » ne
 * permettrait pas.
 */
function decouper(
  uid: string,
  titre: string,
  debutInstant: number,
  finInstant: number,
  zoneApp: string,
): Occurrence[] {
  const sorties: Occurrence[] = [];
  let curseur = debutInstant;

  for (let garde = 0; garde < 40 && curseur < finInstant; garde += 1) {
    const mDebut = muraleDans(curseur, zoneApp);
    const minuitSuivant = instantDe(
      { ...ajouterJours(mDebut, 1), heure: 0, minute: 0 },
      zoneApp,
    );
    const borne = Math.min(finInstant, minuitSuivant);
    const mFin = muraleDans(borne, zoneApp);

    sorties.push({
      uid,
      titre,
      date: iso(mDebut),
      debut: hhmm(mDebut),
      fin: borne === minuitSuivant ? "23:59" : hhmm(mFin),
      journeeEntiere: false,
    });

    curseur = borne;
  }

  return sorties;
}

/**
 * Déroule tout un calendrier en occurrences datées, dans une fenêtre.
 *
 * Les remplacements (RECURRENCE-ID) sont appliqués après le déroulé : une
 * séance déplacée écarte l'occurrence d'origine et pose la sienne. Les
 * annulations retirent sans rien poser.
 */
export function derouler_calendrier(
  contenu: string,
  zoneApp: string,
  fenetre: { debut: string; fin: string },
): { occurrences: Occurrence[]; nomCalendrier: string; reglesIgnorees: number } {
  const { evenements, nomCalendrier } = lireEvenements(contenu);

  const bornes = {
    debut: instantDe(
      { annee: +fenetre.debut.slice(0, 4), mois: +fenetre.debut.slice(5, 7), jour: +fenetre.debut.slice(8, 10), heure: 0, minute: 0 },
      zoneApp,
    ),
    fin: instantDe(
      { annee: +fenetre.fin.slice(0, 4), mois: +fenetre.fin.slice(5, 7), jour: +fenetre.fin.slice(8, 10), heure: 23, minute: 59 },
      zoneApp,
    ),
  };

  // Les remplacements et annulations, indexés par (uid, occurrence visée).
  const remplacements = new Map<string, EvenementIcs>();
  for (const e of evenements) {
    if (e.remplace) remplacements.set(`${e.uid}|${e.remplace}`, e);
  }

  const occurrences: Occurrence[] = [];
  let reglesIgnorees = 0;

  const poser = (e: EvenementIcs, m: Murale) => {
    const zone = e.debut.zone ?? zoneApp;

    if (e.debut.journeeEntiere) {
      for (let j = 0; j < Math.min(e.joursEntiers, 40); j += 1) {
        const jour = ajouterJours(m, j);
        const instant = instantDe({ ...jour, heure: 12, minute: 0 }, zoneApp);
        if (instant < bornes.debut || instant > bornes.fin) continue;
        occurrences.push({
          uid: e.uid,
          titre: e.titre,
          date: iso(jour),
          debut: "00:00",
          fin: "23:59",
          journeeEntiere: true,
        });
      }
      return;
    }

    const debutInstant = instantDe(m, zone);
    const finInstant = debutInstant + e.dureeMinutes * 60_000;
    if (finInstant < bornes.debut || debutInstant > bornes.fin) return;
    occurrences.push(...decouper(e.uid, e.titre, debutInstant, finInstant, zoneApp));
  };

  for (const e of evenements) {
    if (e.annule) continue;
    // Une occurrence de remplacement est posée par la boucle des remplacements.
    if (e.remplace) continue;

    const zone = e.debut.zone ?? zoneApp;

    if (!e.regle) {
      poser(e, e.debut.murale);
      continue;
    }

    if (!e.regleComprise) {
      reglesIgnorees += 1;
      poser(e, e.debut.murale);
      continue;
    }

    const exclues = new Set(e.exdates);
    for (const m of derouler(e.debut.murale, e.regle, zone, bornes)) {
      const cle = cleOccurrence(m);
      if (exclues.has(cle)) continue;

      const remplacant = remplacements.get(`${e.uid}|${cle}`);
      if (remplacant) {
        if (!remplacant.annule) poser(remplacant, remplacant.debut.murale);
        continue;
      }

      poser(e, m);
    }
  }

  // Les remplacements dont l'occurrence d'origine sort de la fenêtre restent
  // légitimes : une séance déplacée d'une semaine doit apparaître à sa
  // nouvelle date même si l'ancienne n'a pas été déroulée.
  for (const e of remplacements.values()) {
    if (e.annule) continue;
    const deja = occurrences.some(
      (o) => o.uid === e.uid && o.date === iso(e.debut.murale),
    );
    if (!deja) poser(e, e.debut.murale);
  }

  occurrences.sort((a, b) =>
    a.date === b.date ? a.debut.localeCompare(b.debut) : a.date.localeCompare(b.date),
  );

  return { occurrences, nomCalendrier, reglesIgnorees };
}
