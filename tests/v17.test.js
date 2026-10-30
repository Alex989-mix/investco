// Parcours au doigt des nouveautés v17 (téléphone 390 px) : centimes, paramètres, fiscalité, immobilier,
// revente, budget, règles, objectifs, alertes, migration d'une base v16.2. Date figée : 22/10/2026.
const { openApp, chromium } = require('./harness');
const fs = require('fs');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined ? '  →  ' + JSON.stringify(d) : '')); };
const typeIn = async (page, sel, txt) => { await page.fill(sel, ''); await page.locator(sel).pressSequentially(txt); };
const N = (s) => String(s || '').replace(/[  ]/g, ' ');

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-10-22T14:00:00+02:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', d => d.accept());
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); });
  const btn = (txt) => page.locator('#sheet button', { hasText: txt }).first().click().then(() => page.waitForTimeout(150));
  const quick = async (txt) => { await page.locator('.nav a[data-v="add"]').click(); await page.waitForTimeout(120); await btn(txt); };

  // ===== 1. Stockage en centimes =====
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('investco_v1')));
  const ints = [raw.movements[0].pu, raw.movements[0].f, raw.expenses[0].amt, raw.resale[0].buy].every(Number.isInteger);
  log('Stockage : montants en centimes entiers (marqueur « cents »)', raw.meta.money === 'cents' && ints && raw.movements[0].pu === 4500000, { pu: raw.movements[0].pu, money: raw.meta.money });
  await page.evaluate(() => { DB.expenses.push({ d: '2026-10-05', label: 'Test 0,1+0,2', amt: 0.1 + 0.2, cat: 'Autres' }); save(); });
  await page.evaluate(() => { DB.settings.onboarded = true; save(); });
  await page.reload(); await page.waitForTimeout(1500); await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); });
  const re = await page.evaluate(() => ({ e: DB.expenses.find(x => x.label === 'Test 0,1+0,2').amt, cap: compteCourant().cap }));
  log('Après rechargement : 0,1 + 0,2 relu exactement 0,30 €', re.e === 0.3, re);
  await page.evaluate(() => { DB.expenses = DB.expenses.filter(x => x.label !== 'Test 0,1+0,2'); save(); });
  log('Migration des données d\'exemple : plus de table de taux dans les données', await page.evaluate(() => DB.rates === undefined && DB.pel === undefined && DB.meta.schema >= 5));

  // ===== 2. Fiscalité personnelle et paramètres réglementaires =====
  await page.evaluate(() => openSettings()); await page.waitForTimeout(150);
  await page.selectOption('#set_tmi', '0.11'); await page.selectOption('#set_resale', 'microbic');
  await btn('Enregistrer');
  const tx = await page.evaluate(() => ({ tmi: DB.settings.tmi, bareme: taxBareme(), pfu: taxPFU(), regime: DB.settings.resaleRegime }));
  log('Réglages au doigt : TMI 11 % → barème 29,6 %, PFU 31,4 %, revente en micro-BIC', tx.tmi === 0.11 && Math.abs(tx.bareme - 0.296) < 1e-9 && Math.abs(tx.pfu - 0.314) < 1e-9 && tx.regime === 'microbic', tx);
  await page.evaluate(() => openParams());
  const cards = await page.locator('#sheet .card').count();
  const laTxt = N(await page.locator('#sheet .card', { hasText: 'Taux Livret A' }).first().textContent());
  log('Paramètres réglementaires : tous listés, Livret A 1,7 % depuis le 01/08/2026', cards >= 20 && /1,7 %/.test(laTxt) && laTxt.includes('01/08/2026'), { cartes: cards });
  const k = await page.evaluate(() => Fin.paramKeys().indexOf('rate.Livret A'));
  const card = page.locator('#sheet .card', { hasText: 'Taux Livret A' }).first();
  await card.locator('summary').click();
  await page.fill('#pf_' + k, '2027-02-01'); await typeIn(page, '#pv_' + k, '2,1');
  await card.locator('button', { hasText: 'Ajouter cette valeur' }).click(); await page.waitForTimeout(150);
  const pv = await page.evaluate(() => ({ futur: param('rate.Livret A', '2027-03-01'), auj: param('rate.Livret A'), passe: param('rate.Livret A', '2026-03-01'), n: DB.params.length }));
  log('Nouvelle valeur datée 2,1 % au 01/02/2027 : appliquée ensuite, passé et présent inchangés', pv.futur === 0.021 && pv.auj === 0.017 && pv.passe === 0.015 && pv.n === 1, pv);
  const stP = await page.evaluate(() => JSON.parse(localStorage.getItem('investco_v1')).params[0]);
  log('… enregistrée avec sa date (historique conservé)', stP.from === '2027-02-01' && stP.value === 0.021 && stP.unit === '%', stP);
  await page.evaluate(() => closeSheet());

  // ===== 3. Bien + crédit, au doigt =====
  const net0 = await page.evaluate(() => consolidate().net);
  await quick('Bien immobilier');
  await page.fill('#pr_name', 'Appartement Montpellier'); await typeIn(page, '#pr_price', '200 000'); await page.fill('#pr_buyd', '2024-01-15');
  await typeIn(page, '#pr_rent', '900'); await typeIn(page, '#pr_charges', '150'); await typeIn(page, '#pr_val', '215 000'); await page.fill('#pr_vald', '2026-06-01');
  await btn('Enregistrer');
  await quick('Crédit');
  await typeIn(page, '#ln_cap', '200 000'); await typeIn(page, '#ln_rate', '3,5'); await typeIn(page, '#ln_months', '240'); await page.fill('#ln_start', '2024-01-15');
  await typeIn(page, '#ln_ins', '30'); await page.selectOption('#ln_prop', { label: 'Appartement Montpellier' });
  await btn('Enregistrer');
  const im = await page.evaluate(() => { const c = consolidate(); return { net: c.net, debt: c.debt, re: c.reValue, cf: c.reCashflow, body: document.querySelector('#place-body').textContent }; });
  log('Crédit 200 000 € / 3,5 % / 20 ans : restant dû 180 057,34 € au 22/10/2026', im.debt === 180057.34, im.debt);
  log('Patrimoine net = avant + 215 000 € de bien − 180 057,34 € de crédit', Math.abs(im.net - (net0 + 215000 - 180057.34)) < 0.01, { avant: net0, après: im.net });
  log('Cash-flow : 900 − 150 − 1 189,92 = −439,92 €/mois', im.cf === -439.92, im.cf);
  const body = N(im.body);
  log('Écran Immo : rendement brut 5,4 % / net 4,5 %, mensualité 1 189,92 €', /Rendement brut 5,4 % · net 4,5 %/.test(body) && body.includes('1 189,92 €'), body.match(/Rendement[^C]*/)?.[0]);
  await page.locator('#place-body button', { hasText: 'Tableau d\'amortissement' }).click(); await page.waitForTimeout(150);
  const am = N(await page.locator('#sheet').textContent());
  log('Tableau d\'amortissement : 21 années (2024 → 2044), coût des intérêts affiché', (am.match(/20[2-4]\d/g) || []).filter((v, i, a) => a.indexOf(v) === i).length >= 21 && /intérêts [\d ]+,\d\d €/.test(am));
  await page.evaluate(() => closeSheet());
  const dash = N(await page.evaluate(() => { nav('dash'); return document.querySelector('#v-dash').textContent; }));
  log('Tableau de bord : « Patrimoine net » et « actifs … − crédits … »', dash.includes('Patrimoine net') && /crédits 180 057 €/.test(dash));

  // ===== 4. Revente au doigt (micro-BIC choisi plus haut) =====
  await quick('Article d\'achat-revente');
  await page.fill('#x_name', 'Veste Arc\'teryx'); await typeIn(page, '#x_buy', '60'); await typeIn(page, '#x_fees', '4,50'); await page.fill('#x_buyd', '2026-09-01');
  await page.selectOption('#x_plat', 'Vinted'); await page.selectOption('#x_st', 'Vendu');
  await typeIn(page, '#x_sell', '150'); await page.fill('#x_selld', '2026-10-01'); await typeIn(page, '#x_sfee', '7,50'); await typeIn(page, '#x_ship', '5');
  await btn('Enregistrer');
  const rv = await page.evaluate(() => { nav('revente'); const Y = Fin.resaleYear(DB.resale, 2026, { regime: 'microbic', abattement: 0.71 }); return { net: Y.net, taxable: Y.taxable, ca: Y.revenue, txt: document.querySelector('#v-revente').textContent }; });
  // iPhone : 410 − 288 = 122 ; Veste : 150 − 64,50 − 12,50 = 73 → net 195 ; CA 560 → imposable 29 % = 162,40
  log('Revente : marge nette 195 €, CA 560 €, imposable micro-BIC 162,40 €', rv.net === 195 && rv.ca === 560 && rv.taxable === 162.4, { net: rv.net, ca: rv.ca, imposable: rv.taxable });
  log('… article affiché avec plateforme, durée et frais', /Vinted · acheté 01\/09\/2026 · 30 j/.test(N(rv.txt)) && N(rv.txt).includes('frais 12,50 €'));

  // ===== 5. Budget prévu / réel + abonnement détecté =====
  await page.evaluate(() => { nav('budget'); editBudgets(); });
  await typeIn(page, '#cb_Courses', '50'); await btn('Enregistrer');
  await page.evaluate(() => { ['2026-07-14', '2026-08-14', '2026-09-14', '2026-10-14'].forEach(d => DB.expenses.push({ d, label: 'Netflix', amt: 13.49, cat: 'Abonnements' })); DB.expenses.push({ d: '2026-10-03', label: 'Carrefour', amt: 62, cat: 'Courses' }); save(); renderBudget(); });
  const bud = N(await page.evaluate(() => document.querySelector('#v-budget').textContent));
  log('Budget : « Prévu vs réel » avec Courses 50 € / 62 € (+12 €)', bud.includes('Prévu vs réel') && /Courses50 €62 €\+12 €/.test(bud.replace(/\s/g, '').replace(/€/g, ' €').replace(/ /g, '')) || /Courses\s*50 €\s*62 €\s*\+12 €/.test(bud), bud.match(/Courses.{0,40}/)?.[0]);
  log('Abonnement repéré : Netflix 13,49 € le 14', bud.includes('Netflix · 13,49 € le 14'));
  await page.locator('#v-budget button', { hasText: 'Ajouter' }).first().click(); await page.waitForTimeout(150);
  const rec = await page.evaluate(() => DB.recurring.find(r => r.label === 'Netflix'));
  log('Un clic : Netflix devient une récurrente à partir du 14/11/2026', rec && rec.amt === 13.49 && rec.start === '2026-11-14' && rec.day === 14, rec);

  // ===== 6. Règles de catégories + import sans doublon =====
  await page.evaluate(() => openRules());
  await page.fill('#ru_kw', 'boulangerie'); await page.selectOption('#ru_cat', 'Courses'); await btn('Ajouter la règle');
  const ac = await page.evaluate(() => [autoCat('CB BOULANGERIE PAUL 21/10'), autoCat('CARREFOUR MARKET')]);
  log('Règle « boulangerie » → Courses (et règles intégrées toujours actives)', ac[0] === 'Courses' && ac[1] === 'Courses', ac);
  const imp = await page.evaluate(() => {
    const before = DB.expenses.length;
    impReview = [{ date: '2026-10-14', label: 'NETFLIX', amount: -13.49, kind: 'Dépense', cat: 'Abonnements' }, { date: '2026-10-21', label: 'BOULANGERIE PAUL', amount: -4.2, kind: 'Dépense', cat: autoCat('BOULANGERIE PAUL') }];
    impDoBank(); const t1 = document.querySelector('#toast').textContent;
    impReview = [{ date: '2026-10-21', label: 'BOULANGERIE PAUL', amount: -4.2, kind: 'Dépense', cat: 'Courses' }]; impDoBank();
    return { ajoutées: DB.expenses.length - before, toast: t1, toast2: document.querySelector('#toast').textContent };
  });
  log('Import : Netflix déjà présent ignoré, boulangerie ajoutée ; ré-import → doublon ignoré', imp.ajoutées === 1 && /1 opération importée · 1 doublon/.test(imp.toast) && /0 opération.*1 doublon/.test(imp.toast2), imp);

  // ===== 7. Objectif d'épargne au doigt =====
  await page.evaluate(() => { nav('dash'); });
  await page.locator('#v-dash button', { hasText: 'Objectif' }).first().click(); await page.waitForTimeout(150);
  await page.fill('#g_name', 'Épargne de précaution'); await typeIn(page, '#g_val', '20 000'); await page.fill('#g_dl', '2027-10-22');
  await page.locator('.g_acc[value="Livret A"]').check(); await page.locator('.g_acc[value="LDDS"]').check();
  await btn('Enregistrer');
  const go = await page.evaluate(() => { const g = DB.goals.find(x => x.name === 'Épargne de précaution'); return { cur: goalCurrent(g), P: Fin.goalProgress(g, goalCurrent(g), '2026-10-22'), txt: document.querySelector('#v-dash').textContent }; });
  log('Objectif 20 000 € avec Livret A + LDDS (19 700 €) → 25 €/mois pendant 12 mois', go.cur === 19700 && go.P.monthly === 25 && go.P.months === 12 && N(go.txt).includes('25 €/mois pendant 12 mois'), { actuel: go.cur, mensuel: go.P.monthly });

  // ===== 8. Alerte de plafond =====
  await page.evaluate(() => { addOpFor('Livret A', 'Dépôt'); });
  await typeIn(page, '#f_m', '7 950'); await btn('Enregistrer');
  const al = N(await page.evaluate(() => { nav('dash'); return document.querySelector('#v-dash').textContent; }));
  log('Livret A à 22 950 € versés → alerte « plafond de versements atteint »', al.includes('Livret A : plafond de versements atteint (22 950 €)'));
  const ep = N(await page.evaluate(() => { nav('placements'); setPlace('epargne'); return document.querySelector('#place-body').textContent; }));
  log('Épargne : jauges « plafond 22 950 € · 100 % » (Livret A) et « 43 % » (LDDS, solde repris compté comme versé)', ep.includes('plafond 22 950 € · 100 %') && ep.includes('plafond 12 000 € · 43 %'), ep.slice(0, 400));

  // ===== 9. Migration d'une vraie base v16.2 (euros, anciens réglages fiscaux) =====
  const v162 = { movements: [{ d: '2024-01-01', p: 'Livret A', t: 'Dépôt', q: null, pu: null, m: 1000.5, f: 0, n: '' }, { d: '2024-02-01', p: 'BTC', t: 'Achat', q: 0.01, pu: 40000, m: null, f: 1.5, n: '' }],
    assets: [{ name: 'BTC', ticker: 'BTC-EUR', type: 'Crypto', env: 'Bitstack', price: 60000, sellFee: 0.01, cur: 'EUR' }],
    savings: [{ name: 'Livret A', type: 'Livret A', bank: '', cap: 1000.5, open: '2024-01-01', rate: null, tax: 'Exonéré', ceil: 22950 }, { name: 'PEL', type: 'PEL', bank: '', cap: 0, open: '2021-04-20', rate: null, tax: 'Barème TMI 0%', ceil: 61200 }, { name: 'Compte courant', type: 'Compte courant', cap: 0, open: null, rate: null, tax: 'Exonéré', ceil: null }],
    crowd: [], expenses: [{ d: '2026-10-01', label: 'PRLV SEPA BITSTACK', amt: 10, cat: 'Autres' }, { d: '2026-10-02', label: 'PRLV COINBASE', amt: 5, cat: 'Loisirs' }], recurring: [], resale: [],
    settings: { crowdTax: 'pfu', flatTax: 0.314, avTax: 0.30, baremeTax: 0.186, cryptoTax: 0.186, peaTax: 0, objNet: 0.1, snapshots: { 2026: 5000 }, goal: 60000, catBudgets: {}, theme: 'dark' },
    meta: { updatedAt: 1, schema: 3 }, rates: [['Livret A', '2026-08-01', 0.017]], pel: { 2021: 0.01 } };
  const mig = await page.evaluate((old) => {
    localStorage.setItem('investco_v1', JSON.stringify(old)); load(); save();
    const st = JSON.parse(localStorage.getItem('investco_v1'));
    return { tmi: DB.settings.tmi, crypto: DB.settings.cryptoRegime, tax: DB.savings[1].tax, ceil: DB.savings[0].ceil, ceilFor: ceilFor(DB.savings[0]), rates: DB.rates, cap: DB.savings[0].cap,
      goal: DB.goals.map(g => [g.name, g.target, g.accounts.join()]), cats: DB.expenses.map(e => e.cat), stockedCap: st.movements[0].m, stockedGoal: st.goals[0].target, flat: DB.settings.flatTax, schema: DB.meta.schema, pel: rateFor(DB.savings[1]) };
  }, v162);
  log('Migration v16.2 → v17 : TMI 0 %, crypto au barème (ancien choix conservé), « Barème »', mig.tmi === 0 && mig.crypto === 'bareme' && mig.tax === 'Barème' && mig.flat === undefined && mig.schema >= 5, mig);
  log('… versement Bitstack resté en « Autres » → « Investissement » ; catégorie choisie à la main conservée', JSON.stringify(mig.cats) === '["Investissement","Loisirs"]', mig.cats);
  log('… plafond réglementaire repris des paramètres, taux PEL 2021 = 1 %, solde 1 000,50 €', mig.ceil === null && mig.ceilFor === 22950 && mig.pel === 0.01 && mig.cap === 1000.5 && mig.rates === undefined);
  log('… ancien objectif 60 000 € devenu un objectif « Patrimoine » ; stockage en centimes', JSON.stringify(mig.goal) === '[["Patrimoine",60000,"*"]]' && mig.stockedCap === 100050 && mig.stockedGoal === 6000000);

  // ===== 10. Tour complet : écrans et fenêtres, sans erreur ni NaN =====
  await page.evaluate(() => { resetData(); });
  await page.evaluate(() => { DB.properties = [{ id: 'p1', name: 'Studio', price: 120000, rent: 550, charges: 90, values: [] }]; DB.loans = [{ id: 'l1', name: 'Prêt', capital: 100000, rate: 0.032, months: 300, start: '2025-03-10', insurance: 15, propertyId: 'p1' }]; DB.goals = [{ id: 'g1', name: 'Apport', target: 30000, deadline: '2026-01-01', accounts: ['LDDS'] }]; save(); });
  const forms = ['editProperty(-1)', 'editProperty(0)', 'editLoan(-1)', 'editLoan(0)', 'loanTable(0)', 'editGoal(-1)', 'editGoal(0)', 'openParams()', 'openRules()', 'openSettings()', 'editResale(-1)', 'editResale(0)', 'editBudgets()', 'quickAdd()', 'taxRecap()'];
  const fails = [];
  for (const f of forms) { const ok = await page.evaluate((code) => { try { eval(code); return document.querySelector('#ov').classList.contains('on'); } catch (e) { return String(e); } }, f); if (ok !== true) fails.push([f, ok]); await page.evaluate(() => closeSheet()); }
  log('Les 15 nouvelles fenêtres s\'ouvrent', fails.length === 0, fails.length ? fails : undefined);
  const all = await page.evaluate(() => { let t = ''; for (const v of ['dash', 'budget', 'revente']) { nav(v); t += document.querySelector('#v-' + v).textContent; } for (const x of ['bourse', 'epargne', 'immo']) { nav('placements'); setPlace(x); t += document.querySelector('#v-placements').textContent; } return t; });
  log('Aucun « NaN », « undefined », « null » ou « Infinity » affiché', !/NaN|undefined|Infinity|\bnull\b/.test(all), (all.match(/.{30}(NaN|undefined|Infinity|\bnull\b).{30}/) || [])[0]);
  log('Objectif en retard signalé dans les alertes', N(all).includes('Objectif « Apport » : échéance dépassée'));

  // Captures pour vérification visuelle
  const dir = process.env.SHOTS; if (dir) { fs.mkdirSync(dir, { recursive: true });
    for (const [v, x] of [['placements', 'immo'], ['budget'], ['revente'], ['dash']]) { await page.evaluate(([v, x]) => { nav(v); if (x) setPlace(x); }, [v, x]); await page.waitForTimeout(200); await page.screenshot({ path: `${dir}/${x || v}.png`, fullPage: true }); }
    await page.evaluate(() => openSettings()); await page.waitForTimeout(200); await page.screenshot({ path: `${dir}/reglages.png` }); }

  log('Aucune erreur JavaScript pendant tout le parcours', errors.length === 0, errors.length ? errors : undefined);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
