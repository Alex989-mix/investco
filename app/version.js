/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '20.0';
self.APP_RELEASE = {
  date: '2026-10-29',
  notes: [
    'Épargne : tableau simplifié (Solde · Taux · Intérêts de l\'année · Intérêts perçus). Le versé net reste dans la fiche du produit.',
    'Portefeuille Bricks : crée-le dans Placements ▸ Immo ▸ Crowdfunding, avec son solde actuel et son taux (2,4 %). Intérêts calculés au jour le jour.',
    'Tes nouveaux projets sont payés depuis le portefeuille ; chaque versement coché y est crédité (net du prélèvement à la source) et le capital y revient au remboursement. Rien n\'est ajouté pour le passé.',
    'Quand un taux change, saisis le nouveau avec sa date : l\'ancien est conservé pour les jours passés.',
    'Livrets : « Versé ce jour : intérêts dès le… » sous chaque livret, et une explication claire des quinzaines.',
    'Les explications sont maintenant derrière les « ? » : touche-les pour les lire, sans perdre ta saisie.'
  ]
};
