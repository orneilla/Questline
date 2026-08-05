# Questline

PWA personnelle mono-utilisateur : une progression de vie par arcs longs,
pas une liste de tâches. Mobile d'abord, en français, synchronisée entre
téléphone et tablette par la base.

**Stack** — Next.js 15 (App Router), TypeScript, Tailwind 4, Postgres (Neon)
via Drizzle ORM. Déploiement Vercel.

---

## Mise en route

```bash
npm install
cp .env.example .env      # renseigner DATABASE_URL et APP_PASSWORD
npm run db:migrate        # applique les migrations drizzle/
npm run db:seed           # charge les arcs, quêtes et créneaux réels
npm run dev
```

### Variables d'environnement

| Variable         | Rôle                                                              |
| ---------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`   | Postgres Neon. Sur Vercel, utiliser l'URL « pooled ».             |
| `APP_PASSWORD`   | Mot de passe unique de l'application.                             |
| `SESSION_SECRET` | Facultatif. Clé de signature du cookie ; à défaut, `APP_PASSWORD`. |
| `FUSEAU_HORAIRE` | Facultatif. Fuseau qui découpe les journées (`Europe/Paris`).      |
| `TELEGRAM_BOT_TOKEN` | Facultatif. Jeton du bot, donné par @BotFather.                |
| `TELEGRAM_CHAT_ID` | Facultatif. Identifiant de la conversation.                     |
| `CRON_SECRET`    | Protège `/api/cron` et sert de jeton partagé avec le webhook.     |
| `CORAN_API_BASE` | Facultatif. Miroir de l'API du Coran (défaut : alquran.cloud).    |
| `CORAN_MORPHOLOGIE_URL` | Facultatif. Miroir du corpus morphologique.               |
| `VAPID_SUBJECT`  | Facultatif. Contact du jeton push : `mailto:…` ou `https://…`.     |

> Sans `SESSION_SECRET`, changer le mot de passe déconnecte tous les appareils.

### Déploiement Vercel

L'application est à la **racine du dépôt** : le *Root Directory* de Vercel reste
`./` (valeur par défaut, aucun sous-dossier à renseigner).

Le `vercel.json` à la racine force `framework: nextjs`. Il est là pour une
raison précise : un projet Vercel créé alors que la branche de production ne
contenait pas encore d'application se voit attribuer le préréglage *Other*, et
le garde. Le déploiement réussit alors — Vercel publie le dépôt comme un site
statique — mais aucune route n'existe et **toutes les pages répondent
`404: NOT_FOUND`**. Les réglages de `vercel.json` priment sur ceux du tableau de
bord, ce qui corrige le cas sans y toucher.

Points à vérifier côté Vercel :

1. **Production Branch** — Settings › Git. Vercel ne déploie en production que
   cette branche ; si l'application n'y est pas encore, le domaine répond
   `404: NOT_FOUND`.
2. **Variables d'environnement** — Settings › Environment Variables :
   `DATABASE_URL` et `APP_PASSWORD`, cochées pour *Production* **et** *Preview*.
   Sans `APP_PASSWORD`, la page de connexion s'affiche et indique ce qui manque ;
   aucune session ne peut être ouverte.
3. **Output Directory** — Settings › Build and Deployment. Doit rester sur sa
   valeur par défaut ; un remplacement manuel hérité du préréglage *Other*
   n'est pas neutralisé par `vercel.json` et suffit à reproduire le 404.

### Installer la base depuis un navigateur

Le déploiement ne joue pas les migrations. Sans terminal, tout passe par une
adresse à ouvrir une fois :

```
https://<domaine>/api/setup?key=<clé>
```

Elle applique les migrations en attente, puis écrit le catalogue si la base est
vierge. La rejouer ne casse rien : les migrations déjà passées sont ignorées et
le catalogue n'est écrit qu'une fois — un second appel répond « Déjà installé »
sans toucher aux validations ni au momentum.

La clé par défaut est dans `src/app/api/setup/route.ts`. Définir `SETUP_KEY`
dans Vercel la remplace ; sur un dépôt public, c'est la seule façon de la garder
secrète. La route reste hors de la garde de session — elle doit répondre alors
qu'aucune table n'existe encore.

Elle applique aussi les migrations ajoutées par la suite : après un déploiement
qui en apporte une, ouvrir cette adresse suffit à mettre la base à jour.

Quand la base n'est pas prête, l'application ne plante pas : les écrans
affichent un message qui dit ce qui manque.

Le build ne dépend d'aucune variable : la connexion à la base n'est ouverte qu'à
la première requête, jamais à la compilation.

### Scripts

| Commande              | Effet                                                |
| --------------------- | ---------------------------------------------------- |
| `npm run dev`         | Serveur de développement                             |
| `npm run build`       | Build de production                                  |
| `npm run db:generate` | Régénère une migration après modification du schéma  |
| `npm run db:migrate`  | Applique les migrations                              |
| `npm run db:seed`     | Charge le catalogue réel (refuse d'écraser l'existant) |
| `npm run icones`      | Regénère les icônes PWA                              |

---

## Les écrans

Barre du bas à cinq onglets — **Jour · Semaine · Cartes · Coran · Arcs** — et les
réglages derrière une roue discrète, en haut de chaque écran. Sur tablette en
paysage, la barre devient une colonne à gauche : en paysage la hauteur est la
ressource rare, et une barre horizontale y prendrait la place d'une carte.

Tout écran qui n'est pas un onglet racine porte une flèche de retour en haut à
gauche, vers son parent — jardin, éditeur, recherche, organisation, réglages,
détail d'arc, parcours, lecture et mémorisation du Coran. Elle remonte la hiérarchie et non l'historique : la
destination est la même quel que soit le chemin emprunté pour arriver là. Le
geste de retour du navigateur, lui, suit l'historique, et les deux se complètent
au lieu de se doubler. Une suppression navigue en `replace` : revenir en arrière
ne doit pas rouvrir l'éditeur d'une carte qui n'existe plus.

La révision, elle, se quitte par une croix : la session en cours est close comme
si elle s'était achevée — les cartes déjà notées comptent, leurs échéances sont
écrites — et ce qui reste revient un autre jour. La confirmation dit combien de
cartes restent et ce qui est conservé.

- **Connexion** — un seul mot de passe, cookie `httpOnly` signé (HMAC-SHA256)
  valable 90 jours, vérifié par le middleware sur toutes les routes.
- **Jour** — titre du jour, date, charge de la journée, les quêtes du jour, les six
  barres de momentum, la bascule « jour bas », la phrase du soir en
  enregistrement automatique.
- **Semaine** — les sept jours en colonnes, les créneaux en blocs, le temps
  disponible sous chaque jour, et de quoi ajouter un récurrent ou un ponctuel.
- **Arcs** — les arcs groupés par pilier, avec leur progression et leur vision.
  Au détail : les quêtes de l'arc, l'historique des validations, la dernière
  activité.
- **Bilan** — la semaine en chiffres, comparée à la précédente, et les phrases
  du soir. Aucun score global, aucune appréciation.
- **Réglages** — tout se crée, se modifie et se supprime : quêtes, arcs,
  créneaux, événements. Plus l'export et l'import de la sauvegarde complète.
- **Parcours** — les seuils d'arc franchis et les saisons closes, dans l'ordre.
  La seule page qui regarde loin en arrière.
- **PWA** — manifest, icônes, mode standalone, thème sombre.

## Module cartes

Un système de mémorisation destiné à durer, pas à passer un semestre.

**Algorithme** — FSRS via `ts-fsrs`, quatre notations. Les paliers internes de
la bibliothèque sont désactivés : c'est la file de session qui joue ce rôle,
comme dans Anki. Sans cela, « Correct » rendrait un intervalle de quelques
minutes au lieu de faire sortir la carte avec un intervalle en jours.

**File d'apprentissage** — une carte ne quitte pas la session tant qu'elle
n'est pas sue. « Encore » la replace à une minute, « Difficile » à six, au
milieu des autres et non à la fin. « Correct » et « Facile » la confient à
FSRS. La session ne s'achève que file vide. Tout est en mémoire et sans effet
de bord : une session chargée continue sans réseau.

**Ce que les boutons annoncent** — le délai réel, et non un arrondi. « Encore »
et « Difficile » ne font pas sortir la carte de la session : ils affichent donc
le délai de la file — « 1 min », « 6 min » — et non l'échéance en jours que FSRS
calculerait pour une carte qui partirait. « Correct » et « Facile » affichent
l'intervalle FSRS. Ce qui se compte en minutes s'écrit en minutes jusqu'à une
heure et demie.

**Écriture** — les notations partent dans une file d'attente avec reprise
exponentielle et rejeu au retour de la connexion. L'écran n'attend jamais le
réseau.

**Intégration** — onglet *Cartes*, page *Jardin*, cartes dues affichées sur
l'écran du jour, révision qui crédite le pilier `savoir` une fois par jour, et
au-delà de cinquante cartes dues la charge de la journée retire trente minutes
au budget.

**Lecture de la progression** — le pourcentage annoncé est celui des cartes
mûres, nommé comme tel (« 76 % maîtrisé »). La barre à quatre segments a sa
légende ; un appui dessus en donne les nombres exacts, sans quitter l'écran.

### Le calendrier

En haut de l'écran Cartes : une case par jour, les semaines en colonnes, douze
mois glissants, avec navigation d'une année à l'autre. Un appui sur une case
donne la date et le nombre de cartes révisées ; sous la grille, la moyenne
quotidienne, la part de jours étudiés, la plus longue série et la série en
cours.

Cinq paliers de vert, du presque éteint au franchement lumineux, calculés sur
les **quantiles** des jours réellement travaillés et non sur des seuils fixes :
l'échelle doit rester lisible qu'on révise vingt ou deux cents cartes par jour.
Quand l'historique est trop uniforme pour que les quantiles se distinguent, la
répartition redevient linéaire — sans quoi toute une année s'écraserait sur un
seul palier. Un jour sans révision reste neutre, présent mais à peine.

Deux précautions de calcul. La moyenne et le pourcentage de jours étudiés ne
comptent pas les journées antérieures à la première révision : diviser par un
passé qui n'a pas eu lieu donnerait un chiffre faux. Et la série en cours ne se
brise pas parce qu'il est dix heures du matin — un jour travaillé hier la
maintient tant qu'aujourd'hui n'est pas fini. Quand elle retombe à zéro, elle
affiche zéro, sans un mot de plus.

Tout se calcule dans le navigateur à partir de la seule liste des jours
travaillés — une ligne par jour, quelques milliers après des années — si bien
que changer d'année ne demande rien au serveur.

### L'éditeur

Pensé pour la tablette, utilisable au téléphone. Deux colonnes dès qu'il y a la
place : la saisie à gauche, à droite l'aperçu des cartes telles qu'elles se
présenteront, mis à jour à la frappe.

- **Types** — recto-verso, inversée (deux cartes), texte à trous (une carte par
  trou). Une barre d'insertion pose une formule LaTeX, un bloc, un trou
  `{{cN::…}}` auto-numéroté, une image.
- **Modifier sans perdre la mémoire** — la note d'origine est conservée sur
  chaque carte engendrée, avec le repère du trou qu'elle interroge. Réécrire la
  note met à jour sur place les cartes dont le repère subsiste : stabilité,
  échéance et historique intacts. Seul un trou réellement supprimé perd sa
  carte, et un trou ajouté en crée une neuve.
- **Création en série** — après validation, le formulaire se vide mais garde le
  paquet, le type et les étiquettes.
- **Chercher** — sur le recto, le verso, les notes et les étiquettes, avec
  filtres par paquet, par état et par suspension. Les résultats se sélectionnent
  pour être déplacés en bloc vers un autre paquet.
- **Organiser** — espaces et paquets : créer, renommer, déplacer, imbriquer,
  supprimer, poser une couverture. Chaque suppression annonce d'abord ce qu'elle
  emporte.
- **Suspendre** — une carte suspendue reste en base et sort des sessions.

### Images

La compression a lieu dans le navigateur, avant l'envoi. Côté long ramené à
1200 px. Un schéma au trait — export ChemDraw, formule, figure — reste en PNG,
seul format qui garde la transparence ; quand le tracé est gris ou noir, les
couleurs sont ramenées au noir pur en conservant l'alpha, ce qui laisse le
dessin identique et allège nettement le fichier. Une photographie passe en
WebP, dont la qualité descend par paliers jusqu'à tenir sous 150 Ko. Au-delà de
400 Ko après compression, l'image est refusée avec son poids. Le poids retenu
est affiché à chaque fois.

Les images vivent dans une table à part, servies par `/api/cartes/media/<id>`,
et non en data URI dans le texte : une même figure sert souvent plusieurs cartes
d'un groupe, le texte reste léger à charger pour une session, et la place
occupée devient mesurable. L'extension de l'adresse porte une information : un
`.png` est un schéma au trait, inversé par CSS pour rester lisible sur fond
sombre ; un `.webp` est une photographie, jamais touchée.

Le collage et le glisser-déposer passent par le même chemin que le bouton :
coller un export ChemDraw dans le champ fonctionne directement.

### Réglages des cartes

`/cartes/reglages` réunit ce qui gouverne le module : la courbe de rétention sur
trente jours avec la cible en pointillés, les paramètres FSRS (rétention visée,
nouvelles par jour, plafond, délais de retour), la place occupée dans la base et
les échanges.

**Place occupée** — taille réelle de la base rapportée au palier gratuit de Neon
(512 Mo), nombre de cartes, de révisions et d'images. L'archivage efface les
révisions antérieures à une date **en gardant toujours la dernière de chaque
carte** : c'est elle qui dit à FSRS combien de temps s'est écoulé, et sans elle
une carte mûre repasserait pour neuve. Les échéances ne bougent donc pas d'un
jour ; ce qui se perd est la matière d'une réoptimisation future des poids. Les
images qu'aucune carte ne cite plus se purgent à part.

**Export** — JSON complet (mémoire FSRS comprise), ou CSV lisible par Anki
(recto, verso, étiquettes, espace, paquet). L'import CSV reconnaît la virgule,
le point-virgule et la tabulation, avec ou sans en-tête.

### Le jardin

Une plante par paquet, dessinée au trait dans l'esprit d'une planche d'herbier :
tout est tracé, rien n'est rempli, et les silhouettes sont calculées plutôt que
recopiées — une fronde de fougère est une courbe et ses pinnules, une graminée
un faisceau de limbes. Quatre espèces — fougère, graminée, plante à fleur,
grimpante — attribuées selon l'espace, pour que le jardin ne soit pas monotone.

Six stades selon la maîtrise réelle (part de cartes mûres) : graine, pousse,
jeune plant, plante, floraison, maturité. Un paquet laissé plus de deux semaines
pâlit et se désature, sans jamais faner ni mourir. Les six piliers ont aussi leur
plante, liée au momentum.

En fin de session, la plante du paquet se dessine trait par trait et l'écran dit
la maîtrise atteinte ; si un stade vient d'être franchi, il est nommé. Rien
d'autre : ni score, ni série, ni comparaison. L'écran de révision, lui, reste
nu.

### Données de test

Depuis un poste de développement :

```bash
npm run db:seed-cartes     # 210 cartes, 4 espaces, 7 paquets
```

Sans terminal, la même opération depuis un navigateur :

```
https://<domaine>/api/setup/cartes?key=<clé>
```

Elle refuse de tourner si des cartes existent déjà ; `&remplacer=1` passe outre
et efface alors tout l'historique de révision. Elle est séparée de
`/api/setup` à dessein : ce sont des données de démonstration, elles n'ont rien
à faire dans une installation qu'on voudrait vierge.

## Module Coran

Trois usages dans un seul module : lire, suivre, mémoriser.

### Les règles qui priment sur le reste

Le texte coranique n'est jamais écrit, corrigé ni reformulé par le code. Il est
importé depuis une API et écrit **tel quel** : aucun `trim`, aucune
normalisation Unicode, aucun remplacement de caractère. Les diacritiques et les
marques de tajwid tiennent à des points de code qu'une normalisation NFC ou NFKC
déplacerait — sur ce texte, ce n'est pas une coquille, c'est une altération. La
seule vérification est un refus : une chaîne vide n'est pas écrite. L'identité
octet pour octet entre ce que l'API rend et ce que la base contient est vérifiée
à l'import.

L'application n'interprète rien. Elle affiche un texte et une traduction
attribuée ; elle ne commente pas, ne résume pas, ne produit aucun tafsir. Chaque
écran nomme ses sources : riwaya du texte arabe, nom du traducteur, nom du
récitateur.

### Sources et licences

**Texte arabe** — Hafs ‘an ‘Asim, graphie uthmanienne, projet Tanzil, servi par
alquran.cloud. **Creative Commons Attribution 3.0** : copie et distribution
verbatim autorisées, modification interdite, source et lien à mentionner. C'est
la seule édition importée d'office, parce que c'est la seule dont la licence est
claire.

**Traduction française** — aucune n'est importée par défaut, et c'est un choix
délibéré. Toutes les traductions françaises disponibles dans les API publiques
sont celle de Muhammad Hamidullah, redistribuée par Tanzil sous une permission —
« usage non commercial uniquement ; pour tout autre usage, obtenir
l'autorisation du traducteur ou de l'éditeur » — qui n'est pas une licence
accordée par l'ayant droit : Hamidullah est mort en 2002, son texte reste
protégé, et la révision du Complexe du Roi Fahd l'est séparément. Les seules
traductions françaises franchement dans le domaine public (Kazimirski 1840,
Savary 1783) n'existent qu'en prose numérisée, non alignée verset par verset,
et les aligner reviendrait à en produire une édition — ce que ce projet
s'interdit.

La conséquence est un choix explicite plutôt qu'un défaut caché : chaque édition
se présente dans les réglages avec ses conditions recopiées telles que la source
les énonce, et ne s'importe qu'après une case cochée. La translittération latine
de Tanzil suit le même chemin.

Tout cela vit dans `src/lib/coran/sources.ts`, qui ne contient aucun texte
coranique — seulement l'identité des éditions et ce que leurs détenteurs de
droits en disent.

### Pourquoi alquran.cloud

Trois raisons. L'API de la Quran Foundation demande depuis sa v4 un `client_id`
et un `client_secret` obtenus après inscription : sur une installation qui se
fait entièrement depuis un navigateur, chaque secret de plus est une
manipulation qui peut échouer sans moyen de la déboguer. Ensuite un seul appel
rend une sourate entière, ce qui découpe l'import en 114 lots naturels. Enfin
l'audio est servi par le même projet, fichier par verset, sans clé.

### L'import

```
https://<domaine>/api/setup/coran?key=<clé>
```

114 sourates, 6236 versets, importés par lots avec un budget de temps sous la
limite de la fonction. **Aucun état d'avancement n'est stocké** : il se lit dans
ce qui est déjà en base, si bien que la page se recharge d'elle-même pour
reprendre exactement où elle s'était arrêtée, qu'une coupure ne perd rien, et
que relancer une fois terminé ne réécrit rien. Ajouter `&edition=<clé>` importe
une traduction ou la translittération de la même manière.

Mesuré : environ **1,2 Mo** pour le texte arabe, **3,4 Mo** avec une traduction
et la translittération — sur les 512 Mo du palier gratuit de Neon. La page de
réglages affiche la place réellement occupée.

**L'audio n'est jamais stocké.** Il est diffusé depuis
`cdn.islamic.network/quran/audio/{débit}/{récitateur}/{verset}.mp3`, le
récitateur étant un réglage (par défaut Alafasy). Une récitation injoignable
arrête l'enchaînement et le dit ; le texte, lui, reste lisible puisqu'il vient
de la base.

### Lire

Navigation par sourate et par juz'. Chaque verset porte l'arabe, la
translittération et la traduction, chacune activable d'un bouton.

**La translittération est en deuxième rang, et ce n'est pas un détail.** Elle
n'est pas une note de bas de page : c'est le texte de travail de quelqu'un qui
mémorise sans lire l'arabe couramment. Les trois couches ont donc des tailles
indépendantes, et un « mode mémorisation » agrandit l'arabe et la
translittération tout en réduisant la traduction — il se bascule depuis la
lecture comme depuis les réglages.

**La reprise est mémorisée par sourate**, pas seulement globalement. Quitter
Al-Baqara pour lire Al-Fatiha puis revenir propose de reprendre au verset
quitté, par un discret « reprendre au verset N » plutôt qu'un saut d'office ; le
défilement laisse un peu de contexte au-dessus. Les positions vivent en base :
le téléphone et la tablette retrouvent la même place. Typographie
arabe dédiée : police au choix — les polices sont demandées au système et jamais
téléchargées, une police coranique pesant plusieurs mégaoctets — taille réglable,
interligne large, RTL, ni césure ni justification.

L'écoute se fait verset par verset ou en continu, la lecture continue faisant
défiler et surlignant le verset récité. La position est enregistrée en
arrière-plan à mesure que les versets passent au centre de l'écran, et l'écran
d'accueil rouvre là où la lecture s'est arrêtée. Marque-pages nommés, sans
limite.

### Enchaînement des sourates

Arrivée au dernier verset, la sourate suivante se charge et s'ajoute à la
suite : on ne sort pas d'une sourate pour entrer dans la suivante, pas plus que
dans un moushaf. Remonter avant le premier verset ramène de la même façon à la
sourate précédente.

Vers le bas, une sentinelle placée un écran à l'avance. Vers le haut, **pas de
sentinelle** : une sentinelle en tête est visible dès l'ouverture et chargerait
la sourate précédente sans qu'on l'ait demandée — l'écran s'ouvrirait sur la fin
de la sourate d'avant. C'est le défilement qui est écouté, et l'extension ne
part que sur un geste réel : être remonté près du début, **en remontant**.
L'insertion en tête compense le décalage qu'elle provoque, sinon ce qu'on est en
train de lire sauterait sous les yeux.

La coupure porte le numéro, le nom, et la basmala là où elle est d'usage —
c'est-à-dire partout sauf Al-Fatiha, qui la porte comme premier verset, et
At-Tawba, qui n'en a pas. **Le texte arabe de la basmala n'est écrit nulle part
dans le code** : il est relu du premier verset d'Al-Fatiha tel qu'il est en base
et passé en propriété. Aucun caractère arabe affiché ne vient d'ailleurs que du
texte importé.

La position enregistrée suit la sourate réellement affichée, et le compteur de
lecture traverse le changement sans rien perdre.

### Suivre

Objectif quotidien configurable en versets, en pages ou en minutes. Progression
du jour, part du moushaf parcourue, et le même calendrier que celui des cartes —
même composant, mêmes verts, mots adaptés.

Quand l'objectif est atteint, la quête de l'arc « Le Coran » est validée et le
pilier deen crédité, une fois par jour. Les jours où il ne l'est pas ne laissent
aucune trace : le suivi compte ce qui a eu lieu, il ne sanctionne pas ce qui n'a
pas eu lieu.

**Ce qui compte comme lu.** Un verset est crédité quand il est resté *assez
visible assez longtemps* : plus de la moitié du verset à l'écran, ou — pour un
verset plus grand que l'écran — plus de la moitié de l'écran occupée, pendant
**deux secondes**. Ni l'audio ni aucun geste ne sont requis : la lecture
silencieuse est la lecture normale, l'écoute n'est qu'un moyen parmi d'autres.
C'est la liste des versets réellement lus qui est envoyée, pas l'intervalle
qu'ils couvrent — traverser une sourate n'est pas la lire.

Une version antérieure exigeait qu'un verset croise une bande étroite au centre
exact de l'écran, trente pour cent de la hauteur. Ce qui décidait n'était donc
pas d'avoir lu le verset mais l'endroit où il s'était arrêté sous le doigt : un
verset court posé en haut de l'écran, parfaitement lisible, ne touchait jamais
la bande. Une sourate lue en entier pouvait être créditée de zéro.

Le garde-fou contre le survol tient dans la durée, et nulle part ailleurs. Un
défilement continu ne laisse chaque verset à l'écran que quelques centaines de
millisecondes ; lire le plus court en prend plusieurs. Mesuré : Al-Fatiha lue en
s'arrêtant sur chaque verset compte **7 sur 7**, sans audio ; un survol continu
d'Al-Baqara de bout en bout compte **0 sur 286**. Après trois secondes d'arrêt
sur l'écran d'ouverture, le même survol compte 2 — les deux versets qui étaient
réellement sous les yeux avant que le doigt ne parte.

Les séances partent par `navigator.sendBeacon` et non par une action serveur :
une action partirait avec l'onglet et la lecture ne compterait pas. Le journal
est aussi écrit tous les vingt versets, pour qu'une fermeture brutale ne coûte
rien.

**Remise à zéro** — depuis les réglages, pour tout le moushaf ou sourate par
sourate, avec un texte qui dit exactement ce qui part et ce qui reste. Les
cartes de mémorisation et de vocabulaire, leur historique et leurs échéances ne
sont jamais touchés : recommencer un cycle de lecture n'a aucune raison de
défaire une mémorisation.

### Mémoriser

Un verset mis en carte devient une note du module cartes, dans un espace
« Coran » et un paquet portant le nom de la sourate : même FSRS, même file
d'apprentissage. Le module Coran ne tient aucun état de mémorisation — il lit
les étiquettes `coran:<sourate>:<verset>` quand il veut compter.

Trois formats, tous en arabe — on ne mémorise pas depuis le français : le verset
suivant depuis le précédent, la fin du verset masquée, ou le verset entier à
réciter (référence et verset précédent au recto). Chaque face porte l'arabe et
sa translittération, celle-ci en italique sur sa propre ligne. Sur ce dernier, le découpage se fait sur
les blancs en conservant chaque séparateur — recoller les morceaux redonne le
verset à l'octet près — et les marques de trou sont posées *autour* d'une
portion, jamais à l'intérieur d'un mot. Ce sont les derniers mots qui sont
masqués, mécaniquement : décider quels mots seraient « clés » demanderait un
jugement sur le sens, et ce module n'en porte aucun. Le verso montre toujours le
verset entier.

### Mot à mot

Un appui sur un mot arabe, en lecture, ouvre son analyse : le mot, sa
translittération, sa racine, son lemme, sa catégorie grammaticale et le nombre
d'occurrences de cette racine dans le Coran. Le panneau se superpose à la
sourate — le fermer n'en fait pas sortir.

**Source et licence** — le *Quranic Arabic Corpus* de Kais Dukes (université de
Leeds), morphologie v0.4, sous **GNU General Public License** : copie verbatim
autorisée, modification interdite, usage libre dans une application à condition
d'indiquer clairement la source avec un lien vers corpus.quran.com. Licence
claire, donc importable — mais l'import reste à la demande, depuis les réglages,
avec ses conditions affichées.

Le fichier officiel de corpus.quran.com n'est servi que derrière un formulaire
de courriel : aucune requête ne l'atteint. L'analyse vient donc du fork
`mustafa0x/quran-morphology`, même version, même licence. Son format diffère du
0.4 documenté et c'est **celui-là** qu'analyse `morphologie.ts` : quatre colonnes
séparées par des tabulations, localisation `sourate:verset:mot:segment` sans
parenthèses, arabe réel en deuxième colonne au lieu du Buckwalter, catégorie
grossière (N, P, V) en troisième, et les traits en quatrième — `ROOT`, `LEM`,
`VF` pour la forme verbale, plus les drapeaux nus et les étiquettes propres à ce
fork : `NV`, `ATT`, `DIST`, `ADDR`. L'adresse se change par
`CORAN_MORPHOLOGIE_URL`, et celle qui a réellement servi est retenue en base puis
affichée dans les réglages.

Mesuré sur le fichier réel : 130 030 lignes de segments, **77 429 mots**,
6236 versets, analysés en moins d'une seconde ; **1650 racines distinctes** et
18 Mo en base une fois écrits.

**Ce que le corpus ne donne pas : le sens.** Aucune glose mot à mot n'est
téléchargée : celles qui circulent, y compris dans des dépôts qui s'annoncent en
CC BY, dérivent du corpus ou de Quran.com sans chaîne de droits traçable, et un
dépôt qui se déclare libre ne rend pas libre ce qu'il redistribue. Le panneau
fonctionne sans — la racine, le lemme, la grammaire et la fréquence sont
précisément ce qui s'apprend. Le sens, lui, se **dépose** : voir « Déposer une
ressource » plus bas. Tant que rien n'est déposé, le champ `sens` reste vide et
le panneau le dit.

**L'alignement** est le point délicat, et il est traité par le refus. Le corpus
numérote les mots d'un verset ; le texte vient de Tanzil. On vérifie que les deux
comptes coïncident avant d'écrire : un verset qui ne s'aligne pas est laissé sans
analyse plutôt que d'attacher une racine au mauvais mot, et le total des versets
écartés est rapporté à la fin de l'import. **La forme arabe affichée ne vient
jamais du corpus** : elle est découpée du verset déjà en base, sur les blancs, à
la position que le corpus indique.

Vérifié contre le texte réel : **6226 versets sur 6236 s'alignent**, soit
99,84 %. Les dix écarts sont des divisions de mots connues, où le corpus et
Tanzil ne coupent pas au même endroit — بَعْدَمَا contre بَعۡدَ مَا, مَا لِىَ contre
مَالِيَ, لَّوْ مَا contre لَّوۡمَا. Ce sont 2:72, 2:181, 8:6, 13:37, 15:7, 27:20,
36:22, 37:130, 37:164 et 41:47, et ces dix-là restent sans analyse.

Depuis le panneau, un bouton range le mot dans un espace « Arabe coranique », en
paquet par racine ou par sourate. La carte est complète des deux côtés : au
recto le mot arabe et sa translittération, au verso le sens français d'abord,
puis la racine et le reste de l'analyse, et en note de bas de carte le verset
d'où le mot est tiré — un mot appris hors de sa phrase s'oublie, et le contexte
n'a pas à occuper la place de la réponse. La translittération d'un mot est
découpée de celle du verset, et **seulement** si son compte de mots tombe sur
celui de l'arabe : sinon aucune n'est donnée, un mot pris à côté valant moins que
rien du tout. Un mot sans sens ni analyse ne fait pas de carte vide : la demande
est refusée avec la raison.

### Déposer une ressource

Certaines ressources ne s'obtiennent pas par une adresse. La *Quranic Universal
Library* (qul.tarteel.ai) sert ses fichiers depuis son site, sans lien stable :
aucune requête ne les atteint. Ils se déposent donc depuis l'appareil.

```
https://<domaine>/api/setup/import?key=<clé>
```

L'adresse mène à `/coran/televerser`, aussi accessible depuis les réglages du
Coran. Tout se passe dans le navigateur : le fichier n'y transite jamais d'un
bloc — plusieurs mégaoctets ne passent pas dans une fonction serverless.

**L'ordre des étapes n'est pas négociable : lire, montrer, écrire.** L'écran
affiche d'abord ce qu'il a compris — le contenant, la structure reconnue, le
nombre d'entrées, ce qui a été écarté, et **trois entrées réelles** : la
première, celle du milieu, la dernière. Trois prises loin les unes des autres,
pour qu'un décalage se voie tout de suite plutôt que six mois plus tard sur un
mot mal traduit. Rien n'est écrit avant confirmation.

**La route est générique.** Le type est déduit du contenu, jamais du nom du
fichier, et trois sortes sont reconnues :

| Reconnu                | À quoi ça se voit                | Ce que ça remplit          |
| ---------------------- | -------------------------------- | -------------------------- |
| Traduction mot à mot   | clés `sourate:verset:mot`        | `mots_coran.sens`          |
| Traduction de versets  | clés `sourate:verset`            | une édition affichable     |
| Analyse morphologique  | texte tabulé, quatre colonnes    | racine, lemme, grammaire   |

En JSON — objet à clés plates, objet imbriqué `sourate → verset → mot`, ou
tableau d'objets, éventuellement sous une enveloppe `data`, `words`, `verses` —
ou en **base SQLite**, lue par `sqlite.ts`, un lecteur du format écrit pour ce
projet plutôt qu'un moteur WebAssembly d'un mégaoctet chargé pour lire trois
colonnes : en-tête, arbres de table et d'index, pages de débordement, colonne
`INTEGER PRIMARY KEY` rendue depuis le rowid, tables `WITHOUT ROWID` remises dans
l'ordre déclaré. Une valeur peut être une chaîne ou un objet portant `text`,
`t`, `translation`… Un fichier qu'aucun lecteur ne reconnaît est refusé avec ses
premiers octets, pas avec « format invalide ».

**L'alignement est vérifié en base, pas dans le fichier.** Chaque verset est
comparé au texte de Tanzil déjà importé : si le fichier ne lui donne pas
exactement autant de mots, numérotés de 1 à N sans trou, **le verset entier est
écarté**. Un mot sans correspondance reste sans sens — jamais un sens approché.
Le rapport final dit combien de mots ont reçu un sens et combien n'en ont pas,
compté sur le découpage du texte arabe et non sur la table d'analyse, qui
donnerait toujours cent pour cent.

**L'écriture part par lots**, un verset n'étant jamais coupé entre deux requêtes
— c'est la condition du contrôle ci-dessus. Chaque lot est une requête courte :
aucune ne s'approche de la limite de temps. Tout est écrit en `on conflict do
update`, donc redéposer le même fichier ne duplique rien ; la position est
retenue et l'écran propose de reprendre où il s'était arrêté. Un lot qui échoue
est retenté trois fois avant d'abandonner, et ce qui est écrit reste écrit.

Mesuré sur un fichier mot à mot de 77 426 entrées (2,3 Mo, 98 lots) contre le
texte réel : 77 359 mots ont reçu un sens, 3 versets volontairement désalignés
ont été écartés, et les 70 mots de ces versets sont restés sans sens —
77 359 + 70 = 77 429, le compte exact des mots du texte. Interrompre au premier
lot puis reprendre donne le même rapport, au mot près.

**Crédit** — un dépôt mot à mot est attribué à **QuranWBW**, distribué par
**QUL (Tarteel)**, sous chaque sens affiché en lecture et dans les réglages. Une
traduction de versets ne s'écrit pas sans son nom, son traducteur et ses
conditions recopiées telles quelles : le formulaire les exige, parce que chaque
écran qui l'affichera devra pouvoir les citer.

La page **Vocabulaire** liste les trois cents racines les plus fréquentes par
fréquence décroissante, en marquant celles déjà travaillées, et dit quelle part
des occurrences elles couvrent.

## Rappels

L'application ne compte pas sur le fait qu'on pense à l'ouvrir : elle vient.
Deux canaux, réglables depuis **Réglages → Rappels** : les notifications de
Questline, le bot Telegram, ou les deux. Par défaut les notifications seules —
et changer de canal ne supprime rien de l'autre.

| Créneau | Défaut  | Contenu                                                     |
| ------- | ------- | ----------------------------------------------------------- |
| Matin   | 7 h 30  | Les quêtes du jour avec leur pilier, les tâches en attente, les cartes dues |
| Soir    | 21 h 30 | Ce qui a été validé, ce qui reste                            |

Les horaires se changent, chaque créneau s'active séparément. Le ton est celui
du reste : on annonce, on constate. Une journée sans rien de coché reçoit le
même égard qu'une autre — pas de série brisée, pas de retard souligné, pas de
relance.

### Notifications web

Service worker minuscule à la racine (`public/sw.js`) : il reçoit les rappels et
les ouvre au bon écran, et ne met **rien** en cache. Un cache mal réglé
afficherait une journée d'hier ; la base est la seule source de vérité.

**Le sujet du jeton (`sub`) est validé.** C'est le champ qui a coûté une
session : il valait `mailto:questline@localhost`, et Apple a répondu
`403 BadJwtToken` sur tous les envois. Google et Mozilla acceptent à peu près
n'importe quoi ici ; Apple le valide vraiment, et `localhost` n'est pas un
domaine joignable.

`notifications/sujet.ts` résout le sujet du plus explicite au plus déduit :
`VAPID_SUBJECT` si elle est renseignée **et valide**, sinon le domaine de
production exposé par Vercel, sinon le domaine du déploiement courant, sinon le
domaine de production connu. Une valeur invalide n'est jamais retenue en
silence — elle est écartée au profit de la suivante, et le diagnostic montre
celle qui sert réellement ainsi que sa provenance. Sont refusés : `localhost`,
les adresses IP, les domaines sans point, `.local`, `.internal`, et tout ce qui
n'est ni `mailto:` ni `https:`.

Pour mettre ta propre adresse, renseigne `VAPID_SUBJECT` dans Vercel — par
exemple `mailto:toi@exemple.fr`. Ce n'est pas obligatoire : le défaut fonctionne.

Le reste du jeton était correct et l'est resté, ce qu'un test vérifie sur un
jeton réellement émis : `ES256`, signature de 64 octets, base64url sans
remplissage, expiration à **12 h** — dans le futur et sous les 24 h qu'Apple
tolère. Comparés côte à côte, l'ancien sujet et le nouveau ne diffèrent que par
le `sub`.

**Les clés VAPID vivent en base**, pas dans l'environnement. Elles sont
engendrées à la première demande, depuis le navigateur, et n'ont donc jamais à
être recopiées à la main dans Vercel — c'est le même principe que le reste de
l'installation, rien qui demande un terminal. Elles ne changent plus ensuite :
les regénérer invaliderait tous les abonnements.

**Le moment de la demande.** Jamais au premier lancement. Une permission
demandée avant qu'on sache à quoi elle sert est une permission refusée, et un
refus sur iOS ne se redemande pas — il faut passer par les réglages du système.
L'écran explique donc d'abord, et ne demande qu'au toucher explicite. Une
invitation discrète apparaît sur l'écran du jour après **sept jours** d'usage,
si aucun appareil n'est encore abonné.

**iOS.** Safari n'accorde le push web que si l'application est installée sur
l'écran d'accueil ; dans un onglet, `PushManager` n'existe même pas. L'écran le
détecte et explique comment installer — Partager, puis Sur l'écran d'accueil —
au lieu d'échouer sur une erreur incompréhensible. Une permission révoquée
depuis le système est détectée à chaque affichage et dit où la redonner.

**Ce qui se défait tout seul.** Un abonnement que le service de push déclare
mort (404 ou 410) est retiré : le garder ferait échouer tous les envois
suivants. Toute autre erreur est consignée sur la ligne de l'appareil et
l'abonnement conservé — une panne passagère n'est pas une désinscription. Un
abonnement renouvelé par le navigateur est réenregistré par le service worker
lui-même, via `pushsubscriptionchange`.

Vérifié contre un vrai service de push, en local et en TLS : chiffrement
`aes128gcm` réel (303 octets pour le rappel du matin), signature VAPID validée
contre la clé publique stockée en base, `TTL` de douze heures, et purge
automatique des abonnements sur un 410.

### Diagnostic

**Réglages → Rappels** montre tout ce qu'il faut pour comprendre un rappel qui
n'arrive pas, sans accès aux journaux : l'état de la permission, les appareils
abonnés avec leur dernière erreur telle que le service l'a rendue, la réponse de
Telegram à `getMe`, la présence de chaque variable — le jeton n'est jamais
affiché, seulement son identifiant public suivi de points — et la date du
dernier envoi réussi de chaque créneau sur chaque canal. Deux boutons de test
donnent la réponse exacte du service en cas d'échec.

Côté VAPID, il montre aussi **le sujet retenu et sa provenance**, **la durée du
jeton**, et **le début des deux clés publiques** : celle du serveur et celle
avec laquelle l'appareil s'est réellement abonné. La clé privée n'en sort
jamais. Quand les deux ne correspondent pas — clés regénérées après un
abonnement, par exemple — l'écran le dit et propose **« se réabonner avec la clé
actuelle »**, qui retire l'ancien abonnement des deux côtés avant d'en poser un
neuf. Rien ne se répare tout seul dans ce cas : le service de push refuse tout
et ne dit pas pourquoi.

## Le bot Telegram

L'application ne compte pas sur le fait qu'on pense à l'ouvrir : elle vient.
Trois messages, tous facultatifs — sans les variables Telegram, le reste
fonctionne exactement pareil.

| Message  | Heure de Paris | Contenu                                              |
| -------- | -------------- | ---------------------------------------------------- |
| Matin    | 7 h 30         | Titre du jour, charge, quêtes numérotées, quête rare  |
| Soir     | 21 h 30        | Ce qui a été fait, puis la question de la phrase      |
| Dimanche | avec le matin  | Bilan de la semaine, version courte                   |

Le message du matin porte un bouton par quête : y toucher valide sans ouvrir
l'app, et les boutons se rafraîchissent aussitôt. Un bouton « Jour bas » est là
aussi. **Tout message texte envoyé au bot devient la phrase du soir** du jour en
cours — le bot le confirme, et un nouveau message corrige le précédent.

Quatre commandes, pour répondre sans ouvrir l'app :

| Commande       | Effet                                                        |
| -------------- | ------------------------------------------------------------ |
| `/aujourdhui`  | Renvoie le message du matin, à l'heure qu'il est              |
| `/fait <n>`    | Valide la n-ième quête de la liste du jour                    |
| `/cartes`      | Cartes dues et tâches ouvertes                                |
| `/pause <n>`   | Suspend les rappels n jours ; `/pause 0` les reprend          |

La pause vaut pour **les deux canaux** : elle ne désactive rien et ne rattrape
rien. Le `chat_id` est vérifié à chaque message — personne d'autre ne peut
piloter l'application.

Un lendemain de nuit — le shift du samedi finit à 1 h — ouvre autrement : la
journée est annoncée comme allégée d'office, sans rien à rattraper. Une journée
sans rien de coché reçoit le même égard qu'une autre : on constate, on pose la
question, on ne relance pas.

### Heure d'été, et pourquoi rien n'arrivait

Vercel planifie en UTC ; Paris avance d'une heure en hiver, de deux en été. La
première version déclarait **six tâches** — deux horaires UTC par message — et
`/api/cron` ne postait que dans une fenêtre de cinquante-neuf minutes après
l'heure dite.

Deux choses clochaient, et il fallait les deux pour que rien n'arrive :

1. **Six tâches sur un palier qui en autorise deux.** Vercel Hobby plafonne à
   deux tâches quotidiennes. Un `vercel.json` qui en déclare six ne voit pas ses
   tâches enregistrées : aucun déclencheur, donc aucun message, quelles que
   soient les variables Telegram.
2. **Une fenêtre étroite sur un déclencheur imprécis.** Sur le même palier, une
   tâche planifiée peut partir n'importe quand dans l'heure. Même enregistrée,
   elle serait souvent tombée hors de la fenêtre.

`vercel.json` déclare donc maintenant **deux tâches** (6 h 30 et 20 h 30 UTC), et
`planning.ts` ne demande plus « sommes-nous dans la fenêtre ? » mais **« ce
message était-il dû aujourd'hui ? »** — dû dès que son heure de Paris est
passée. L'idempotence par `(date, type)`, qui existait déjà, garantit qu'il ne
part qu'une fois. Conséquences : un déclencheur en retard d'une heure envoie
quand même, un déclencheur du soir rattrape un message du matin jamais parti, un
doublon ne fait rien, et le passage à l'heure d'été ne demande plus aucun
réglage. Le bilan du dimanche part avec le message du matin, faute d'un
troisième créneau.

> `CRON_SECRET` doit être renseignée dans Vercel : sans elle, `/api/cron` répond
> 500 avant même de regarder l'heure, et `/api/telegram` ignore tout ce que
> Telegram lui envoie. C'est la deuxième cause de silence, après les tâches.

### Si Telegram tombe

Rien ne casse. Jeton absent, réseau coupé, API en panne : l'appel se solde par
une trace en journal, l'envoi n'est pas consigné, et le prochain déclenchement
retentera. L'application ne dépend jamais du bot.

## Recherche globale

Un champ unique, atteignable depuis l'en-tête de n'importe quel écran, qui
traverse tout : cartes (recto, verso, notes, étiquettes), versets (arabe,
translittération, traduction), vocabulaire arabe (mot, racine, sens), quêtes,
arcs et leurs étapes, tâches libres. Les résultats sont groupés par type avec le
compte réel de chaque groupe, des filtres restreignent à un seul type, et chaque
résultat mène **au bon endroit** — le verset dans sa sourate, la carte dans son
paquet, la quête dans son arc.

**L'insensibilité aux diacritiques sans extension Postgres.** `unaccent` est une
extension, et une extension peut manquer à l'hébergement. Le pliage se fait donc
avec `translate()`, à partir d'une table de correspondance définie en
TypeScript : les deux chaînes qu'attend `translate` sont construites depuis la
même liste de paires, donc elles ne peuvent pas se désaligner. La liste couvre le
français et la translittération savante de l'arabe — « ṣalāt » se replie sur
« salat », les signes ʾ et ʿ disparaissent.

Le pliage ne suffit pas pour « coran » → « Qurʾān » : ce n'est pas un accent,
c'est une autre graphie. Une **liste close** de correspondances connues comble
l'écart — pas de recherche floue, qui rendrait des résultats qu'on ne saurait pas
expliquer. Vérifié : « coran » et « quran » trouvent tous deux un verset
contenant « Qurʾān », et « salat » trouve une tâche écrite « ṣalāt ».

L'historique des dernières recherches vit dans le navigateur, pas en base : c'est
un confort propre à l'appareil, et il ne garde que ce qui a donné un résultat.

## Sauvegardes

Automatiques, une par semaine, produites par le déclencheur planifié. Les **huit
dernières** sont conservées, les plus anciennes purgées — sans quoi le poids
grimperait sans fin sur un palier de 512 Mo. Date et poids de la dernière sont
affichés dans **Réglages → Sauvegardes**, et un appui la télécharge.

**Ce qui est dedans** : cartes et historique de révision, quêtes, arcs et
étapes, validations, momentum, tâches, emploi du temps, progression de lecture,
marque-pages, réglages. **Ce qui n'y est pas** : le texte coranique, la
morphologie, les gloses, les images — des dizaines de mégaoctets qui se
réinstallent d'une adresse, et dont l'inclusion rendrait la sauvegarde trop
lourde pour être écrite dans une fonction serverless. Une sauvegarde qu'on ne
peut pas produire ne protège rien. Mesuré sur une base réelle : **2,3 Mo** pour
23 tables et 225 cartes.

**La restauration** est la seule action de l'application qui puisse détruire des
données. Elle suit donc le même ordre que la route de dépôt : lire, montrer,
écrire. Le fichier est analysé dans le navigateur sans rien toucher, chaque table
est comparée ligne à ligne avec ce qui est en base, et la confirmation dit en
toutes lettres ce qui disparaît — chaque table listée est **vidée puis
réécrite**, celles absentes du fichier ne sont pas touchées.

Elle passe par une route et non par une action serveur : à 2,3 Mo, le fichier
dépasse le plafond d'un mégaoctet des Server Actions. Le découpage se fait dans
le navigateur — seul endroit où le fichier tient en entier — et le serveur ne
voit jamais que quelques centaines de lignes à la fois. Les séquences `serial`
sont remises au-delà du plus grand identifiant réécrit : sans cela, la première
insertion suivante entrerait en collision avec une ligne restaurée.

## Texture narrative

L'application a une voix. Elle ne félicite pas, ne compte pas de points totaux,
ne décerne rien. Quatre mécaniques, toutes déterministes — la même date dans le
même contexte donne toujours le même résultat, donc rien ne change en
rechargeant la page.

**Titre du jour** — 84 titres tenus dans `src/lib/recits/titres.ts`, chacun
conditionné ou non par la charge, la récupération, le jour bas, l'élan, la
saison, le jour de la semaine ou l'heure. Une journée vraiment marquée — jour
bas, lendemain de nuit, ouverture en pleine nuit — est nommée par ce qui la
marque ; une journée ordinaire puise dans tout le catalogue. Un titre ne revient
pas avant quinze jours, et il est figé en base dès qu'il est choisi : il ne
change pas parce que l'heure a tourné.

**Quête rare** — un jour sur cinq environ, une proposition de plus, encadrée et
titrée en serif. Elle ne vient d'aucun arc, ne compte dans la progression
d'aucun, et crédite le momentum de son pilier au double de son poids. Le
catalogue de 40 est parcouru en entier avant qu'une quête ne revienne. Jamais
obligatoire : elle disparaît à minuit sans rien retirer.

**Seuils d'arc** — franchir 10, 25, 50, 75 ou 100 % ouvre un écran plein, une
seule fois. Le nom de l'arc, le seuil, la vision rappelée, une phrase sur le
chemin. Un arc qui redescend ne déperd pas son seuil.

**Saisons** — des cycles de quatre semaines numérotés, ancrés sur la première
journée observée. À la fin de chacune, un écran constate ce qui a avancé et ce
qui est resté silencieux, puis pose une question ouverte. La réponse est
archivée telle quelle dans **Parcours**, sans traitement — et « Passer sans
répondre » est une sortie légitime.

## Tâches libres

Ce qui tombe sans prévenir et n'entre dans aucun arc : un papier à envoyer, un
appel à passer, un mémoire à avancer. La zone « à faire aujourd'hui » vit sur
l'écran du jour, sous les quêtes.

**C'est une liste, pas un système.** Pas de priorité, pas d'étiquette, pas
d'échéance — ajouter l'un des trois transformerait la liste en chose à tenir, et
une chose à tenir finit par être une dette. On tape une ligne, entrée, c'est là.

Le rattachement à un pilier est **facultatif**, et ne pas le remplir est le cas
normal. Rattachée, la tâche cochée crédite son pilier de deux points, une seule
fois, par le même chemin idempotent que les quêtes (`crediterPilier`). Libre,
elle ne compte nulle part.

**Rien ne « passe au lendemain »**, parce qu'il n'y a rien à reporter : une tâche
ouverte n'a pas de date de réalisation prévue, seulement une date de création.
Elle reste jusqu'à ce qu'elle soit faite ou retirée. C'est aussi le seul moyen
sûr de ne jamais afficher un retard — le retard n'est pas calculable. L'âge est
lisible en ouvrant la tâche, jamais souligné, jamais coloré.

Les gestes : **cocher** valide ; **glisser vers la gauche** ou **appuyer
longuement** découvre la suppression. Aucun des deux ne supprime au premier
geste — le glissement révèle un bouton, il ne déclenche pas. Une liste où un
mouvement mal assuré efface une ligne est une liste dans laquelle on n'écrit
plus.

**La promotion en quête.** Une tâche dont l'intitulé a déjà été fait trois fois
n'est pas un imprévu : c'est un geste régulier sans place. L'écran le signale et
propose de la promouvoir — choix de l'arc, fréquence, durée — puis la retire de
la liste ; elle reviendra désormais par la sélection du jour.

## Progression des arcs

Elle ne se saisit pas, elle se lit dans les validations. Chaque validation
rapporte le poids de sa quête, doublé quand elle relançait un pilier silencieux
— exactement ce qui a nourri le momentum.

L'objectif est propre à chaque arc : ce qu'il rapporterait en tenant son rythme
nominal (`Σ poids × frequenceSem` sur ses quêtes actives) pendant **douze
semaines**. Un arc exigeant demande donc plus de gestes qu'un arc léger pour
afficher le même pourcentage. La colonne `arcs.progression` a été supprimée :
plus rien n'est stocké.

### Créer et faire vivre un arc

Le catalogue de départ n'est qu'un point de départ : rien n'y est figé. Un arc se
crée depuis `/arcs/nouveau`, et un arc du catalogue se renomme, change de pilier
et s'archive exactement comme un arc créé à la main — il n'existe aucun drapeau
« fourni », parce qu'un tel drapeau finirait par interdire quelque chose.

**Les étapes** (`etapes_arc`) sont ce qui distingue un arc d'une liste de
tâches : le chemin est écrit à l'avance. Une étape n'est pas une quête — elle ne
se planifie pas, ne consomme pas de budget-temps et ne nourrit aucun momentum.
Elle se franchit, sa date de franchissement reste, et elle se réordonne d'un
cran à la fois.

**Archiver** met l'arc en sommeil (`actif = false`) : ses quêtes cessent de
sortir dans la sélection, tout le reste demeure — validations, historique,
seuils franchis. **Accomplir** pose `accompliLe` : l'arc rejoint
`/arcs/accomplis` et quitte la liste courante. Les deux se défont.

## Bilan hebdomadaire

Entièrement dérivé des chiffres en base, sans modèle de langage. Par pilier :
validations et points de la semaine, écart avec la semaine précédente, état du
momentum. Puis le pilier le plus nourri, le plus silencieux, les jours bas, et
les phrases du soir listées.

Pas de note globale, pas de « tu aurais pu ». Une semaine creuse est constatée,
pas commentée — et elle ne retire rien à ce qui est déjà construit.

## Les piliers

`deen` · `corps` · `table` · `savoir` · `oeuvre` · `seve`

Huit arcs les traversent — `savoir` et `corps` en portent deux chacun.

## L'emploi du temps

Deux tables décrivent la semaine :

- `creneauxRecurrents` — la trame hebdomadaire (cours, travail, prière, autre),
  avec des bornes de validité facultatives (`actifDepuis`, `actifJusqua`) ;
- `evenements` — le ponctuel, posé sur une date.

**Le ponctuel écrase le récurrent qu'il recouvre.** Un remplacement le remplace ;
une annulation — un événement réduit à un instant, `début = fin` — le retire sans
rien occuper. C'est ce que produit le fait de toucher un bloc récurrent dans
l'écran Semaine ; toucher son filigrane le rétablit.

Un créneau dont la fin précède le début passe minuit. C'est de là que vient la
**récupération** : un créneau qui a mordu sur la nuit allège le lendemain. Le
shift du samedi finit à 1 h, donc le dimanche est un jour de récupération ; celui
du dimanche s'arrête pile à minuit et ne déborde pas sur le lundi.

### La grille de la semaine

Une vraie grille horaire, aux conventions d'un agenda : les heures en colonne à
gauche, les jours en colonnes, chaque bloc positionné et dimensionné à sa durée
réelle. La version précédente donnait vingt-sept pixels par heure et du texte de
huit points et demi — elle disait ce qu'il y avait, on ne pouvait pas le lire.

- **62 px par heure**, sur les vingt-quatre heures et non la seule fenêtre
  d'éveil : un service qui finit à 1 h doit se voir.
- **Trois paliers**, portés par des requêtes de média et non par du JavaScript
  qui mesurerait la fenêtre — la bascule suit la largeur réelle dès le premier
  rendu, sans clignotement ni écart entre serveur et navigateur :
  - **téléphone, sous 500 px** — vue **jour** par défaut. Sept colonnes n'ont
    aucun sens sur cette largeur. Un sélecteur montre les sept jours en
    pastilles, tous visibles à 390 px sans défilement, le jour courant choisi à
    l'ouverture et marqué d'un point. La grille du jour prend toute la largeur
    utile. Un bouton bascule vers la semaine condensée si on la veut quand même.
  - **tablette portrait** — trois jours, défilement horizontal ;
  - **tablette paysage** — les sept jours d'un coup.
- **L'en-tête des jours vit dans le conteneur qui défile**, et non au-dessus.
  C'est la correction d'un défaut qui rendait la grille inutilisable sur
  téléphone : un en-tête posé à côté et calé par une simple marge ne peut pas
  suivre le défilement horizontal. Il se désalignait d'autant de colonnes que la
  grille était décalée — les jours affichés commençaient au mercredi — et
  débordait de la page, ce qui coupait la colonne des heures et tronquait le
  texte sous la grille. Mesuré après correction : zéro pixel d'écart entre
  en-tête et corps après un défilement de 400 px, et zéro débordement horizontal
  à 390, 430, 820 et 1180 px.
- **Ouverture sur l'heure courante**, jamais sur minuit, et une ligne d'heure
  sur la colonne du jour, rafraîchie chaque minute.
- **Un bloc qui passe minuit est coupé en deux** : son jour jusqu'à minuit, le
  reste sur le lendemain marqué d'un `↳`.
- **Les chevauchements se rangent côte à côte**, en partageant la largeur — et
  les blocs écartés entrent dans le même calcul que les autres, sans quoi un
  récurrent et le ponctuel qui l'annule se superposeraient toujours.
- **Contrainte ou choix.** Un récurrent porte une trame, un ponctuel une teinte
  unie : ce qui est négociable saute aux yeux. Les couleurs sont celles des
  piliers — `cours` reprend Savoir, `travail` Œuvre, `priere` Deen.
- Toucher un bloc en ouvre le détail, avec l'écart ou le rétablissement pour ce
  jour-là.

## Les deux règles qui comptent

### Budget-temps et sélection des quêtes

Le nombre de quêtes ne vient pas d'une étiquette posée sur la journée, mais du
temps qui reste vraiment :

```
16 h d'éveil (07:00 – 23:00)
 − les créneaux du jour, fusionnés et ramenés à la fenêtre d'éveil
 − 2 h incompressibles (repas, trajets, prières, marge)
 = tempsDispo
```

| Temps disponible   | Quêtes proposées   |
| ------------------ | ------------------ |
| moins de 2 h       | 1 quête `minimale` |
| de 2 h à 4 h       | 2 quêtes           |
| plus de 4 h        | 3 quêtes           |
| jour récupération  | une quête de moins |
| mode « jour bas »  | 1 quête `minimale` |

La somme des durées proposées doit en outre tenir dans **40 % du temps
disponible**. Une quête qui déborde le budget restant laisse la place à une plus
légère du même pilier. Ce qui a déjà été validé dans la journée consomme le
quota comme le budget.

Un jour de récupération ne descend jamais sous une quête : une journée sans rien
à proposer serait une punition, pas un repos.

Dans tous les cas, **les piliers au momentum le plus bas passent devant**. À
momentum égal — le premier jour, tout est à zéro — l'ordre déclaré des piliers
tranche, pour que la sélection ne bouge pas d'un rafraîchissement à l'autre.

Chaque quête porte une **fréquence hebdomadaire** (`frequenceSem`, 1 à 7) :
une quête à 3 fois par semaine ne ressort pas une quatrième fois. Le compte se
fait sur une fenêtre glissante de sept jours, pas sur la semaine civile — aucun
lundi ne remet les compteurs à plat.

Sont aussi écartées : les quêtes déjà faites du jour et celles dont le jour
figure dans `joursExclus`. Une durée de `0` min signale une quête d'ambiance,
sans créneau dédié (marcher, boire de l'eau, journée sans ultra-transformé).

### Momentum

Une valeur par pilier, entre 0 et 100.

- **Validation** : `+poids` sur le pilier.
- **Jour sans rien** : `-5 %`, de façon multiplicative. La valeur s'érode, elle
  ne tombe jamais à zéro et n'est **jamais remise à zéro**.
- **Reprise** : après deux jours de silence sur un pilier, la première
  validation compte **double**.

Les jours où un pilier a été nourri sont exclus du décompte de la décroissance.
Le calcul est rejouable : recharger l'écran dix fois dans la journée ne fait pas
baisser les barres dix fois.

Aucun rouge, aucun « streak perdu », aucun compteur d'échecs. Un jour manqué est
gris et neutre — c'est une décision de conception, pas un oubli.

---

## Structure

```
src/
  app/
    connexion/      page de connexion + action serveur
    (app)/          écrans applicatifs, sous la barre de navigation
      jour/         écran du jour + actions serveur
      semaine/      écran de la semaine + actions serveur
      arcs/         liste et détail des arcs
      bilan/        bilan hebdomadaire
      reglages/     création, modification, suppression + actions serveur
      cartes/       paquets, calendrier, révision, éditeur, recherche,
                    organisation, réglages du module + actions serveur
      jardin/       les plantes de tous les paquets et des six piliers
    api/setup/      installation de la base depuis un navigateur
    api/export/     téléchargement de la sauvegarde
    api/cartes/     images des cartes, export JSON et CSV
    manifest.ts     manifest PWA
  components/       momentum, quêtes, jour bas, phrase du soir, grille et
                    formulaires de la semaine, navigation, réglages,
                    cartes (révision, éditeur, barre, calendrier, recherche),
                    jardin, flèche de retour
  db/               schéma Drizzle et connexion Neon
  lib/
    auth.ts         mot de passe unique, cookie signé (Web Crypto)
    dates.ts        journée calée sur le fuseau de référence
    temps.ts        arithmétique des créneaux — logique pure
    charge.ts       règles de charge et budget — logique pure
    creneaux.ts     récurrent écrasé par le ponctuel — logique pure
    momentum.ts     décroissance, bonus de reprise — logique pure
    selection.ts    choix des quêtes du jour — logique pure
    jour.ts         accès base et orchestration de l'écran du jour
    semaine.ts      accès base et orchestration de l'écran de la semaine
    arcs.ts         progression calculée, création, étapes, archivage
    taches.ts       tâches libres : ajout, coche, promotion en quête
    recherche.ts    recherche globale (accès base)
    recherche-partage.ts  types et libellés — logique pure
    sauvegardes.ts  production, purge, restauration par lots (accès base)
    sauvegardes-partage.ts  analyse d'un fichier déposé — logique pure
    notifications/
      sujet.ts      résolution et validation du `sub` VAPID — logique pure
      push.ts       VAPID, abonnements, envoi chiffré
      envoi.ts      composition des rappels, aiguillage des canaux
      reglages.ts   canal, créneaux, horaires, pause
    bilan.ts        chiffres de la semaine
    coran/
      sources.ts    éditions, licences, récitateurs — aucune donnée coranique
      formats.ts    formats de carte, masquage de fin — logique pure
      calendrier.ts (voir cartes/) — le calendrier est partagé
      morphologie.ts lecture du corpus, libellés grammaticaux — logique pure
      sqlite.ts     lecteur du format SQLite, sans dépendance — logique pure
      ressources.ts reconnaissance d'un fichier déposé — logique pure
      import.ts     import par lots, reprenable
      televersement.ts écriture d'un dépôt, alignement vérifié
      donnees.ts    lecture, suivi, progression
      hifz.ts       versets → cartes du module cartes
    cartes/
      fsrs.ts       ordonnancement — logique pure
      file.ts       file de session à la manière d'Anki — logique pure
      generation.ts note → cartes, trous, inversées, arabe — logique pure
      calendrier.ts grille, paliers de couleur, séries — logique pure
      image.ts      compression navigateur — logique pure
      csv.ts        aller-retour CSV avec Anki — logique pure
      donnees.ts    lecture : sessions, notations, progression
      edition.ts    écriture : notes, paquets, espaces, images, archivage
  middleware.ts     garde de session
drizzle/            migrations SQL
scripts/            seed et génération d'icônes
```

`temps.ts`, `charge.ts`, `creneaux.ts`, `momentum.ts`, `selection.ts` et les
six modules purs de `cartes/` ne touchent pas la base : toute la règle du jeu y
est vérifiable sans Postgres. `components/jardin/botanique.ts` non plus — les
plantes sont de la géométrie, pas des images.

## Le seed

`npm run db:seed` charge les 8 arcs, 28 quêtes et les 3 shifts récurrents
(mardi 18:30–21:30, samedi 19:00–01:00, dimanche 18:00–00:00), et crée les
lignes de momentum à zéro — aucun historique inventé.

Le script **refuse de tourner si le catalogue existe déjà** : supprimer les
quêtes effacerait en cascade les validations. Pour le remplacer volontairement :

```bash
FORCE=1 npm run db:seed
```

Le momentum n'est jamais écrasé : les lignes manquantes sont créées, les
existantes laissées telles quelles.
