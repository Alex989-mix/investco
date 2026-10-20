# Invest.co

Application personnelle de suivi de patrimoine (PWA, JavaScript sans build), hébergée sur Netlify.
Les données restent sur l'appareil (et éventuellement dans le Google Drive de l'utilisateur) :
**ce dépôt ne contient aucune donnée personnelle** et ne doit jamais en contenir.

## Arborescence

```
app/                    site publié tel quel par Netlify
  index.html            l'appli
  sw.js                 service worker (hors ligne + mises à jour)
  version.js            numéro de version + notes « Nouveautés »  ← à modifier à chaque version
netlify/functions/      fonction serveur des cours (Yahoo Finance)
tests/                  tests automatiques (Playwright)
netlify.toml            configuration Netlify
```

## Publier une nouvelle version

1. Modifier le code dans `app/`.
2. Si la structure des données change : incrémenter `SCHEMA` dans `index.html` et ajouter
   la migration correspondante dans `MIGRATIONS` (ne jamais modifier une migration existante).
3. Dans `app/version.js` : nouveau numéro `APP_VERSION`, date et notes.
4. Lancer `node tests/run.js` : tout doit être « OK ».
5. `git commit` puis `git push` sur `main` → Netlify déploie en environ une minute.
6. Sur le téléphone : la barre orange « Nouvelle version » apparaît ; un appui suffit.
   Une copie des données est faite automatiquement juste avant.

## Revenir en arrière

Netlify ▸ Deploys ▸ choisir un déploiement précédent ▸ « Publish deploy ».
Les données restent sur le téléphone ; une sauvegarde de sécurité est restaurable dans
Réglages ▸ Sauvegardes de sécurité.
