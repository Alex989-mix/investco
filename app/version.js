/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '17.1';
self.APP_RELEASE = {
  date: '2026-10-22',
  notes: [
    'Import de relevés : tous les CSV bancaires sont reconnus automatiquement (Crédit Agricole, Société Générale, BNP, Boursorama, La Banque Postale, Caisse d\'Épargne, Fortuneo, LCL, Revolut, N26, Qonto…) : encodage, lignes d\'en-tête, séparateur, colonnes Débit / Crédit, Sens ou Montant signé, formats de dates et de montants.',
    'Les débits écrits en négatif dans une colonne « Débit » restent bien des dépenses ; les opérations refusées et les soldes sont ignorés.',
    'Nouveau : import de l\'export CSV Bitstack (et autres plateformes crypto) : achats récurrents, arrondis, parrainages (coût nul), ventes ; retraits ignorés ; doublons ignorés. L\'actif Bitcoin est créé si besoin.',
    'Chaque colonne détectée peut être corrigée à la main, avec aperçu immédiat avant l\'import.',
    'Rappel 17.0 : immobilier et crédits, budget prévu / réel, objectifs, alertes, paramètres réglementaires datés.'
  ]
};
