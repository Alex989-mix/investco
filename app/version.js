/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '16.1';
self.APP_RELEASE = {
  date: '2026-10-20',
  notes: [
    'Saisie des nombres à la française : « 37,50 » et « 10,5 % » sont bien compris (avant : 3 750 € et 105 %).',
    'Bricks : calendrier des versements corrigé (premier versement à M+1, fins de mois), montant calculé depuis le taux.',
    'Bricks : les projets en retard ou en défaut restent comptés dans le patrimoine ; intérêts imposés au PFU par défaut.',
    'PEA : PRU et plus-values corrects après une vente partielle ; ventes dans le PEA exclues de l\'impôt.',
    'Livrets : intérêts calculés quinzaine par quinzaine, au taux en vigueur à chaque période.',
    'Budget : dépenses récurrentes datées du bon jour et du bon mois.',
    'Cours ETF : ils se rafraîchissent à nouveau à chaque ↻.',
    'Mises à jour : détection automatique, sauvegarde de tes données avant chaque mise à jour, restauration possible dans Réglages.'
  ]
};
