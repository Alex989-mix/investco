/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '21.2';
self.APP_RELEASE = {
  date: '2026-10-30',
  notes: [
    'Verrouillage : le code n\'est plus demandé qu\'à l\'ouverture de l\'appli. Actualiser, installer une mise à jour ou passer par le choix d\'un fichier ne le redemandent plus.',
    'Tu peux le faire redemander après 1, 5 ou 15 minutes passées hors de l\'appli (Réglages ▸ Verrouillage). Par sécurité, il est redemandé si l\'appli reste plus de 4 heures en arrière-plan.'
  ]
};
