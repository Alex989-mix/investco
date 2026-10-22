/* Version de l'appli Invest.co.
   C'est le SEUL endroit à modifier à chaque nouvelle version : le service worker (sw.js)
   et l'appli (index.html) lisent tous les deux ce fichier. Changer APP_VERSION suffit
   pour que chaque appareil détecte la mise à jour et propose de l'installer. */
self.APP_VERSION = '19.1';
self.APP_RELEASE = {
  date: '2026-10-22',
  notes: [
    'Actions et ETF : la variation du jour (par rapport à la clôture de la veille) s\'affiche sous chaque ligne après ↻, comme la variation 24 h des cryptos.',
    'Si la clôture de la veille n\'est pas fournie, rien n\'est affiché plutôt qu\'un chiffre faux ; une variation de plus de 4 jours est masquée.'
  ]
};
