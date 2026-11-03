/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '26.0';
self.APP_RELEASE = {
  date: '2026-11-03',
  notes: [
    'Nouveau premier écran « Composez votre appli » : un point de départ (Épargnant, Bourse, Immobilier ou Tout), puis les modules à cocher.',
    'L\'appli démarre ensuite avec seulement ce que vous suivez ; tout se change à tout moment dans Réglages ▸ Modules.',
    'Pour vous, rien ne change : cet écran ne s\'affiche qu\'à la toute première ouverture de l\'appli.'
  ]
};
