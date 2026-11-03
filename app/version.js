/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '28.2';
self.APP_RELEASE = {
  date: '2026-11-04',
  notes: [
    'Importez le relevé de votre assureur sur un contrat d\'assurance-vie : historique des opérations ou situation du contrat, en CSV ou en PDF (Placements ▸ Assurance-vie ▸ Relevé).',
    'Chaque ligne est rattachée au bon support ; les deux lignes d\'un arbitrage deviennent un seul arbitrage, les prélèvements sociaux des frais, et un relevé déjà importé est reconnu.',
    'Relevé de situation : la valeur de chaque unité de compte est enregistrée à sa date, un écart du fonds en euros devient un ajustement daté, un support inconnu est créé comme argent déjà détenu.',
    'Le guide utilisateur explique l\'import des relevés d\'assurance-vie. Le bouton des cours de l\'onglet Assurance-vie s\'appelle désormais « Cours ».'
  ]
};
