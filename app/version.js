/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '21.1';
self.APP_RELEASE = {
  date: '2026-10-30',
  notes: [
    'Import du relevé d\'un compte d\'épargne (Livret A, LDDS…) : + Ajouter ▸ Importer un relevé, onglet « Épargne ». Versements, retraits, intérêts et virements avec ton compte courant sont rattachés au bon compte.',
    'Le solde au début du relevé est repris de la colonne Solde (ou à saisir) : l\'historique est aligné sans rien effacer, puis l\'appli compare son solde avec celui du relevé et te propose de corriger un éventuel doublon.',
    'Les intérêts de l\'année de tes livrets sont ensuite recalculés quinzaine par quinzaine sur tes vrais mouvements.',
    'Un virement entre ton compte courant et ton livret n\'est compté qu\'une fois, même si tu importes les deux relevés.'
  ]
};
