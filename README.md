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

Barre du bas à cinq onglets — **Jour · Semaine · Cartes · Arcs · Bilan** — et les
réglages derrière une roue discrète, en haut de chaque écran.

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

**Écriture** — les notations partent dans une file d'attente avec reprise
exponentielle et rejeu au retour de la connexion. L'écran n'attend jamais le
réseau.

**Intégration** — onglet *Cartes*, page *Jardin*, cartes dues affichées sur
l'écran du jour, révision qui crédite le pilier `savoir` une fois par jour, et
au-delà de cinquante cartes dues la charge de la journée retire trente minutes
au budget.

**Jardin** — une plante en pixel art par paquet, six stades selon la maîtrise
réelle (part de cartes mûres). Un paquet laissé plus de deux semaines pâlit,
sans jamais mourir. Les six piliers ont aussi la leur, liée au momentum.

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

## Le bot Telegram

L'application ne compte pas sur le fait qu'on pense à l'ouvrir : elle vient.
Trois messages, tous facultatifs — sans les variables Telegram, le reste
fonctionne exactement pareil.

| Message  | Heure de Paris | Contenu                                              |
| -------- | -------------- | ---------------------------------------------------- |
| Matin    | 7 h 30         | Titre du jour, charge, quêtes numérotées, quête rare  |
| Soir     | 21 h 30        | Ce qui a été fait, puis la question de la phrase      |
| Dimanche | 10 h           | Bilan de la semaine, version courte                   |

Le message du matin porte un bouton par quête : y toucher valide sans ouvrir
l'app, et les boutons se rafraîchissent aussitôt. Un bouton « Jour bas » est là
aussi. **Tout message texte envoyé au bot devient la phrase du soir** du jour en
cours — le bot le confirme, et un nouveau message corrige le précédent. Les
commandes (`/…`) sont ignorées.

Un lendemain de nuit — le shift du samedi finit à 1 h — ouvre autrement : la
journée est annoncée comme allégée d'office, sans rien à rattraper. Une journée
sans rien de coché reçoit le même égard qu'une autre : on constate, on pose la
question, on ne relance pas.

### Heure d'été

Vercel planifie en UTC ; Paris avance d'une heure en hiver, de deux en été. Un
horaire fixe dériverait donc d'une heure la moitié de l'année. `vercel.json`
déclare **les deux horaires UTC possibles** pour chaque message, et
`/api/cron` tranche : il lit l'heure réelle de Paris et n'envoie que si le
créneau y correspond. Le déclenchement en trop tombe hors créneau et ne fait
rien ; l'envoi est de toute façon consigné par date et par type, donc jamais
dupliqué.

> **Six tâches planifiées.** Les comptes Vercel Hobby sont limités à deux
> tâches quotidiennes. Si le déploiement s'en plaint, garder les deux du matin
> (`30 5` et `30 6`) : les messages du soir et du dimanche cessent, le reste
> tient. Le plan Pro lève la limite.

### Si Telegram tombe

Rien ne casse. Jeton absent, réseau coupé, API en panne : l'appel se solde par
une trace en journal, l'envoi n'est pas consigné, et le prochain déclenchement
retentera. L'application ne dépend jamais du bot.

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

## Progression des arcs

Elle ne se saisit pas, elle se lit dans les validations. Chaque validation
rapporte le poids de sa quête, doublé quand elle relançait un pilier silencieux
— exactement ce qui a nourri le momentum.

L'objectif est propre à chaque arc : ce qu'il rapporterait en tenant son rythme
nominal (`Σ poids × frequenceSem` sur ses quêtes actives) pendant **douze
semaines**. Un arc exigeant demande donc plus de gestes qu'un arc léger pour
afficher le même pourcentage. La colonne `arcs.progression` a été supprimée :
plus rien n'est stocké.

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
    api/setup/      installation de la base depuis un navigateur
    api/export/     téléchargement de la sauvegarde
    manifest.ts     manifest PWA
  components/       momentum, quêtes, jour bas, phrase du soir, grille et
                    formulaires de la semaine, navigation, réglages
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
    arcs.ts         progression calculée sur les validations
    bilan.ts        chiffres de la semaine
  middleware.ts     garde de session
drizzle/            migrations SQL
scripts/            seed et génération d'icônes
```

`temps.ts`, `charge.ts`, `creneaux.ts`, `momentum.ts` et `selection.ts` ne
touchent pas la base : toute la règle du jeu y est vérifiable sans Postgres.

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
