// Parcours v21 (téléphone 390 px, date figée au 30/10/2026) :
// fiabilité (reprise d'existant, valeur au 1er janvier reconstituée, apports, performance, plus-values crypto),
// accueil court + Analyse, fiches Bourse / Épargne, Bricks (versements automatiques, montant modifié, remboursements anticipés).
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const typeIn = async (page, sel, txt) => { await page.fill(sel, ''); await page.locator(sel).pressSequentially(txt); };
const N = (s) => String(s || '').replace(/[  ]/g, ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const near = (a, b, e = 0.011) => Math.abs(a - b) < e;

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-10-30T12:00:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', (d) => d.accept());
  // Cours Yahoo simulés : clôture au 31/12/2025 (paramètre d) et cours du jour
  const Q = { 'CW8.PA': { now: 120, ref: 110 }, 'BTC-EUR': { now: 60000, ref: 80000 } };
  await page.route('**/.netlify/functions/quote*', (r) => { const u = new URL(r.request().url()), sy = u.searchParams.get('s'), d = u.searchParams.get('d'), q = Q[sy];
    if (!q) return r.fulfill({ status: 404, body: '{}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d ? { price: q.ref, cur: 'EUR', sym: sy } : { price: q.now, prev: q.now, cur: 'EUR', sym: sy }) }); });
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); DB.settings.onboarded = true; save(); });
  const btn = (txt) => page.locator('#sheet button', { hasText: txt }).first().click().then(() => sleep(200));
  const setDB = (o) => page.evaluate((o) => { const base = structuredClone(DEF); DB = Object.assign(base, { movements: [], assets: [], savings: [], crowd: [], expenses: [], recurring: [], properties: [], loans: [], goals: [], resale: [], refPrices: [], pea: { open: null, bank: '', versements: [] } }, o);
    DB.settings = Object.assign({}, base.settings, { onboarded: true, snapshots: {}, refManual: {}, snapFin: {}, crowdAuto: { on: false }, lastBackup: '2026-10-29', lastProc: '2026-10-30', lastSnapMonth: '2026-10' }, o.settings || {});
    DB.meta = { schema: SCHEMA, updatedAt: 0 }; save(); renderAll(); }, o);

  // ===== 0. Migration d'une base v20 =====
  const mig = await page.evaluate(() => {
    const old = JSON.parse(JSON.stringify(Fin.serialize(DB))); old.meta.schema = 7;
    old.movements.push({ d: '2024-01-01', p: 'LDDS', t: 'Dépôt', q: null, pu: null, m: 100000, f: 0, n: "Solde à l'ouverture" });
    old.settings.snapshots = { 2026: 4800000 }; delete old.settings.refManual; old.crowd.forEach((c) => { delete c.reps; delete c.recv; delete c.hold; });
    localStorage.setItem('investco_v1', JSON.stringify(old)); load(); renderAll();
    const r = DB.movements.find((m) => m.n === "Solde à l'ouverture" && m.p === 'LDDS');
    return { schema: DB.meta.schema, t: r && r.t, crowd: DB.crowd.every((c) => Array.isArray(c.reps) && Array.isArray(c.recv) && Array.isArray(c.hold)), auto: DB.settings.crowdAuto, manual: consolidate().ref.manual };
  });
  log('Migration : « Solde à l\'ouverture » → Reprise d\'existant ; échéanciers enrichis ; ancienne valeur au 1er janvier saisie non réutilisée ; versements auto désactivés',
    mig.schema === 8 && mig.t === 'Reprise' && mig.crowd && mig.auto && mig.auto.on === false && mig.manual === false, mig);
  await sleep(1500); await page.evaluate(() => closeSheet());

  // ===== 1. Valeur au 1er janvier reconstituée et gain de l'année =====
  await setDB({
    savings: [{ name: 'Livret A', type: 'Livret A', bank: 'Banque', cap: 0, open: '2020-01-01', rate: null, rates: [], tax: 'Exonéré', ceil: null },
      { name: 'Compte courant', type: 'Compte courant', bank: 'Banque', cap: 0, open: null, rate: null, rates: [], tax: 'Exonéré', ceil: null }],
    movements: [{ d: '2020-01-01', p: 'Livret A', t: 'Reprise', q: null, pu: null, m: 10000, f: 0, n: "Solde à l'ouverture" },
      { d: '2025-12-31', p: 'Livret A', t: 'Intérêts', q: null, pu: null, m: 170, f: 0, n: '' },
      { d: '2026-03-01', p: 'Livret A', t: 'Dépôt', q: null, pu: null, m: 1000, f: 0, n: '' },
      { d: '2026-06-30', p: 'Livret A', t: 'Intérêts', q: null, pu: null, m: 30, f: 0, n: '' },
      { d: '2024-05-02', p: 'Amundi MSCI World (CW8)', t: 'Achat', q: 10, pu: 100, m: null, f: 0, n: '' }],
    assets: [{ name: 'Amundi MSCI World (CW8)', ticker: 'CW8', type: 'ETF', env: 'PEA', price: 120, sellFee: 0, cur: 'EUR', src: 'auto' }],
    crowd: [{ id: 'c1', name: 'Résidence Montpellier', plat: 'Bricks', amt: 500, rate: 0.1, sub: '2025-09-08', dur: 24, day: 8, st: 'En cours', paid: [], reps: [], recv: [], hold: [], wallet: '' }],
    properties: [{ id: 'p1', name: 'Studio', type: 'Appartement', regime: 'nu', price: 150000, notary: 0, works: 0, buyD: '2022-06-01', rent: 0, vacancy: 0, mgmt: 0, charges: 0, copro: 0, taxFonciere: 0, pno: 0, maintenance: 0, values: [{ d: '2025-06-01', v: 160000 }] }],
  });
  let R = await page.evaluate(() => yearRef(2026));
  log('Sans cours de fin d\'année : ETF au prix de revient (1 000 €), signalé « estimation »', R.approx.includes('Amundi MSCI World (CW8)') && near(R.auto, 10170 + 1000 + 500 + 160000), R);
  await page.evaluate(async () => { await refreshPrices(); }); await sleep(300);
  R = await page.evaluate(() => yearRef(2026));
  log('↻ Cours : clôture du 31/12/2025 récupérée (110 €) → 1er janvier = 10 170 + 1 100 + 500 + 160 000 = 171 770 €', near(R.auto, 171770) && R.approx.length === 0, R);
  let C = await page.evaluate(() => { const c = consolidate(); return { net: c.net, apports: c.apports, gain: c.yearGain }; });
  log('Gain de l\'année = 30 € d\'intérêts + 100 € de hausse de l\'ETF = 130 € ; apports = le dépôt de 1 000 €', near(C.gain, 130) && near(C.apports, 1000) && near(C.net, 171770 + 1000 + 130), C);
  await page.evaluate(() => nav('dash'));
  let home = N(await page.textContent('#v-dash'));
  log('Accueil : « +1 130 € depuis le 1er janvier » et « dont 1 000 € épargnés et +130 € de gains »', home.includes('+1 130 € depuis le 1er janvier') && home.includes('dont 1 000 € épargnés et +130 € de gains'), home.slice(0, 260));
  // Un compte déjà détenu, ajouté aujourd'hui : ni épargne ni gain
  await page.evaluate(() => editSaving(-1)); await page.fill('#s_name', 'LDDS'); await page.selectOption('#s_type', 'LDDS'); await typeIn(page, '#s_cap', '5 000');
  log('Nouveau compte avec un solde : case « Argent déjà détenu » cochée par défaut', await page.evaluate(() => $('#s_held').checked));
  await btn('Enregistrer');
  C = await page.evaluate(() => { const c = consolidate(); return { gain: c.yearGain, apports: c.apports, ref: c.ref.value, t: DB.movements.find((m) => m.p === 'LDDS').t }; });
  log('LDDS de 5 000 € déjà détenu : reprise ; compté au 1er janvier, gain (130 €) et apports (1 000 €) inchangés', C.t === 'Reprise' && near(C.gain, 130) && near(C.apports, 1000) && near(C.ref, 176770), C);
  // Achat d'un bien cette année à crédit : seuls les frais (8 000 €) sont une perte
  const g0 = C.gain;
  await page.evaluate(() => { DB.properties.push({ id: 'p2', name: 'T2', type: 'Appartement', regime: 'nu', price: 100000, notary: 8000, works: 0, buyD: '2026-05-01', rent: 0, vacancy: 0, mgmt: 0, charges: 0, copro: 0, taxFonciere: 0, pno: 0, maintenance: 0, values: [] });
    DB.loans.push({ id: 'l2', name: 'Crédit T2', capital: 90000, rate: 0.035, months: 240, start: '2026-05-01', insurance: 0, propertyId: 'p2' }); save(); renderAll(); });
  C = await page.evaluate(() => { const c = consolidate(); return { gain: c.yearGain, apports: c.apports }; });
  log('Bien acheté en mai (108 000 € dont 90 000 € empruntés) : apport 18 000 € + capital remboursé ; gain −8 000 € (frais de notaire)', near(C.gain, g0 - 8000, 0.05) && C.apports > 1000 + 18000, { g0, C });
  await page.evaluate(() => { DB.properties = DB.properties.filter((p) => p.id !== 'p2'); DB.loans = []; save(); renderAll(); });
  // Valeur imposée à la main
  await page.evaluate(() => { openSettings(); document.querySelector('#sheet details').open = true; }); await typeIn(page, '#set_snap', '170 000'); await btn('Enregistrer');
  log('Valeur au 1er janvier imposée dans Réglages ▸ Avancé (170 000 €), puis retour au calcul automatique', await page.evaluate(() => consolidate().ref.value === 170000 && consolidate().ref.manual));
  await page.evaluate(() => { openSettings(); document.querySelector('#sheet details').open = true; }); await page.fill('#set_snap', ''); await btn('Enregistrer');
  log('… champ vidé : calcul automatique', await page.evaluate(() => !consolidate().ref.manual && Math.abs(consolidate().ref.value - 176770) < 0.01));

  // ===== 2. Performance : placements financiers, recul minimal =====
  const P = await page.evaluate(() => { const p = perfStats(); return { val: p.val, irr: p.irr, twr: p.twr, fin: finValue() }; });
  log('Performance hors immobilier et compte courant : valeur financière = 11 200 + 5 000 + 1 200 + 500 = 17 900 €', near(P.fin, 17900) && near(P.val, 17900), P);
  log('Pas de relevés mensuels : performance TWR « pas encore assez de relevés »', P.twr === null && N(await page.evaluate(() => { nav('analyse'); return document.querySelector('#v-analyse').textContent; })).includes('pas encore assez de relevés mensuels'));
  await page.evaluate(() => { DB.movements = DB.movements.filter((m) => m.p === 'Amundi MSCI World (CW8)' || m.p === 'LDDS'); DB.movements.forEach((m) => { if (m.p === 'Amundi MSCI World (CW8)') m.d = '2026-09-15'; }); DB.crowd = []; save(); });
  log('Premier flux il y a moins de 3 mois : rendement « pas encore assez de recul »', await page.evaluate(() => perfStats().irr === null) && N(await page.evaluate(() => { renderAnalyse(); return document.querySelector('#v-analyse').textContent; })).includes('pas encore assez de recul (3 mois)'));

  // ===== 3. Plus-values crypto (150 VH bis) =====
  await setDB({
    savings: [{ name: 'Compte courant', type: 'Compte courant', bank: 'Banque', cap: 0, open: null, rate: null, rates: [], tax: 'Exonéré', ceil: null }],
    assets: [{ name: 'Bitcoin', ticker: 'BTC-EUR', type: 'Crypto', env: 'Bitstack', price: 60000, sellFee: 0.01, cur: 'EUR', src: 'manuel' }, { name: 'Ethereum', ticker: 'ETH-EUR', type: 'Crypto', env: 'Bitstack', price: 3000, sellFee: 0.01, cur: 'EUR', src: 'manuel' }],
    movements: [{ d: '2025-03-01', p: 'Bitcoin', t: 'Achat', q: 0.02, pu: 50000, m: null, f: 0, n: '' }, { d: '2026-02-01', p: 'Ethereum', t: 'Achat', q: 0.2, pu: 2500, m: null, f: 0, n: '' }],
  });
  await page.evaluate(() => addOpFor('Bitcoin', 'Vente'));
  log('Vente de crypto : champ « Valeur totale de tes cryptos » affiché', await page.evaluate(() => $('#w_vg').style.display !== 'none'));
  await typeIn(page, '#f_q', '0,01'); await typeIn(page, '#f_pu', '60 000'); await typeIn(page, '#f_f', '6'); await typeIn(page, '#f_vg', '2 000'); await btn('Enregistrer');
  let F = await page.evaluate(() => { const f = fiscalData(); return { cx: f.cx, pv: f.pvCrypto }; });
  // PTA = 1 000 + 500 = 1 500 ; cession 600 € ; VG saisie 2 000 € → fraction 450 € ; PV = 600 − 6 − 450 = 144 €
  log('Plus-value crypto officielle : 600 − 6 − 1 500 × 600 / 2 000 = 144 € (et non le calcul au prix de revient du seul bitcoin)', F.cx.lines.length === 1 && near(F.cx.lines[0].pv, 144) && near(F.pv, 144), F);
  const rec = N(await page.evaluate(() => { taxRecap(); return document.querySelector('#sheet').textContent; }));
  log('Récap fiscal : ventes et plus-value crypto imposable (formulaire 2086)', rec.includes('600 € de ventes') && rec.includes('144 € de plus-value imposable') && rec.includes('2086'), rec.slice(rec.indexOf('Crypto'), rec.indexOf('Crypto') + 200));
  await page.evaluate(() => { closeSheet(); const m = DB.movements.find((x) => x.t === 'Vente'); m.q = 0.004; m.vg = null; delete m.vg; save(); });
  F = await page.evaluate(() => { const f = fiscalData(); return { cx: f.cx, pv: f.pvCrypto }; });
  log('Ventes de l\'année ≤ 305 € (240 €) : plus-value non imposable ; valeur globale estimée automatiquement (0,02 × 60 000 + 0,2 × 3 000 = 1 800 €)', F.cx.exempt && F.pv === 0 && near(F.cx.lines[0].vg, 1800), F);

  // ===== 4. Fiches Bourse et Épargne =====
  await setDB({
    savings: [{ name: 'Livret A', type: 'Livret A', bank: 'Ma banque', cap: 0, open: '2015-06-01', rate: null, rates: [], tax: 'Exonéré', ceil: null }, { name: 'Compte courant', type: 'Compte courant', bank: 'Banque', cap: 0, open: null, rate: null, rates: [], tax: 'Exonéré', ceil: null }],
    assets: [{ name: 'Bitcoin', ticker: 'BTC-EUR', type: 'Crypto', env: 'Bitstack', price: 61234, sellFee: 0.01, cur: 'EUR', src: 'manuel' }, { name: 'Apple', ticker: 'AAPL', type: 'Action', env: 'CTO', price: 135, sellFee: 0.005, cur: 'USD', src: 'manuel' }, { name: 'Amundi MSCI World (CW8)', ticker: 'CW8', type: 'ETF', env: 'PEA', price: 440, sellFee: 0.005, cur: 'EUR', src: 'manuel' }],
    movements: [{ d: '2015-06-01', p: 'Livret A', t: 'Reprise', q: null, pu: null, m: 14520, f: 0, n: '' }, { d: '2024-01-10', p: 'Amundi MSCI World (CW8)', t: 'Achat', q: 5, pu: 400, m: null, f: 0, n: '' }, { d: '2024-02-10', p: 'Apple', t: 'Achat', q: 10, pu: 150, m: null, f: 1, n: '' }, { d: '2025-02-10', p: 'Bitcoin', t: 'Achat', q: 0.021, pu: 48285.71, m: null, f: 0, n: '' }],
  });
  await page.evaluate(() => { nav('placements'); setPlace('bourse'); });
  const grp = await page.evaluate(() => [...document.querySelectorAll('#place-body .grp')].map((g) => g.textContent.replace(/[  ]/g, ' ').replace('?', '').trim()));
  log('Bourse : groupes PEA, Compte-titres, Crypto · Bitstack avec leur sous-total', grp.length === 3 && /^PEA/.test(grp[0]) && grp[0].includes('2 200 €') && /^Compte-titres/.test(grp[1]) && grp[1].includes('1 350 €') && /^Crypto · Bitstack/.test(grp[2]), grp);
  const fBtc = N(await page.locator('#place-body .fiche', { hasText: 'Bitcoin' }).textContent());
  log('Fiche Bitcoin : valeur 1 286 €, gain +272 € · +26,8 %', fBtc.includes('1 286 €') && fBtc.includes('+272 €') && fBtc.includes('+26,8 %'), fBtc);
  log('Plus de tableau à faire défiler ni de « Seuils de revente » sur la page', !(await page.evaluate(() => !!document.querySelector('#place-body table'))) && !N(await page.textContent('#place-body')).includes('Seuils de revente'));
  await page.locator('#place-body .fiche', { hasText: 'Bitcoin' }).click(); await sleep(200);
  const det = N(await page.textContent('#sheet'));
  log('Détail d\'une ligne : quantité, cours, prix de revient, seuils de revente, + Achat / + Vente, opérations', det.includes('Quantité') && det.includes('Prix de revient') && det.includes('Seuils de revente') && det.includes('Point mort') && det.includes('+ Achat') && det.includes('+ Vente') && det.includes('Opérations'), det.slice(0, 300));
  await page.evaluate(() => { closeSheet(); setPlace('epargne'); });
  const fLa = N(await page.locator('#place-body .fiche', { hasText: 'Livret A' }).textContent());
  log('Épargne : fiche Livret A (14 520 €, 1,7 %, intérêts 2026, versé ce jour : intérêts dès le 1 nov.)', fLa.includes('14 520 €') && fLa.includes('1,7 %') && fLa.includes('Intérêts 2026') && fLa.includes('intérêts dès le 1 nov.'), fLa);
  log('Placements : 4 onglets (Bourse, Épargne, Immobilier, Crowdfunding)', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.subtab')].map((x) => x.textContent.trim()))) === JSON.stringify(['Bourse', 'Épargne', 'Immobilier', 'Crowdfunding']));

  // ===== 5. Bricks : versements automatiques, mois modifié, remboursements anticipés =====
  await setDB({
    savings: [{ name: 'Portefeuille Bricks', type: 'Portefeuille plateforme', bank: 'Bricks', cap: 0, open: '2026-01-10', rate: 0.024, rates: [{ from: '2026-01-10', rate: 0.024 }], tax: 'PFU standard', ceil: null },
      { name: 'Compte courant', type: 'Compte courant', bank: 'Banque', cap: 0, open: null, rate: null, rates: [], tax: 'Exonéré', ceil: null }],
    movements: [{ d: '2026-01-10', p: 'Portefeuille Bricks', t: 'Reprise', q: null, pu: null, m: 640, f: 0, n: "Solde à l'ouverture" }],
    crowd: [{ id: 'm', name: 'Résidence Montpellier', plat: 'Bricks', amt: 500, rate: 0.1, sub: '2025-09-08', dur: 24, day: 8, st: 'En cours', paid: [], reps: [], recv: [], hold: [], wallet: 'Portefeuille Bricks' },
      { id: 't', name: 'Local Toulouse', plat: 'Bricks', amt: 300, rate: 0.11, sub: '2026-02-08', dur: 36, day: 8, st: 'Retard', paid: [], reps: [], recv: [], hold: [], wallet: 'Portefeuille Bricks' },
      { id: 'l', name: 'Lyon terminé', plat: 'Bricks', amt: 200, rate: 0.09, sub: '2024-09-08', dur: 24, day: 8, st: 'En cours', paid: [], reps: [], recv: [], hold: [], wallet: 'Portefeuille Bricks' }],
  });
  const W = () => page.evaluate(() => { const w = DB.savings.find((s) => s.type === 'Portefeuille plateforme'); return { cap: w.cap, ops: DB.movements.filter((m) => m.p === w.name && m.link).map((m) => [m.t, m.m, m.link, m.d]) }; });
  await page.evaluate(() => nav('dash'));
  home = N(await page.textContent('#v-dash'));
  log('Alertes regroupées : « 13 versements Bricks à pointer · Tout pointer », « Local Toulouse en retard », « Capital à récupérer »', home.includes('versements Bricks à pointer') && home.includes('Tout pointer') && home.includes('« Local Toulouse » en retard : 8 versements à pointer') && home.includes('Capital à récupérer : « Lyon terminé »'), home.slice(home.indexOf('À surveiller'), home.indexOf('À surveiller') + 400));
  await page.evaluate(() => { nav('placements'); setPlace('crowd'); });
  const cf = N(await page.textContent('#place-body'));
  log('Crowdfunding : fiches compactes (« 13/24 versements », « 8 à pointer », « capital à récupérer »), interrupteur des versements automatiques', cf.includes('13/24 versements') && cf.includes('8 à pointer') && cf.includes('capital à récupérer') && cf.includes('Versements reçus automatiquement') && !(await page.evaluate(() => !!document.querySelector('#place-body .chk'))), cf.slice(0, 500));
  const cap0 = (await W()).cap;
  await page.locator('#place-body label.switch').click(); await sleep(300);
  let w = await W();
  const st = await page.evaluate(() => DB.crowd.map((c) => [c.name, (c.paid || []).length]));
  log('Activation : versements passés des projets « En cours » marqués reçus SANS crédit (solde inchangé), projet en retard non pointé', w.cap === cap0 && w.ops.length === 0 && st[0][1] === 13 && st[1][1] === 0 && st[2][1] === 24, { st, w });
  // Un mois plus tard : l'échéance du 08/11 est créditée automatiquement
  await page.clock.setFixedTime(new Date('2026-11-09T12:00:00+01:00'));
  await page.evaluate(() => renderAll());
  w = await W();
  log('Échéance du 08/11 reçue automatiquement : 4,17 € brut → 2,86 € net crédités sur le portefeuille', near(w.cap, cap0 + 2.86) && w.ops.some((o) => o[0] === 'Intérêts' && o[1] === 2.86 && o[2] === 'crowd:m:2026-11' && o[3] === '2026-11-08'), w);
  await page.evaluate(() => renderAll());
  log('Pas de doublon en rouvrant l\'appli', (await W()).ops.filter((o) => o[2] === 'crowd:m:2026-11').length === 1);
  // Montant différent ce mois-là
  await page.evaluate(() => { crowdDetail(0); });
  await page.locator('#sheet .li', { hasText: '08/11/2026' }).click(); await sleep(200);
  await typeIn(page, '#du_m', '1,30'); await page.fill('#du_n', 'prorata'); await btn('Enregistrer');
  w = await W();
  const det2 = N(await page.textContent('#sheet'));
  log('Montant modifié (1,30 €) : portefeuille corrigé, ligne « modifié · prévu 2,86 € · reçu 1,30 € », échéancier inchangé', near(w.cap, cap0 + 1.3) && det2.includes('modifié') && det2.includes('prévu 2,86 € · reçu 1,30 €') && await page.evaluate(() => crowdCalc(DB.crowd[0]).monthly === 4.17), { cap: w.cap, det: det2.slice(det2.indexOf('Échéancier'), det2.indexOf('Échéancier') + 200) });
  // Pas encore reçu : retiré et pas recrédité automatiquement
  await page.locator('#sheet .li', { hasText: '08/11/2026' }).click(); await sleep(200);
  await page.selectOption('#du_st', '0'); await btn('Enregistrer');
  await page.evaluate(() => renderAll());
  w = await W();
  log('« Pas encore reçu » : crédit retiré, et l\'automatisme ne le remet pas', near(w.cap, cap0) && !w.ops.some((o) => o[2] === 'crowd:m:2026-11'), w);
  await page.evaluate(() => { crowdDetail(0); }); await page.locator('#sheet .li', { hasText: '08/11/2026' }).click(); await sleep(200);
  await page.selectOption('#du_st', '1'); await btn('Montant prévu');
  log('Repassé en reçu au montant prévu : 2,86 € crédités', near((await W()).cap, cap0 + 2.86));
  // Remboursement anticipé partiel
  const ap0 = await page.evaluate(() => consolidate().apports);
  await page.evaluate(() => crowdRep(0));
  await typeIn(page, '#rp_m', '200'); await page.fill('#rp_d', '2026-11-09'); await page.evaluate(() => repPreview(0));
  const prev = N(await page.textContent('#rp_prev'));
  log('Aperçu : capital restant 300 €, versement mensuel 2,50 € brut dès l\'échéance du 08/12/2026, 200 € crédités', prev.includes('capital restant : 300,00 €') && prev.includes('2,50 € brut') && prev.includes('08/12/2026') && prev.includes('200,00 € crédités'), prev);
  await btn('Enregistrer');
  const after = await page.evaluate(() => { const k = crowdCalc(DB.crowd[0]); return { cap: k.capital, monthly: k.monthly, net: consolidate().net, ap: consolidate().apports, crowdV: consolidate().iV }; });
  w = await W();
  log('Remboursement partiel : capital 300 €, versement 2,50 €, 200 € sur le portefeuille, apports inchangés', after.cap === 300 && after.monthly === 2.5 && near(w.cap, cap0 + 2.86 + 200) && near(after.ap, ap0), { after, w: w.cap });
  // Remboursement total
  await page.evaluate(() => crowdRep(0)); await page.selectOption('#rp_t', 'total'); await page.fill('#rp_d', '2026-11-09'); await page.evaluate(() => { $('#rp_d').value = '2027-01-20'; repPreview(0); });
  await btn('Enregistrer');
  const tot = await page.evaluate(() => { const c = DB.crowd[0], s = crowdSchedule(c); return { st: c.st, last: s[s.length - 1].ymd, n: s.length, cap: Fin.crowdCapitalAt(c, '2027-02-01') }; });
  log('Remboursement total le 20/01/2027 : projet « Remboursé », dernière échéance le 08/01/2027, capital 0', tot.st === 'Remboursé' && tot.last === '2027-01-08' && tot.cap === 0, tot);
  log('… 300 € recrédités sur le portefeuille', near((await W()).cap, cap0 + 2.86 + 200 + 300));
  // Désactivation : plus rien d'automatique
  await page.evaluate(() => { closeSheet(); nav('placements'); setPlace('crowd'); }); await page.locator('#place-body label.switch').click(); await sleep(200);
  log('Versements automatiques désactivés', await page.evaluate(() => DB.settings.crowdAuto.on === false));
  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00+01:00'));

  // ===== 6. Accueil et Analyse =====
  await page.evaluate(() => { const cc = compteCourant().name; for (let k = 0; k < 3; k++) { const ym = ymKey(addMonths(today(), -k)); DB.movements.push({ d: ym + '-01', p: cc, t: 'Dépôt', q: null, pu: null, m: 2000, f: 0, n: 'Salaire' }); DB.expenses.push({ d: ym + '-05', label: 'Loyer', amt: 700, cat: 'Logement' }, { d: ym + '-12', label: 'Courses', amt: 300 - k * 50, cat: 'Courses' }); } save(); renderAll(); nav('dash'); });
  home = N(await page.textContent('#v-dash'));
  log('Accueil : 3 chiffres — Disponible (mois de dépenses), Revenus passifs /mois, « Épargné en octobre » en euros (1 000 € ; moyenne des mois précédents (1 050 + 1 100) ÷ 2 = 1 075 €/mois)', home.includes('Disponible') && home.includes('mois de dépenses') && home.includes('Revenus passifs') && home.includes('/mois') && home.includes('Épargné en octobre') && home.includes('1 000 €') && home.includes('moyenne 1 075 €/mois') && !home.includes("Taux d'épargne"), home.slice(home.indexOf('Disponible'), home.indexOf('Disponible') + 220));
  log('Accueil : plus de « Total versé », ni de graphiques ; accès « Analyse »', !home.includes('Total versé') && !(await page.evaluate(() => !!document.querySelector('#v-dash canvas'))) && home.includes('Analyse'));
  log('Accueil : 3 alertes au plus, puis « Voir les N alertes »', await page.evaluate(() => { const n = alertsList().length, shown = document.querySelectorAll('#v-dash .al').length; return n <= 3 ? shown === n : shown === 3 && document.querySelector('#v-dash').textContent.includes('Voir les ' + n + ' alertes'); }));
  log('Onglet « Accueil » (et non « Bord »)', (await page.textContent('.nav a[data-v="dash"]')).trim() === 'Accueil');
  await page.locator('#v-dash .fiche', { hasText: 'Analyse' }).click(); await sleep(300);
  const an = N(await page.textContent('#v-analyse'));
  log('Analyse : année (1er janvier, épargne versée, gains), évolution, répartition, performance, cash-flow, récap fiscal', ['Au 1er janvier', 'Épargne versée', 'Gains', 'Évolution du patrimoine', 'Répartition', 'Performance des placements', 'Cash-flow', 'Récap fiscal'].every((x) => an.includes(x)), an.slice(0, 300));
  await page.evaluate(() => { DB.properties = [{ id: 'p1', name: 'Studio', type: 'Appartement', regime: 'nu', price: 150000, notary: 0, works: 0, buyD: '2022-06-01', rent: 0, vacancy: 0, mgmt: 0, charges: 0, copro: 0, taxFonciere: 0, pno: 0, maintenance: 0, values: [] }]; DB.loans = [{ id: 'l1', name: 'Crédit', capital: 120000, rate: 0.03, months: 240, start: '2022-07-01', insurance: 0, propertyId: 'p1' }]; save(); renderAnalyse(); });
  const imB = await page.evaluate(() => repartitionView().find((r) => r.name === 'Immobilier').part);
  await page.locator('#v-analyse button', { hasText: 'Nette de crédits' }).click(); await sleep(200);
  const imN = await page.evaluate(() => repartitionView().find((r) => r.name === 'Immobilier').part);
  log('Répartition « nette de crédits » : la part de l\'immobilier baisse', imN < imB && imN > 0, { imB, imN });
  await page.locator('#v-analyse button', { hasText: 'Accueil' }).click(); await sleep(150);
  log('« ‹ Accueil » ramène à l\'accueil', await page.evaluate(() => document.querySelector('#v-dash').classList.contains('on')));

  // ===== 7. Tour complet =====
  const txt = await page.evaluate(() => { let t = ''; for (const v of ['dash', 'analyse', 'budget', 'revente']) { nav(v); t += document.querySelector('#v-' + v).textContent; } for (const x of ['bourse', 'epargne', 'immo', 'crowd']) { nav('placements'); setPlace(x); t += document.querySelector('#v-placements').textContent; } crowdDetail(0); t += document.querySelector('#sheet').textContent; closeSheet(); return t; });
  log('Aucun « NaN », « undefined », « null » ou « Infinity » affiché', !/NaN|undefined|Infinity|\bnull\b/.test(txt), (txt.match(/.{30}(NaN|undefined|Infinity|\bnull\b).{30}/) || [])[0]);
  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
