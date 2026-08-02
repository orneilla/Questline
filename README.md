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
npm run db:migrate        # applique drizzle/0000_init.sql
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

> Sans `SESSION_SECRET`, changer le mot de passe déconnecte tous les appareils.

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

## Ce que fait la session 1

- **Connexion** — un seul mot de passe, cookie `httpOnly` signé (HMAC-SHA256)
  valable 90 jours, vérifié par le middleware sur toutes les routes.
- **Écran du jour** — date et salutation, les quêtes du jour, les six barres
  de momentum, la bascule « jour bas », la phrase du soir en enregistrement
  automatique.
- **PWA** — manifest, icônes, mode standalone, thème sombre.

## Les piliers

`deen` · `corps` · `table` · `savoir` · `oeuvre` · `seve`

Huit arcs les traversent — `savoir` et `corps` en portent deux chacun.

## Les deux règles qui comptent

### Sélection des quêtes

La charge de la journée est **lue dans les créneaux et le calendrier**, jamais
saisie à la main :

| Journée                          | Quêtes proposées                   |
| -------------------------------- | ---------------------------------- |
| Un créneau `shift`               | 1 quête, courte (≤ 30 min)         |
| Jour allégé, ou créneau `cours`  | 2 quêtes, sur 2 piliers            |
| Ni l'un ni l'autre (jour libre)  | 3 quêtes, sur 3 piliers différents |
| Mode « jour bas »                | 1 quête `minimale`                 |

Les jours allégés d'office sont le **dimanche et le lundi** — récupération
après le shift de nuit du samedi (22 h – 4 h). Le dimanche portant en plus son
propre shift du soir, il retombe de toute façon sur une seule quête. Les
créneaux de `priere` structurent la journée sans la charger.

Dans tous les cas, **les piliers au momentum le plus bas passent devant**, et ce
qui a déjà été validé aujourd'hui compte dans le quota : une journée ne s'étire
pas. À momentum égal — le premier jour, tout est à zéro — l'ordre déclaré des
piliers tranche, pour que la sélection ne bouge pas d'un rafraîchissement à
l'autre.

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
    jour/           écran du jour + actions serveur
    manifest.ts     manifest PWA
  components/       barres de momentum, liste de quêtes, jour bas, phrase du soir
  db/               schéma Drizzle et connexion Neon
  lib/
    auth.ts         mot de passe unique, cookie signé (Web Crypto)
    dates.ts        journée calée sur le fuseau de référence
    momentum.ts     décroissance, bonus de reprise — logique pure
    selection.ts    choix des quêtes du jour — logique pure
    jour.ts         accès base et orchestration de l'écran
  middleware.ts     garde de session
drizzle/            migrations SQL
scripts/            seed et génération d'icônes
```

`momentum.ts` et `selection.ts` ne touchent pas la base : toute la règle du jeu
y est vérifiable sans Postgres.

## Le seed

`npm run db:seed` charge les 8 arcs, 28 quêtes et 3 créneaux réels, et crée les
lignes de momentum à zéro — aucun historique inventé.

Le script **refuse de tourner si le catalogue existe déjà** : supprimer les
quêtes effacerait en cascade les validations. Pour le remplacer volontairement :

```bash
FORCE=1 npm run db:seed
```

Le momentum n'est jamais écrasé : les lignes manquantes sont créées, les
existantes laissées telles quelles.
