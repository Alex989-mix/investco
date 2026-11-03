/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '25.0';
self.APP_RELEASE = {
  date: '2026-11-03',
  notes: [
    'Réglages ▸ Modules : masquez ce que vous ne suivez pas (Crowdfunding, Achat-revente, Budget…) et rajoutez-le en un geste depuis le catalogue.',
    'Rien n\'est supprimé : un module masqué garde ses données, toujours comptées dans votre patrimoine net (ligne « Modules masqués » sur l\'accueil) et dans votre récap fiscal.',
    'Les flèches règlent l\'ordre des onglets de Placements ; les modules prévus (assurance-vie complète, PER, SCPI…) sont annoncés dans le catalogue.'
  ]
};
