/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '27.1';
self.APP_RELEASE = {
  date: '2026-11-03',
  notes: [
    'Guide utilisateur refait autour des modules : un chapitre « Votre appli à la carte », chaque chapitre indique le module qu\'il concerne.',
    'Sommaire « Lire selon votre profil » (Épargnant, Bourse, Immobilier, Tout) et tableau « Vous ne trouvez pas un écran ? ».',
    'L\'appli elle-même ne change pas.'
  ]
};
