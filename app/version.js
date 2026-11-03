/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '27.0';
self.APP_RELEASE = {
  date: '2026-11-03',
  notes: [
    'La Crypto devient un module à part entière : masquez-la seule dans Réglages ▸ Modules si vous ne suivez que la bourse.',
    'À l\'inverse, vous pouvez ne garder que la Crypto : l\'onglet s\'appelle alors « Crypto » et ne montre que vos cryptos.',
    'Comme toujours, rien n\'est supprimé : les montants masqués restent dans votre patrimoine net et votre récap fiscal.'
  ]
};
