/**
 * Jeu de cartes de test.
 *
 * Deux cent dix cartes réparties sur quatre espaces et sept paquets, à des
 * stades de maturité différents, avec du LaTeX, de l'arabe et une image. De
 * quoi peupler le jardin et éprouver les performances.
 *
 * Partagé par le script `npm run db:seed-cartes` et par la route
 * `/api/setup/cartes`, pour qu'il n'existe qu'une seule version de ces données.
 */
import { db } from "./index";
import { cartes, espaces, paquets, revisions } from "./schema";
import { engendrer, type NoteSource } from "@/lib/cartes/generation";
import { aujourdhui, decalerJours } from "@/lib/dates";


type DefinitionPaquet = {
  nom: string;
  notes: NoteSource[];
  /** Part de cartes déjà mûres, pour peupler le jardin à des stades variés. */
  maturite: number;
};

type DefinitionEspace = {
  nom: string;
  couleur: string;
  paquets: DefinitionPaquet[];
};

const T = aujourdhui();

/** Une image minuscule à fond transparent, pour éprouver le rendu. */
const SCHEMA_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAV0lEQVR42mNkYPhfz0AEYBxVSF+FjAxQ8B+I/xOpkAmqiIkYhUxQRUzEKmSCKmIiRiETVBETMQqZoIqYiFHIBFXERIxCJqgiJmIUMkEVMRGjEAB1zQ0Xr0k1lQAAAABJRU5ErkJggg==";

function serie(prefixe: string, elements: [string, string][]): NoteSource[] {
  return elements.map(([recto, verso], i) => ({
    cle: `${prefixe}-${i}`,
    recto,
    verso,
    type: "recto_verso" as const,
  }));
}

const CHIMIE_ORGA: [string, string][] = [
  ["Substitution nucléophile d'ordre 2", "Mécanisme concerté, inversion de Walden, cinétique du second ordre."],
  ["Effet mésomère donneur", "Un doublet non liant se délocalise vers le cycle : $-\\mathrm{OH}$, $-\\mathrm{NH_2}$."],
  ["Règle de Markovnikov", "L'hydrogène se fixe sur le carbone le plus hydrogéné."],
  ["Aromaticité, condition de Hückel", "Cycle plan conjugué à $4n+2$ électrons $\\pi$."],
  ["Réactif de Grignard", "$\\mathrm{R{-}MgX}$ : carbone nucléophile, détruit par l'eau."],
  ["Oxydation d'un alcool secondaire", "Donne une cétone."],
  ["Addition de Michael", "Addition conjuguée d'un nucléophile sur un accepteur $\\alpha,\\beta$-insaturé."],
  ["Protection d'un aldéhyde", "En acétal, par un diol en milieu acide."],
  ["Rétrosynthèse : déconnexion", "Couper une liaison pour remonter à des précurseurs plus simples."],
  ["Énantiomères", "Images l'une de l'autre dans un miroir, non superposables."],
  ["Diastéréoisomères", "Stéréoisomères qui ne sont pas énantiomères."],
  ["Réaction de Diels-Alder", "Cycloaddition $[4+2]$ entre un diène et un diénophile."],
  ["Groupe partant efficace", "Base conjuguée faible : tosylate, iodure, mésylate."],
  ["Élimination E1", "Deux étapes, carbocation intermédiaire, produit de Zaïtsev."],
  ["Estérification de Fischer", "Acide + alcool, catalyse acide, équilibre déplacé par l'eau retirée."],
  ["Tautomérie céto-énolique", "Équilibre entre forme cétone et forme énol."],
  ["Réduction par $\\mathrm{LiAlH_4}$", "Réduit esters, acides et amides ; plus fort que $\\mathrm{NaBH_4}$."],
  ["Chiralité : condition", "Absence de plan et de centre de symétrie."],
  ["Configuration $R$ ou $S$", "Classement CIP des substituants, plus petit vers l'arrière."],
  ["Couplage de Suzuki", "Acide boronique + halogénure, catalyse au palladium."],
  ["Substitution nucléophile d'ordre 1", "Deux étapes, carbocation, racémisation partielle."],
  ["Effet inductif attracteur", "Un atome électronégatif tire la densité par les liaisons $\\sigma$."],
  ["Réarrangement de Hofmann", "Un amide donne une amine avec un carbone de moins."],
  ["Ozonolyse d'un alcène", "Coupe la double liaison, donne deux composés carbonylés."],
  ["Hydroboration-oxydation", "Addition anti-Markovnikov d'eau, stéréochimie syn."],
  ["Aldolisation", "Un énolate additionne un carbonyle, donne un $\\beta$-hydroxycarbonylé."],
  ["Crotonisation", "Déshydratation d'un aldol en énone conjuguée."],
  ["Réaction de Wittig", "Ylure de phosphore + carbonyle : forme un alcène."],
  ["Substitution électrophile aromatique", "Attaque de l'électrophile, puis réaromatisation par perte de $\\mathrm{H^+}$."],
  ["Orientation par un groupe nitro", "Désactivant, orienteur méta."],
  ["Test de Tollens", "Miroir d'argent : révèle un aldéhyde."],
  ["Amine primaire, secondaire, tertiaire", "Une, deux ou trois chaînes sur l'azote."],
  ["Acidité d'un proton en alpha", "Stabilisation de l'énolate par résonance."],
  ["Groupe protecteur d'alcool", "Silylé (TBS), retiré par les fluorures."],
  ["Réaction de Sandmeyer", "Sel de diazonium + sel de cuivre : introduit un halogène."],
  ["Saponification", "Hydrolyse basique d'un ester, irréversible."],
  ["Isomérie E/Z", "Priorités CIP de part et d'autre de la double liaison."],
  ["Conformère chaise", "Forme la plus stable du cyclohexane, substituants en équatorial."],
  ["Tension de cycle", "Maximale pour le cyclopropane, angles très éloignés de 109°."],
  ["Résonance magnétique du proton", "Déplacement chimique, multiplicité, intégration."],
  ["Spectre infrarouge : bande à 1700 cm⁻¹", "Élongation $\\mathrm{C{=}O}$."],
  ["Chromatographie sur couche mince", "Sépare selon la polarité, $R_f$ caractéristique."],
  ["Excès énantiomérique", "$ee = \\frac{|R - S|}{R + S} \\times 100$."],
  ["Catalyse asymétrique", "Un catalyseur chiral favorise un énantiomère."],
  ["Réaction de Heck", "Couplage palladié entre un halogénure et un alcène."],
];

const CHIMIE_INORGA: [string, string][] = [
  ["Champ cristallin octaédrique", "Éclatement en $t_{2g}$ et $e_g$, écart noté $\\Delta_o$."],
  ["Série spectrochimique", "$\\mathrm{I^- < Br^- < Cl^- < F^- < H_2O < NH_3 < CN^-}$."],
  ["Complexe à bas spin", "$\\Delta_o$ grand : les électrons s'apparient avant de peupler $e_g$."],
  ["Effet Jahn-Teller", "Une dégénérescence électronique déforme le complexe."],
  ["Nombre d'oxydation du manganèse dans $\\mathrm{MnO_4^-}$", "$+\\mathrm{VII}$."],
  ["Règle des 18 électrons", "Un complexe stable sature ses orbitales de valence à 18 électrons."],
  ["Ligand bidentate courant", "L'éthylènediamine, $\\mathrm{en}$."],
  ["Effet chélate", "Un ligand polydentate stabilise davantage : gain entropique."],
  ["Structure du chlorure de sodium", "Cubique à faces centrées, coordinence 6/6."],
  ["Loi de Bragg", "$n\\lambda = 2d\\sin\\theta$."],
  ["Paramagnétisme", "Présence d'électrons célibataires."],
  ["Théorie du champ de ligands", "Extension du champ cristallin tenant compte du recouvrement orbitalaire."],
  ["Isomérie de liaison", "$\\mathrm{NO_2^-}$ se lie par l'azote ou par l'oxygène."],
  ["Énergie réticulaire", "Énergie libérée à la formation du solide ionique depuis les ions gazeux."],
  ["Cycle de Born-Haber", "Décomposition thermodynamique de la formation d'un solide ionique."],
  ["Champ cristallin tétraédrique", "Éclatement inversé, $\\Delta_t \\approx \\frac{4}{9}\\Delta_o$."],
  ["Complexe à haut spin", "$\\Delta$ faible : les électrons peuplent tous les niveaux avant de s'apparier."],
  ["Ligand à champ fort", "$\\mathrm{CN^-}$, $\\mathrm{CO}$ : grand éclatement, bas spin."],
  ["Rétrodonation $\\pi$", "Le métal cède de la densité vers les orbitales $\\pi^*$ du ligand."],
  ["Nombre de coordination usuel du fer(II)", "Six."],
  ["Isomérie optique d'un complexe", "Un complexe tris-chélate existe en $\\Delta$ et $\\Lambda$."],
  ["Structure blende", "Cubique, coordinence 4/4, type $\\mathrm{ZnS}$."],
  ["Structure fluorine", "Type $\\mathrm{CaF_2}$, coordinence 8/4."],
  ["Défaut de Schottky", "Lacunes cationique et anionique appariées."],
  ["Défaut de Frenkel", "Un ion quitte son site pour un interstice."],
  ["Semi-conducteur dopé n", "Dopant donneur, porteurs majoritaires électrons."],
  ["Loi de Vegard", "Le paramètre de maille varie linéairement avec la composition."],
  ["Diagramme de Latimer", "Enchaîne les potentiels standard entre degrés d'oxydation."],
  ["Diagramme de Frost", "Trace $nE^0$ en fonction du degré d'oxydation."],
  ["Dismutation", "Une espèce s'oxyde et se réduit simultanément."],
];

const ARABE: [string, string][] = [
  ["كِتَاب", "livre"],
  ["مَدْرَسَة", "école"],
  ["عِلْم", "science, savoir"],
  ["صَبْر", "patience, endurance"],
  ["نُور", "lumière"],
  ["قَلْب", "cœur"],
  ["طَرِيق", "chemin, voie"],
  ["بَيْت", "maison"],
  ["شَمْس", "soleil"],
  ["قَمَر", "lune"],
  ["مَاء", "eau"],
  ["سَمَاء", "ciel"],
  ["أَرْض", "terre"],
  ["يَد", "main"],
  ["عَيْن", "œil, source"],
  ["بَاب", "porte"],
  ["رَحْمَة", "miséricorde"],
  ["حِكْمَة", "sagesse"],
  ["عَدْل", "justice"],
  ["أَمَانَة", "dépôt, loyauté"],
  ["طَعَام", "nourriture"],
  ["لَيْل", "nuit"],
  ["نَهَار", "jour"],
  ["جَبَل", "montagne"],
  ["بَحْر", "mer"],
  ["شَجَرَة", "arbre"],
  ["وَرَق", "feuille, papier"],
  ["مِفْتَاح", "clé"],
  ["سُوق", "marché"],
  ["طَبِيب", "médecin"],
  ["مَطَر", "pluie"],
  ["رِيح", "vent"],
  ["نَجْم", "étoile"],
  ["صَدِيق", "ami"],
  ["أُسْرَة", "famille"],
  ["لُغَة", "langue"],
  ["سُؤَال", "question"],
  ["جَوَاب", "réponse"],
  ["عَمَل", "travail, action"],
  ["وَقْت", "temps"],
];

const OUSOUL: [string, string][] = [
  ["Les cinq statuts légaux", "Obligatoire, recommandé, permis, réprouvé, interdit."],
  ["Définition de l'ijmâ'", "Consensus des savants d'une époque sur une question."],
  ["Le qiyâs", "Analogie : étendre un statut à un cas non traité, par la cause commune."],
  ["'Illa", "La cause efficiente qui justifie un statut."],
  ["Naskh", "Abrogation d'un texte par un texte postérieur."],
  ["Différence 'âmm / khâss", "Terme général opposé à terme particulier."],
  ["Mutlaq et muqayyad", "Absolu opposé à conditionné."],
  ["Les maqâsid", "Religion, vie, raison, descendance, biens."],
  ["Istishâb", "Présomption de continuité de l'état antérieur."],
  ["Hadith mutawâtir", "Rapporté par un si grand nombre que la collusion est exclue."],
  ["Hadith âhâd", "Rapporté par un nombre restreint de chaînes."],
  ["Darûra", "La nécessité, qui lève l'interdit dans une mesure stricte."],
  ["Hadith sahîh", "Chaîne continue de rapporteurs intègres et fiables, sans défaut."],
  ["Hadith da'îf", "Une condition d'authenticité fait défaut."],
  ["Ijtihâd", "Effort d'interprétation du juriste qualifié."],
  ["Taqlîd", "Suivre l'avis d'un savant sans en examiner la preuve."],
  ["Maslaha mursala", "Intérêt non tranché explicitement par un texte."],
  ["Sadd adh-dharâ'i'", "Fermer les moyens qui mènent à l'interdit."],
  ["'Urf", "La coutume, source secondaire quand elle ne contredit aucun texte."],
  ["Amr et nahy", "L'ordre et l'interdiction, formes premières de l'obligation."],
  ["Mujmal et mubayyan", "Texte ambigu, puis texte qui l'éclaire."],
  ["Hukm wad'î", "Statut de situation : cause, condition, empêchement."],
];

const HISTOIRE: [string, string][] = [
  ["Hégire", "622 : départ de La Mecque vers Médine, début du calendrier."],
  ["Bataille de Poitiers", "732."],
  ["Chute de Constantinople", "1453."],
  ["Traité de Westphalie", "1648 : naissance de l'ordre des États souverains."],
  ["Révolution française", "1789."],
  ["Congrès de Vienne", "1815."],
  ["Découverte de la pénicilline", "1928, par Fleming."],
  ["Tableau périodique de Mendeleïev", "1869."],
  ["Prise de Grenade", "1492 : fin d'al-Andalus."],
  ["Invention de l'imprimerie", "Vers 1450, par Gutenberg."],
  ["Maison de la sagesse à Bagdad", "IXe siècle, sous les Abbassides."],
  ["Ibn Sina", "980-1037, auteur du Canon de la médecine."],
  ["Al-Khwârizmî", "IXe siècle, à l'origine des mots algèbre et algorithme."],
  ["Peste noire en Europe", "1347-1352."],
  ["Traité de Tordesillas", "1494 : partage du monde entre Espagne et Portugal."],
  ["Première Guerre mondiale", "1914-1918."],
  ["Création de la Sécurité sociale", "1945, en France."],
  ["Structure de l'ADN", "1953, Watson, Crick et Franklin."],
  ["Premier pas sur la Lune", "1969."],
  ["Chute du mur de Berlin", "1989."],
];

const CATALOGUE: DefinitionEspace[] = [
  {
    nom: "Chimie",
    couleur: "#7e92b8",
    paquets: [
      { nom: "Organique — mécanismes", notes: serie("orga", CHIMIE_ORGA), maturite: 0.75 },
      { nom: "Inorganique — complexes", notes: serie("inorga", CHIMIE_INORGA), maturite: 0.15 },
      {
        nom: "Schémas et structures",
        maturite: 0.45,
        notes: [
          {
            cle: "schema-0",
            recto: `Identifie ce motif structural.\n\n![motif](${SCHEMA_PNG})`,
            verso: "Cycle aromatique substitué en para.",
            type: "recto_verso",
          },
          {
            cle: "schema-1",
            recto: "Équation de Nernst",
            verso: "$$E = E^0 + \\frac{RT}{nF}\\ln\\frac{[\\mathrm{ox}]}{[\\mathrm{red}]}$$",
            type: "recto_verso",
          },
          {
            cle: "schema-2",
            recto: "La loi de {{c1::Beer-Lambert}} s'écrit $A = \\varepsilon l c$, où $\\varepsilon$ est le {{c2::coefficient d'extinction molaire}}.",
            verso: "",
            type: "trous",
          },
          {
            cle: "schema-3",
            recto: "L'énergie de Gibbs vaut {{c1::$\\Delta G = \\Delta H - T\\Delta S$}} et une réaction est spontanée si {{c2::$\\Delta G < 0$}}.",
            verso: "",
            type: "trous",
          },
        ],
      },
    ],
  },
  {
    nom: "Arabe",
    couleur: "#6fa396",
    paquets: [
      {
        nom: "Vocabulaire — noms",
        maturite: 0.55,
        notes: ARABE.map(([ar, fr], i) => ({
          cle: `ar-${i}`,
          recto: ar,
          verso: fr,
          type: "inversee" as const,
        })),
      },
      {
        nom: "Grammaire",
        maturite: 0.1,
        notes: [
          { cle: "gr-0", recto: "Les trois cas du nom", verso: "Nominatif, accusatif, génitif.", type: "recto_verso" },
          { cle: "gr-1", recto: "Idâfa", verso: "Annexion : le premier terme perd article et tanwîn.", type: "recto_verso" },
          { cle: "gr-2", recto: "Forme II du verbe", verso: "Redoublement de la deuxième radicale, sens souvent factitif.", type: "recto_verso" },
          { cle: "gr-3", recto: "Pluriel brisé", verso: "Pluriel obtenu par changement interne du schème.", type: "recto_verso" },
          { cle: "gr-4", recto: "Le duel", verso: "Suffixe -âni au nominatif, -ayni aux autres cas.", type: "recto_verso" },
          { cle: "gr-5", recto: "Le {{c1::majzûm}} est le mode apocopé du verbe, employé après {{c2::lam}}.", verso: "", type: "trous" },
        ],
      },
    ],
  },
  {
    nom: "Sciences religieuses",
    couleur: "#c2a567",
    paquets: [{ nom: "Ousoul al-fiqh", notes: serie("ousoul", OUSOUL), maturite: 0.3 }],
  },
  {
    nom: "Culture générale",
    couleur: "#b58a93",
    paquets: [{ nom: "Repères historiques", notes: serie("hist", HISTOIRE), maturite: 0.9 }],
  },
];

/** Intervalle plausible pour un état donné, en jours. */
function intervallePour(mure: boolean, index: number): number {
  return mure ? 30 + (index % 90) : 1 + (index % 12);
}
export type ComptesCartes = {
  espaces: number;
  paquets: number;
  cartes: number;
  revisions: number;
};

export async function cartesExistent(): Promise<boolean> {
  return (await db.select({ id: cartes.id }).from(cartes).limit(1)).length > 0;
}

/** Efface l'existant puis réécrit tout le jeu de test. */
export async function semerCartes(): Promise<ComptesCartes> {
  if (await cartesExistent()) {
    await db.delete(revisions);
    await db.delete(cartes);
    await db.delete(paquets);
    await db.delete(espaces);
  }

  let totalCartes = 0;
  let totalRevisions = 0;
  let compteur = 0;

  for (const [ordreEspace, definition] of CATALOGUE.entries()) {
    const [espace] = await db
      .insert(espaces)
      .values({ nom: definition.nom, couleur: definition.couleur, ordre: ordreEspace })
      .returning();

    for (const [ordrePaquet, dp] of definition.paquets.entries()) {
      const [paquet] = await db
        .insert(paquets)
        .values({
          espaceId: espace.id,
          nom: dp.nom,
          ordre: ordrePaquet,
          objectifCartes: 0,
        })
        .returning();

      const engendrees = dp.notes.flatMap(engendrer);

      for (const [index, carte] of engendrees.entries()) {
        compteur += 1;
        // Réparti selon la maturité voulue : mûres, jeunes, puis nouvelles.
        const part = index / Math.max(1, engendrees.length);
        const mure = part < dp.maturite;
        const jeune = !mure && part < dp.maturite + 0.25;
        const vue = mure || jeune;

        const intervalle = intervallePour(mure, index);
        const prochaine = vue ? decalerJours(T, (index % 9) - 3 + intervalle) : null;
        const etat = mure ? "mure" : jeune ? "jeune" : "nouvelle";

        const [ligne] = await db
          .insert(cartes)
          .values({
            paquetId: paquet.id,
            recto: carte.recto,
            verso: carte.verso,
            type: carte.type,
            notes: carte.notes,
            tags: carte.tags,
            sourceCle: carte.sourceCle,
            etat,
            prochaineDate: prochaine,
            stabilite: vue ? intervalle * 1.1 : 0,
            difficulte: vue ? 4 + (index % 4) : 0,
            rechutes: mure ? index % 2 : 0,
            creeLe: T,
            modifieLe: T,
          })
          .returning();

        totalCartes += 1;

        // Un peu d'historique, pour que la courbe de rétention ait de quoi dire.
        if (vue) {
          const passages = mure ? 4 : 2;
          for (let p = 0; p < passages; p += 1) {
            const recul = (passages - p) * Math.max(1, Math.round(intervalle / passages));
            const jour = decalerJours(T, -recul);
            await db.insert(revisions).values({
              carteId: ligne.id,
              date: jour,
              vueLe: `${jour}T09:00:00.000Z`,
              note: compteur % 7 === 0 ? 1 : compteur % 5 === 0 ? 2 : 3,
              stabilite: intervalle * (0.4 + 0.2 * p),
              difficulte: 4 + (index % 4),
              prochaineDate: decalerJours(jour, intervalle),
              intervalle,
              etat: mure ? "mure" : "jeune",
              duree: 4000 + (compteur % 9) * 700,
            });
            totalRevisions += 1;
          }
        }
      }
    }
  }

  return {
    espaces: CATALOGUE.length,
    paquets: CATALOGUE.reduce((t, e) => t + e.paquets.length, 0),
    cartes: totalCartes,
    revisions: totalRevisions,
  };
}
