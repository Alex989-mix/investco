/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '21.0';
self.APP_RELEASE = {
  date: '2026-10-30',
  notes: [
    'Accueil allégé : ton patrimoine expliqué (« +X € depuis le 1er janvier, dont Y € épargnés et Z € de gains »), 3 chiffres (disponible, revenus passifs, montant épargné du mois), 3 alertes au plus. Graphiques et performance dans « Analyse ».',
    'Chiffres fiabilisés : valeur au 1er janvier reconstituée automatiquement, argent déjà détenu compté comme « reprise » (ni épargne ni gain), performance calculée sur les placements financiers seulement.',
    'Crypto : plus-values calculées selon la règle fiscale (sur l\'ensemble du portefeuille, formulaire 2086), exonération si tes ventes de l\'année ne dépassent pas 305 €.',
    'Placements en fiches lisibles sur téléphone, regroupées par enveloppe ; touche une ligne pour son détail et ses seuils de revente. Nouvel onglet Crowdfunding.',
    'Bricks : versements reçus automatiquement (option), montant d\'un mois modifiable, remboursement anticipé partiel ou total, « Tout pointer » en un geste.',
    'Tes « Solde à l\'ouverture » ont été convertis en reprises d\'existant. Pense à toucher ↻ pour récupérer les cours de fin d\'année.'
  ]
};
