/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '22.2';
self.APP_RELEASE = {
  date: '2026-11-03',
  notes: [
    'Accueil et Bourse : la variation du jour de tout votre portefeuille, en euros et en pourcentage, et celle de chaque enveloppe.',
    'Crypto : la variation sur 24 heures est aussi récupérée par « Actualiser » quand le direct n\'est pas disponible.',
    'Glisser vers le bas pour actualiser vous laisse sur l\'écran où vous étiez.'
  ]
};
