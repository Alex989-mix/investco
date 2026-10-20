/* Service worker Invest.co — hors-ligne + mises à jour fiables.
   La version vient de version.js : modifier ce fichier suffit pour qu'une mise à jour soit détectée. */
importScripts('version.js');
const CACHE = 'investco-' + self.APP_VERSION;
const ASSETS = [
  './', './index.html', './version.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-180.png',
  './Inter.woff2', './SpaceGrotesk.woff2'
];
// Librairies externes (graphiques, PDF, CSV) : mises en cache pour fonctionner hors ligne
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', e => {
  // En temps normal, pas de skipWaiting automatique : l'utilisateur choisit quand appliquer
  // la mise à jour (barre orange), et l'appli sauvegarde ses données juste avant.
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })));
    // Librairies : au mieux (si le CDN est injoignable, l'appli démarre sans elles)
    await Promise.all(LIBS.map(u => fetch(new Request(u, { mode: 'no-cors' })).then(r => c.put(u, r)).catch(() => {})));
    // Exception : remplacement de l'ancienne v16 (cache « investco-v16 »), qui n'affiche jamais
    // la barre de mise à jour. On active tout de suite ; la page v16 se recharge seule
    // (controllerchange) et la nouvelle version sauvegarde les données avant de les migrer.
    const keys = await caches.keys();
    if (keys.some(k => /^investco-v\d/.test(k))) self.skipWaiting();
  }));
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const fromLegacy = keys.some(k => /^investco-v\d/.test(k));
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    // Remplacement de la v16 : on recharge nous-mêmes chaque fenêtre ouverte
    // (la v16 ne le fait pas toujours), pour qu'aucune ne reste sur l'ancienne version.
    if (fromLegacy) {
      const wins = await self.clients.matchAll({ type: 'window' });
      await Promise.all(wins.map(w => w.navigate(w.url).catch(() => {})));
    }
  })());
});

// Données en direct : jamais mises en cache (cours, sync Drive, fonction Netlify des cours)
const LIVE = ['api.coingecko.com', 'twelvedata.com', 'finance.yahoo.com', 'query1.finance', 'query2.finance',
  'googleapis.com', 'accounts.google.com', 'google.com/gsi', '/.netlify/functions/'];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || LIVE.some(s => req.url.includes(s))) return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // Page et fichier de version : réseau d'abord (une nouvelle version est visible dès l'ouverture),
  // cache en secours hors-ligne.
  const networkFirst = req.mode === 'navigate' || (sameOrigin && /\/(index\.html|version\.js)?$/.test(url.pathname));
  if (networkFirst) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(resp => {
        if (resp && resp.ok && sameOrigin) { const copy = resp.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return resp;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // Polices, icônes, librairies : cache d'abord. Jamais de page HTML renvoyée à la place d'un script.
  const cacheable = sameOrigin || url.hostname === 'cdnjs.cloudflare.com';
  if (!cacheable) return;
  e.respondWith(
    caches.match(req, { ignoreVary: true }).then(cached => cached || fetch(req).then(resp => {
      if (resp && (resp.ok || resp.type === 'opaque')) { const copy = resp.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return resp;
    }))
  );
});
