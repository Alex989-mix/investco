/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '28.1';
self.APP_RELEASE = {
  date: '2026-11-04',
  notes: [
    'Simulateur de rachat sur la fiche de chaque contrat d\'assurance-vie : part de capital, part de gains, abattement utilisé, impôt, prélèvements sociaux et montant net perçu.',
    'Après 8 ans, l\'appli indique combien vous pouvez retirer cette année sans impôt sur le revenu, compte tenu de l\'abattement déjà utilisé par votre foyer.',
    'Récap fiscal détaillé, rachat par rachat. Vous pouvez saisir sur le rachat la part de gains indiquée par votre assureur pour un calcul exact.',
    'Le geste « retour » (balayage latéral sur Android) ne fait plus quitter l\'appli : il ferme la fenêtre ouverte ou revient à l\'Accueil.'
  ]
};
