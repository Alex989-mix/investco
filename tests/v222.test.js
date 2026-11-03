// Parcours v22.2 : variation du jour de tout le portefeuille (Accueil, Bourse, enveloppes)
// et retour sur le même écran après une actualisation (glisser vers le bas) ou une mise à jour.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const N = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const near = (a, b, e = 0.011) => Math.abs(a - b) < e;

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-11-03T15:30:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', (d) => d.accept());
  // Cours simulés : CW8 520 € (veille 515 €), Air Liquide 174 € (veille 176 €), BTC 60 000 € (+2 % sur 24 h)
  const Q = { 'CW8.PA': { price: 520, prev: 515 }, 'AI.PA': { price: 174, prev: 176 } };
  await page.route('**/.netlify/functions/quote*', (r) => { const sy = new URL(r.request().url()).searchParams.get('s'), q = Q[sy];
    return q ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ price: q.price, prev: q.prev, cur: 'EUR', sym: sy }) }) : r.fulfill({ status: 404, body: '{}' }); });
  let cgUrl = '';
  await page.route('https://api.coingecko.com/**', (r) => { cgUrl = r.request().url();
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ bitcoin: { eur: 60000, eur_24h_change: 2 } }) }); });
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet();
    const base = structuredClone(DEF);
    DB = Object.assign(base, { savings: [{ name: 'Livret A', type: 'Livret A', bank: 'Banque', cap: 0, open: null, rate: null, rates: [], tax: 'Exonéré', ceil: null },
        { name: 'Compte courant', type: 'Compte courant', bank: 'Banque', cap: 0, open: null, rate: null, rates: [], tax: 'Exonéré', ceil: null }],
      movements: [{ d: '2024-01-02', p: 'Livret A', t: 'Reprise', q: null, pu: null, m: 12000, f: 0, n: '' },
        { d: '2024-03-04', p: 'Amundi MSCI World (CW8)', t: 'Achat', q: 20, pu: 450, m: null, f: 0, n: '' },
        { d: '2025-02-10', p: 'Air Liquide', t: 'Achat', q: 15, pu: 160, m: null, f: 0, n: '' },
        { d: '2025-05-12', p: 'Bitcoin', t: 'Achat', q: 0.05, pu: 50000, m: null, f: 0, n: '' },
        { d: '2025-06-01', p: 'TotalEnergies', t: 'Achat', q: 10, pu: 58, m: null, f: 0, n: '' }],
      assets: [{ name: 'Amundi MSCI World (CW8)', ticker: 'CW8', type: 'ETF', env: 'PEA', price: 500, sellFee: 0, cur: 'EUR', src: 'auto' },
        { name: 'Air Liquide', ticker: 'AI', type: 'Action', env: 'CTO', price: 170, sellFee: 0, cur: 'EUR', src: 'auto' },
        { name: 'TotalEnergies', ticker: 'TTE', type: 'Action', env: 'CTO', price: 60, sellFee: 0, cur: 'EUR', src: 'manuel' },
        { name: 'Bitcoin', ticker: 'BTC-EUR', type: 'Crypto', env: 'Bitstack', price: 58000, sellFee: 0.01, cur: 'EUR', src: 'auto' }],
      crowd: [], expenses: [], recurring: [], properties: [], loans: [], goals: [], resale: [], refPrices: [], pea: { open: '2024-03-01', bank: 'Boursorama', versements: [] } });
    DB.settings = Object.assign({}, base.settings, { onboarded: true, liveCrypto: false, snapshots: {}, refManual: {}, snapFin: {}, crowdAuto: { on: false }, lastBackup: '2026-11-02', lastProc: '2026-11-03', lastSnapMonth: '2026-11' });
    DB.meta = { schema: SCHEMA, updatedAt: 0 }; save(); renderAll(); });

  log('Avant toute actualisation : pas de ligne « Variation du jour » (aucun cours du jour connu)', !N(await page.textContent('#v-dash .hero3')).includes('Variation du jour'));
  await page.evaluate(async () => { await refreshPrices(); closeSheet(); }); await sleep(300);
  log('CoinGecko interrogé avec la variation 24 h (même domaine, aucune nouvelle source réseau)', cgUrl.includes('include_24hr_change=true'), cgUrl);
  // Attendu : CW8 20 × (520 − 515) = +100 € ; Air Liquide 15 × (174 − 176) = −30 € ; BTC 3 000 € à +2 % = +58,82 €
  const btc = 3000 - 3000 / 1.02, exp = 100 - 30 + btc, prevTot = 20 * 515 + 15 * 176 + 3000 / 1.02;
  const D = await page.evaluate(() => dayStats());
  log('Variation du jour du portefeuille = +100 − 30 + 58,82 = +128,82 € (' + (exp / prevTot * 100).toFixed(2).replace('.', ',') + ' %), TotalEnergies (cours manuel) à part', near(D.amount, exp, 0.02) && near(D.pct, Math.round(exp / prevTot * 10000) / 100, 0.011) && D.covered === 3 && D.missing === 1, { D, exp });
  await page.evaluate(() => nav('dash')); await sleep(200);
  const home = N(await page.textContent('#v-dash .hero3'));
  log('Accueil : « Variation du jour +129 € (+0,81 %) sur la bourse et la crypto · 1 ligne sans cours du jour » sous la phrase du 1er janvier', /Variation du jour \?\s?\+129 € \(\+0,81 %\) sur la bourse et la crypto · 1 ligne sans cours du jour/.test(home), home.slice(0, 260));
  await page.evaluate(() => { nav('placements'); setPlace('bourse'); }); await sleep(200);
  const hb = N(await page.textContent('#place-body .hero3'));
  log('Bourse : même variation dans la carte « Bourse et crypto »', /Variation du jour \?\s?\+129 € \(\+0,81 %\)/.test(hb), hb.slice(0, 300));
  const grp = await page.evaluate(() => [...document.querySelectorAll('#place-body .grp')].map((g) => ((s) => String(s).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim())(g.textContent)));
  log('Bourse : variation de chaque enveloppe (PEA +100 €, Compte-titres −30 €, Crypto +59 €)', grp.some((g) => /^PEA · Boursorama.*\+100 € auj\. 10 400 €$/.test(g)) && grp.some((g) => /^Compte-titres.*-30 € auj\./.test(g)) && grp.some((g) => /^Crypto · Bitstack.*\+59 € auj\./.test(g)), grp);
  const lines = await page.evaluate(() => [...document.querySelectorAll('#place-body .fiche')].map((f) => f.textContent.replace(/[  ]/g, ' ')));
  log('Lignes : +0,97 % jour (CW8), -1,14 % jour (Air Liquide), +2 % 24 h (Bitcoin, sans le direct)', lines.some((l) => l.includes('+0,97 % jour')) && lines.some((l) => l.includes('-1,14 % jour')) && lines.some((l) => l.includes('+2 % 24 h')), lines);
  // Flux Kraken en direct : sa variation 24 h prime sur celle de CoinGecko
  await page.evaluate(() => { LIVE.quotes[liveAssetPair(DB.assets[3])] = { px: 60000, chg: -1, t: Date.now() }; });
  const live = await page.evaluate(() => ({ pair: liveAssetPair(DB.assets[3]), d: assetDayPct(DB.assets[3]) }));
  log('Crypto en direct : la variation 24 h du flux Kraken est utilisée', live.d && live.d.pct === -1 && live.d.k === '24 h', live);
  await page.evaluate(() => { delete LIVE.quotes[liveAssetPair(DB.assets[3])]; });
  // Après 6 h sans actualisation, la variation crypto mémorisée n'est plus comptée ; les actions la gardent 4 jours
  await page.clock.setFixedTime(new Date('2026-11-03T22:00:00+01:00'));
  const late = await page.evaluate(() => dayStats());
  log('7 h plus tard sans actualisation : la crypto sort du calcul (+70 € actions/ETF seules)', near(late.amount, 70, 0.02) && late.missing === 2, late);
  await page.clock.setFixedTime(new Date('2026-11-03T15:30:00+01:00'));
  await page.evaluate(() => showHelp('jour')); await sleep(150);
  const help = N(await page.textContent('#hlp'));
  log('Aide « ? » : explication (clôture de la veille, 24 h glissantes, lignes sans cours)', help.includes('clôture de la veille') && help.includes('24 heures glissantes') && help.includes('Actualiser'), help.slice(0, 200));
  await page.evaluate(() => closeHelp ? closeHelp() : document.querySelector('#hlp').classList.remove('on')).catch(() => {});

  // ===== Actualisation : même écran =====
  await page.evaluate(() => { nav('placements'); setPlace('epargne'); }); await sleep(150);
  await page.evaluate(() => { document.body.style.minHeight = '3000px'; window.scrollTo(0, 400); }); await sleep(100);
  await page.reload(); await sleep(900);
  let st = await page.evaluate(() => ({ v: document.querySelector('.view.on').id, p: placeTab, nav: document.querySelector('.nav a.on')?.dataset.v, y: Math.round(scrollY) }));
  log('Glisser pour actualiser sur Placements ▸ Épargne : on reste sur Placements ▸ Épargne', st.v === 'v-placements' && st.p === 'epargne' && st.nav === 'placements', st);
  await page.evaluate(() => nav('budget')); await page.reload(); await sleep(900);
  st = await page.evaluate(() => document.querySelector('.view.on').id);
  log('Actualisation sur Budget : on reste sur Budget', st === 'v-budget', st);
  await page.evaluate(() => nav('analyse')); await page.reload(); await sleep(900);
  st = await page.evaluate(() => ({ v: document.querySelector('.view.on').id, h: !!document.querySelector('#v-analyse .hero3') }));
  log('Actualisation sur Analyse : Analyse réaffichée', st.v === 'v-analyse' && st.h, st);
  await page.evaluate(() => { nav('placements'); setPlace('bourse'); window.scrollTo(0, 0); }); await page.reload(); await sleep(900);
  st = await page.evaluate(() => ({ v: document.querySelector('.view.on').id, p: placeTab, day: document.querySelector('#place-body .hero3').textContent.includes('Variation du jour') }));
  log('Actualisation sur Bourse : Bourse réaffichée, variation du jour conservée (cours mémorisés)', st.v === 'v-placements' && st.p === 'bourse' && st.day, st);
  // Réouverture de l'appli (nouvel onglet = nouvelle session, sessionStorage vide) : on démarre sur l'Accueil
  const p2 = await page.context().newPage(); await p2.goto(page.url()); await sleep(900);
  st = await p2.evaluate(() => document.querySelector('.view.on').id);
  log('Réouverture de l\'appli : démarrage sur l\'Accueil', st === 'v-dash', st);
  log('Valeur mémorisée invalide : ignorée', await p2.evaluate(() => { sessionStorage.setItem('investco_view', '{"v":"<img src=x>","p":"x"}'); const a = viewRead(); sessionStorage.setItem('investco_view', '{"v":"budget","p":"<b>","y":"x"}'); const b = viewRead(); return a === null && b.v === 'budget' && b.p === 'bourse' && b.y === 0; }));
  await p2.close();
  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
