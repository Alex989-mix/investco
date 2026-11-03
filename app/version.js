/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '28.0';
self.APP_RELEASE = {
  date: '2026-11-04',
  notes: [
    'Nouveau module Assurance-vie : suivez chaque contrat support par support, fonds en euros et unités de compte, avec un onglet dédié dans Placements.',
    'Votre assurance-vie existante reste un produit d\'épargne simple. Le bouton « Convertir en contrat complet » de sa fiche la transforme sans changer son solde (copie de sécurité faite avant).',
    'Versements, rachats, arbitrages et frais : un arbitrage ne compte ni comme un versement ni comme un gain, des frais réduisent la valeur sans être un retrait.',
    'Cours des unités de compte mis à jour automatiquement quand vous indiquez leur symbole ; sinon, saisissez la valeur relevée sur votre relevé, avec sa date.',
    'Réglages ▸ Ma situation fiscale : choisissez votre foyer (personne seule ou couple) pour l\'abattement de 4 600 € ou 9 200 € sur les rachats après 8 ans.'
  ]
};
