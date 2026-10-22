/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '18.0';
self.APP_RELEASE = {
  date: '2026-10-22',
  notes: [
    'Tableau de bord : cash-flow du mois (revenus, dépenses, épargne) et taux d\'épargne, avec l\'historique sur 12 mois.',
    'PEA complet : date d\'ouverture, versements, plafond restant, liquidités, compteur des 5 ans. Nouveau type d\'opération « Dividende » et code ISIN vérifié.',
    'Immobilier complet : résidence principale, location nue ou LMNP, frais de notaire et travaux, vacance locative, taxe foncière, copropriété, PNO, plus-value latente.',
    'Verrouillage de l\'appli par code (et empreinte ou visage si ton téléphone le permet) : Réglages ▸ Sécurité.',
    'Tes biens existants avec un loyer sont passés en « Location nue », les autres en résidence principale : vérifie-les dans Placements ▸ Immobilier.'
  ]
};
