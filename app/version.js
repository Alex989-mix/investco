/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '22.1';
self.APP_RELEASE = {
  date: '2026-10-31',
  notes: [
    'Analyse et Achat-revente adoptent le nouveau design : une carte de synthèse en tête, puis des sections claires et des lignes faciles à toucher.',
    'Réglages, « Ajouter » et l\'import de relevés : icônes au trait à la place des emojis, boutons plus grands.',
    'Récap fiscal : taux affichés à la française (18,6 % au lieu de 18.6%).'
  ]
};
