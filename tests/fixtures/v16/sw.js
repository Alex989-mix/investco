/* Service worker — installable, hors-ligne, avec mise à jour contrôlée */
const CACHE = 'investco-v16';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-180.png',
  './Inter.woff2', './SpaceGrotesk.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.url.includes('api.coingecko.com') || req.url.includes('twelvedata.com')
      || req.url.includes('finance.yahoo.com') || req.url.includes('query1.finance')
      || req.url.includes('query2.finance')
      || req.url.includes('googleapis.com') || req.url.includes('accounts.google.com')
      || req.url.includes('google.com/gsi')) return;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      if (resp && resp.ok && req.url.startsWith(self.location.origin)) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return resp;
    }).catch(() => caches.match('./index.html')))
  );
});
