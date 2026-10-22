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
  js/finance.js         calculs purs (crédit, centimes, paramètres réglementaires datés, revente, budget, objectifs)
  js/csvimport.js       lecture des CSV de toute banque et des exports crypto (Bitstack…)
netlify/functions/      fonction serveur des cours (Yahoo Finance)
docs/                   documentation utilisateur : guide utilisateur, notes de version (PDF)
tests/                  tests automatiques : finance.test.js (calculs, Node seul) + parcours Playwright
netlify.toml            configuration Netlify
```

## Règles de données

- Montants stockés en **centimes entiers** (`Fin.serialize` / `Fin.deserialize`) ; en mémoire, euros arrondis au centime.
- Taux, plafonds et seuils réglementaires : `PARAM_DEFAULTS` dans `js/finance.js`, avec date de validité.
  Pour un changement de règle, **ajouter** une entrée datée (ne jamais modifier une valeur passée).
  L'utilisateur peut aussi ajouter des valeurs datées dans Réglages ▸ Paramètres réglementaires.
- Les soldes d'épargne sont calculés depuis les opérations (jamais saisis en dur).

## Publier une nouvelle version

1. Modifier le code dans `app/`.
2. Si la structure des données change : incrémenter `SCHEMA` dans `index.html` et ajouter
   la migration correspondante dans `MIGRATIONS` (ne jamais modifier une migration existante).
3. Dans `app/version.js` : nouveau numéro `APP_VERSION`, date et notes (affichées dans l'appli).
4. Documentation (à chaque version) :
   - ajouter la version **en tête** de `docs/changelog.json` (textes au vouvoiement, types new / improved / fixed) ;
   - si une fonctionnalité décrite dans le guide change : mettre à jour `docs/guide/guide.html`,
     puis `"guide": true` et la liste des sections dans `"guideChanges"` ;
   - `node docs/build.js` → `docs/dist/Invest.co - Guide utilisateur v<version>.pdf` et
     `docs/dist/Invest.co - Notes de version <version>.pdf` (captures régénérées automatiquement ;
     le script s'arrête si le changelog ne correspond pas à `version.js` ou si une page déborde).
     Première fois : `npm install --prefix docs`.
5. Lancer `node tests/run.js` : tout doit être « OK ». **Ne pousser que si tous les tests passent**
   (ne jamais enchaîner test et push dans une même commande sans condition).
6. `git commit` puis `git push` sur `main` → Netlify déploie en environ une minute.
7. Sur le téléphone : la barre orange « Nouvelle version » apparaît ; un appui suffit.
   Une copie des données est faite automatiquement juste avant.

## Revenir en arrière

Netlify ▸ Deploys ▸ choisir un déploiement précédent ▸ « Publish deploy ».
Les données restent sur le téléphone ; une sauvegarde de sécurité est restaurable dans
Réglages ▸ Sauvegardes de sécurité.
