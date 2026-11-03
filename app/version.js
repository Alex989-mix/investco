/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '27.3';
self.APP_RELEASE = {
  date: '2026-11-03',
  notes: [
    'Guide utilisateur plus visuel et plus court : sommaire en cartes, modules en tuiles illustrées, ouvertures de chapitre repensées.',
    'Textes allégés (Bourse, Accueil et Analyse) et chiffres clés présentés en cartes.',
    'L\'appli elle-même ne change pas.'
  ]
};
