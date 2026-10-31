// Parcours v22.1 : Analyse, Achat-revente, Réglages et fenêtres au nouveau design, plus aucun emoji.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const N = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Emojis pictographiques (les glyphes typographiques ✎ ✓ ✕ ⚠ restent autorisés)
const EMO = /[\u{1F300}-\u{1FAFF}\u{2705}\u{270B}\u{26A1}\u{FE0F}]/u;

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-10-30T12:00:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', (d) => d.accept());
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); DB.settings.onboarded = true;
    DB.resale = [{ name: 'iPhone 12', plat: 'Leboncoin', buyD: '2026-08-02', buy: 288, sellD: '2026-09-10', sell: 410, st: 'Vendu' },
      { name: 'Lampe', plat: 'Vinted', buyD: '2026-10-10', buy: 35, st: 'En vente' }];
    save(); renderAll(); });
  await sleep(200);

  // ===== 1. Analyse =====
  await page.evaluate(() => nav('analyse')); await sleep(300);
  const an = await page.evaluate(() => ({ hero: document.querySelector('#v-analyse .hero3 .h-l')?.textContent || '', stats: [...document.querySelectorAll('#v-analyse .hero3 .h-st .l')].map((x) => x.textContent),
    grp: [...document.querySelectorAll('#v-analyse .grp > span:first-child')].map((x) => x.textContent.replace(/\?/g, '').trim()), fiche: !!document.querySelector('#v-analyse .lgrp .fiche .ricon svg') }));
  log('Analyse : carte hero « Gains 2026 » avec Au 1er janvier, Épargne versée, Aujourd\'hui', an.hero.includes('Gains 2026') && ['Au 1er janvier', 'Épargne versée', 'Aujourd\'hui'].every((x) => an.stats.includes(x)), an);
  log('Analyse : titres de section (Évolution, Répartition, Performance, Cash-flow, Fiscalité)', ['Évolution du patrimoine', 'Répartition', 'Performance des placements', 'Fiscalité'].every((x) => an.grp.includes(x)) && an.grp.some((x) => /^Cash-flow d.octobre$/.test(x)), an.grp);
  log('Analyse : « Récap fiscal » en ligne avec icône', an.fiche);
  await page.locator('#v-analyse .seg2 button', { hasText: 'Nette de crédits' }).click(); await sleep(200);
  log('Analyse : sélecteur Brute / Nette de crédits', await page.evaluate(() => repNet === true && document.querySelector('#v-analyse .seg2 button.on').textContent === 'Nette de crédits'));
  await page.evaluate(() => { repNet = false; taxRecap(); }); await sleep(150);
  const tx = N(await page.textContent('#sheet'));
  log('Récap fiscal : taux à la française (virgule) et bouton PDF avec icône', !/\d\.\d%/.test(tx) && await page.evaluate(() => !!document.querySelector('#sheet .btn.wide svg')), tx.slice(0, 200));
  await page.evaluate(() => closeSheet());

  // ===== 2. Achat-revente =====
  await page.evaluate(() => { revYear = 2026; nav('revente'); }); await sleep(200);
  const rv = await page.evaluate(() => ({ hero: ((s)=>String(s||'').replace(/[\u00a0\u202f]/g,' ').replace(/\s+/g,' '))(document.querySelector('#v-revente .hero3')?.textContent), rows: [...document.querySelectorAll('#v-revente .rows .rw')].length, table: !!document.querySelector('#v-revente table'), sel: !!document.querySelector('#v-revente .hero3 select') }));
  log('Revente : carte hero (marge nette +122,00 €, CA, stock, imposable) avec choix de l\'année', /Marge nette 2026/.test(rv.hero) && rv.hero.includes('+122,00 €') && ['Chiffre d\'affaires', 'Stock immobilisé', 'Imposable 2026'].every((x) => rv.hero.includes(x)) && rv.sel, rv);
  log('Revente : articles en lignes, sans tableau', rv.rows >= 3 && !rv.table, rv);
  await page.locator('#v-revente .rw', { hasText: 'Lampe' }).click(); await sleep(200);
  log('Revente : toucher un article ouvre sa fiche', await page.evaluate(() => document.querySelector('#ov').classList.contains('on') && /Lampe/.test(document.querySelector('#sheet').innerHTML)));
  await page.evaluate(() => closeSheet());

  // ===== 3. Ajouter, Réglages, Import =====
  await page.evaluate(() => quickAdd()); await sleep(150);
  const qa = await page.evaluate(() => [...document.querySelectorAll('#sheet .qadd .rw')].map((b) => ({ t: b.querySelector('.n').textContent, h: b.getBoundingClientRect().height, ic: !!b.querySelector('.ricon svg') })));
  log('Ajouter : 8 lignes avec icône, hauteur ≥ 44 px', qa.length === 8 && qa.every((x) => x.ic && x.h >= 44), qa);
  await page.locator('#sheet .rw', { hasText: 'Crédit' }).click(); await sleep(150);
  log('Ajouter ▸ Crédit ouvre le formulaire de crédit', N(await page.textContent('#sheet')).includes('Capital emprunté'), N(await page.textContent('#sheet')).slice(0, 120));
  await page.evaluate(() => { closeSheet(); openSettings(); }); await sleep(150);
  const st = await page.evaluate(() => ({ h: [...document.querySelectorAll('#sheet .sh-h')].map((x) => x.textContent.replace(/\?/g, '').trim()),
    small: [...document.querySelectorAll('#sheet button')].filter((b) => b.offsetParent && !b.classList.contains('hq') && b.getBoundingClientRect().height < 40).map((b) => b.textContent.trim()) }));
  log('Réglages : sections avec icône (Synchronisation, Situation fiscale, Verrouillage)', ['Synchronisation Google Drive', 'Ma situation fiscale', 'Verrouillage'].every((x) => st.h.includes(x)), st.h);
  log('Réglages : tous les boutons (hors aides « ? ») font au moins 40 px de haut', st.small.length === 0, st.small);

  // ===== 4. Plus aucun emoji =====
  const texts = await page.evaluate(() => { const T = []; closeSheet();
    for (const v of ['dash', 'placements', 'budget', 'revente', 'analyse']) { nav(v); if (v === 'placements') for (const t of ['bourse', 'epargne', 'immo', 'crowd']) { setPlace(t); T.push([t, document.querySelector('#v-placements').innerHTML]); } else T.push([v, document.querySelector('#v-' + v).innerHTML]); }
    for (const [k, f] of [['réglages', openSettings], ['ajouter', quickAdd], ['récap', taxRecap], ['import', openImport], ['guide', openGuide], ['cours', () => { showHelp('prices'); return 'hlp'; }], ['verrou', () => lockSetup(false)]]) { try { const r = f(); T.push([k, document.querySelector(r === 'hlp' ? '#hlp' : '#sheet').innerHTML]); } catch (e) { T.push([k, 'ERR ' + e.message]); } closeSheet(); }
    for (const t of ['bank', 'saving', 'ops']) { openImport(); setImpMode(t); T.push(['import ' + t, document.querySelector('#sheet').innerHTML]); closeSheet(); }
    T.push(['verrouillage', document.querySelector('#lock')?.innerHTML || '']); document.querySelector('#hlp').classList.remove('on');
    return T; });
  const emo = texts.map(([k, t]) => { const m = t.match(EMO); return m ? k + ' : « ' + t.slice(Math.max(0, m.index - 30), m.index + 10) + ' »' : (t.startsWith('ERR') ? k + ' ' + t : null); }).filter(Boolean);
  log(`Plus aucun emoji sur ${texts.length} écrans et fenêtres (icônes au trait à la place)`, emo.length === 0, emo.slice(0, 5));

  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
