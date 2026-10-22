/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '19.0';
self.APP_RELEASE = {
  date: '2026-10-22',
  notes: [
    'Crypto en direct : tant que l\'appli est ouverte, le cours de tes cryptos se met à jour en continu (flux public Kraken), avec la variation sur 24 h. Badge « ● direct » dans Placements.',
    'Seuls les noms des paires (ex. BTC/EUR) sont envoyés à Kraken : aucun montant, aucune donnée perso. La connexion se coupe dès que l\'appli passe en arrière-plan.',
    'Sécurité renforcée : l\'appli ne peut plus contacter que ses sources de cours, ses librairies et Google Drive. Tout autre envoi est bloqué par le navigateur.',
    'Actions et ETF : inchangé (Yahoo via ↻). Le direct se désactive dans Réglages ▸ Avancé.'
  ]
};
