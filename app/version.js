/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '16.2';
self.APP_RELEASE = {
  date: '2026-10-21',
  notes: [
    'Épargne : le solde de chaque compte est désormais calculé à partir de ses opérations. Supprimer toutes les opérations d\'un livret le ramène à 0 € (avant : -480 €).',
    'Épargne : modifier le « Solde actuel » d\'un produit enregistre l\'écart comme une opération « Ajustement » datée, visible et supprimable. Nouveaux types d\'opération : Intérêts et Ajustement.',
    'Épargne : les écarts hérités des anciennes versions ont été repris en opérations « Ajustement » (note « Reprise du solde v16 »), tes soldes ne changent pas. Un solde négatif impossible sur un livret a été corrigé.',
    'Bricks : l\'échéancier complet s\'affiche dès la création du projet ; les versements à venir sont en pointillés.',
    'Bricks : nouveau raccourci « Projet Bricks » dans le bouton Ajouter.',
    'Renommer un produit ou un actif conserve ses opérations.',
    'Rappel 16.1 : saisie « 37,50 » à la française, calendrier Bricks corrigé, PRU du PEA, intérêts des livrets par quinzaine.'
  ]
};
