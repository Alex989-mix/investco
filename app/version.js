/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '27.4';
self.APP_RELEASE = {
  date: '2026-11-03',
  notes: [
    'Nouveau guide utilisateur, entièrement redessiné : couverture orange, grandes captures dans un téléphone, chiffres clés en blocs et textes courts.',
    'L\'appli elle-même ne change pas.'
  ]
};
