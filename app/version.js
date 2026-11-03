/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '24.0';
self.APP_RELEASE = {
  date: '2026-11-03',
  notes: [
    'Préparation de l\'appli modulable : chaque famille de placements (bourse, épargne, immobilier, crowdfunding, budget, achat-revente…) devient un module.',
    'Pour vous, rien ne change : tous les modules restent actifs, vos écrans et vos chiffres sont identiques.',
    'Bientôt dans les Réglages : choisir les modules affichés. Masquer un module ne supprimera jamais ses données, toujours comptées dans votre patrimoine et votre récap fiscal.'
  ]
};
