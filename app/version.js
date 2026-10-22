/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '17.2';
self.APP_RELEASE = {
  date: '2026-10-22',
  notes: [
    'Budget : nouvelle catégorie « Investissement ». Les prélèvements vers Bitstack, Coinbase, Trade Republic, Bricks, Linxea… y sont classés automatiquement, à l\'import comme à la saisie.',
    'Le budget affiche la part investie à part : « dont X € investis · Y € de dépenses courantes ».',
    'Ces versements ne sont plus comptés comme une perte dans le gain de l\'année : l\'argent se retrouve dans l\'actif acheté.',
    'Tes anciens versements vers ces plateformes restés en « Autres » ont été reclassés ; une catégorie choisie à la main est conservée.',
    'Correction : un relevé bancaire qui mentionne Bitstack n\'est plus pris pour un export Bitstack.'
  ]
};
