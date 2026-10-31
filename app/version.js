/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '22.0';
self.APP_RELEASE = {
  date: '2026-10-31',
  notes: [
    'Nouveau design : chaque écran s\'ouvre sur une carte qui résume l\'essentiel (total, variation, 3 chiffres clés), suivie de vos comptes en lignes faciles à toucher.',
    'Accueil : « Où est votre argent » répartit votre patrimoine entre immobilier, épargne, bourse et crowdfunding ; touchez une ligne pour ouvrir les placements correspondants.',
    'Épargne regroupée (épargne réglementée, assurance-vie, liquidités), budget « Prévu vs réel » en lignes avec une barre par catégorie, boutons plus grands.',
    'L\'appli vous vouvoie désormais.'
  ]
};
