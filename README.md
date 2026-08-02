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
npm run db:seed           # jeu de test (efface le contenu existant)
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
| `npm run db:seed`     | Réécrit un jeu de données de test                    |
| `npm run icones`      | Regénère les icônes PWA                              |

---

## Ce que fait la session 1

- **Connexion** — un seul mot de passe, cookie `httpOnly` signé (HMAC-SHA256)
  valable 90 jours, vérifié par le middleware sur toutes les routes.
- **Écran du jour** — date et salutation, les quêtes du jour, les cinq barres
  de momentum, la bascule « jour bas », la phrase du soir en enregistrement
  automatique.
- **PWA** — manifest, icônes, mode standalone, thème sombre.

## Les deux règles qui comptent

### Sélection des quêtes

La charge de la journée est **lue dans les créneaux**, jamais saisie à la main :

| Journée                     | Quêtes proposées                   |
| --------------------------- | ---------------------------------- |
| Un créneau `shift`          | 1 quête, courte (≤ 30 min)         |
| Un créneau `cours`          | 2 quêtes, sur 2 piliers            |
| Aucun des deux (jour libre) | 3 quêtes, sur 3 piliers différents |
| Mode « jour bas »           | 1 quête `minimale`                 |

Les créneaux de `priere` structurent la journée sans la charger. Dans tous les
cas, **les piliers au momentum le plus bas passent devant**, et ce qui a déjà
été validé aujourd'hui compte dans le quota : une journée ne s'étire pas.

Sont écartées : les quêtes déjà faites du jour, celles dont le jour figure dans
`joursExclus`, les hebdomadaires validées il y a moins de sept jours et les
ponctuelles déjà accomplies.

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
