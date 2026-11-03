// Parcours v28.1 : simulateur de rachat d'assurance-vie, récap fiscal détaillé, geste « retour » qui ne quitte plus l'appli.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const near = (a, b, e = 0.011) => Math.abs(a - b) < e;
const N = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ');

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-11-04T12:00:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); DB.settings.onboarded = true;
    const i = DB.savings.findIndex((s) => s.type === 'Assurance-vie'); const c0 = window.confirm; window.confirm = () => true; convertLife(i); window.confirm = c0; closeSheet();
    const s = DB.savings[i]; s.open = '2016-05-10'; // plus de 8 ans pour ce parcours
    s.life.funds.push({ id: 'f2', kind: 'uc', name: 'ETF Monde', sym: '', px: 100, pxD: '2026-11-01', vals: [] });
    DB.movements.push({ d: '2024-01-10', p: s.name, t: 'Dépôt', q: 50, pu: null, m: 4000, f: 0, n: '', fund: 'f2' }); // 50 parts × 100 € = 5 000 €
    save(); renderAll(); nav('dash'); });
  await sleep(200);
  const I = await page.evaluate(() => DB.savings.findIndex((s) => s.type === 'Assurance-vie'));

  // ===== 1. Simulateur =====
  await page.evaluate((i) => lifeDetail(i), I);
  await page.locator('#sheet button', { hasText: 'Simuler un rachat' }).click(); await sleep(100);
  const b = await page.evaluate((i) => { const B = lifeRachatBase(DB.savings[i], ymd(today()), null); return Object.assign(B, { free: Fin.lifeTaxFreeRachat(B.value, B.versed, 4600) }); }, I);
  log('Base du simulateur : valeur et versements du contrat, part des UC', b.value > 0 && b.versed > 0 && b.ucShare > 0.2 && b.ucShare < 0.4 && b.over8, b);
  const memo = N(await page.textContent('#sheet .memo'));
  log('Contrat de plus de 8 ans : montant maximal sans impôt sur le revenu affiché', memo.includes('Sans impôt sur le revenu cette année') && memo.includes('4 600'), memo);
  await page.fill('#sim_m', '2000'); await page.dispatchEvent('#sim_m', 'input'); await sleep(50);
  const T = await page.evaluate((i) => lifeSimCalc(i), I);
  const exp = (2000 * (b.value - b.versed)) / b.value;
  log('Rachat de 2 000 € : part de gains = 2 000 × (V − P) / V, couverte par l\'abattement, net = 2 000 € − PS des UC', near(T.gain, Math.round(exp * 100) / 100) && T.abat === T.gain && T.ir === 0 && near(T.ps, Math.round(T.gain * b.ucShare * 0.172 * 100) / 100) && near(T.net, 2000 - T.ps), { T, exp });
  const txt = N(await page.textContent('#sim_r'));
  log('Résultat lisible : capital, gains, abattement, impôt, prélèvements sociaux, net perçu', ['Part de capital', 'Part de gains', 'Abattement utilisé', 'Impôt sur le revenu', 'Prélèvements sociaux', 'Vous recevez'].every((k) => txt.includes(k)), txt);
  await page.fill('#sim_m', '999999'); await page.dispatchEvent('#sim_m', 'input'); await sleep(50);
  log('Montant supérieur à la valeur : ramené à la valeur du contrat', N(await page.textContent('#sim_r')).includes('ramené à la valeur'));
  const u8 = await page.evaluate((i) => { const s = DB.savings[i], o = s.open; s.open = '2022-01-01'; lifeSim(i); const m = document.querySelector('#sheet .memo').textContent; $('#sim_m').value = '2000'; const t = lifeSimCalc(i); s.open = o; return { m, t }; }, I);
  log('Contrat de moins de 8 ans : date des 8 ans et impôt de 12,8 % sur les gains', /moins de 8 ans.*8 ans le 01\/01\/2030/.test(N(u8.m)) && near(u8.t.ir, Math.round(u8.t.gain * 0.128 * 100) / 100) && u8.t.abat === 0, u8);

  // ===== 2. Enregistrer le rachat, part de gains de l'assureur =====
  await page.evaluate((i) => lifeSim(i), I); await page.fill('#sim_m', '3000');
  await page.locator('#sheet button', { hasText: 'Enregistrer ce rachat' }).click(); await sleep(100);
  const ed = await page.evaluate(() => ({ t: $('#o_t').value, m: $('#o_m').value, gp: getComputedStyle($('#o_wgp')).display !== 'none' }));
  log('« Enregistrer ce rachat » ouvre un rachat prérempli, avec le champ « Part de gains indiquée par l\'assureur »', ed.t === 'Retrait' && ed.m === '3000' && ed.gp, ed);
  await page.fill('#o_gp', '5000');
  await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await sleep(80);
  log('Part de gains supérieure au rachat refusée', N(await page.textContent('#toast')).includes('Part de gains entre 0'));
  await page.fill('#o_gp', '412,50');
  await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await sleep(100);
  const r1 = await page.evaluate(() => { const m = DB.movements.find((x) => x.t === 'Retrait' && x.gp != null); const f = fiscalData(); return { gp: m && m.gp, d: m && m.d, av: f.av, avAbat: f.avAbat, est: f.estTax, stored: Fin.serialize(DB).movements.find((x) => x.gp != null).gp }; });
  log('Rachat enregistré avec la part de gains de l\'assureur (412,50 €, stockée en centimes)', r1.gp === 412.5 && r1.stored === 41250, r1);
  log('Récap fiscal : la part de gains de l\'assureur est retenue, couverte par l\'abattement, reste 4 187,50 €', r1.av.lines.length === 1 && r1.av.lines[0].gain === 412.5 && r1.av.lines[0].known && r1.avAbat === 412.5 && r1.av.taxable === 0 && r1.av.abatLeft === 4187.5, r1.av);
  const rec = await page.evaluate(() => { taxRecap(); return document.querySelector('#sheet').textContent; });
  log('Récap fiscal détaillé : rachat, gains indiqués par l\'assureur, abattement restant', /Rachat de 3 000 € sur « Assurance-vie »/.test(N(rec)) && N(rec).includes('indiqués par l\'assureur') && N(rec).includes('il vous reste 4 188 € d\'abattement'), N(rec).slice(0, 900));
  await page.evaluate(() => closeSheet());
  const sim2 = await page.evaluate((i) => { lifeSim(i); return document.querySelector('#sheet .memo').textContent; }, I);
  log('Simulation suivante : l\'abattement déjà utilisé cette année est déduit', N(sim2).includes('4 188'), N(sim2));
  const cpl = await page.evaluate(() => { DB.settings.foyer = 'couple'; const f = fiscalData(); DB.settings.foyer = 'seul'; return f.av.abatLeft; });
  log('Foyer « couple » : 9 200 € d\'abattement, 8 787,50 € restants', cpl === 8787.5, cpl);
  const big = await page.evaluate(() => { const m = DB.movements.find((x) => x.gp != null); m.gp = 6000; m.m = 7000; const f = fiscalData(); m.gp = 412.5; m.m = 3000; return { tax: f.av.taxable, ir: f.av.ir, est: f.estTax }; });
  log('Gains de 6 000 € : 1 400 € imposables après abattement, impôt à 7,5 % (105 €) compté dans l\'impôt estimé', big.tax === 1400 && big.ir === 105 && big.est >= 105, big);
  await page.evaluate(() => closeSheet());

  // ===== 3. Geste « retour » : on reste dans l'appli =====
  await page.evaluate(() => { window.__alive = 'oui'; nav('dash'); });
  await page.mouse.click(200, 400); await sleep(50); // un toucher : la garde d'historique est posée
  await page.evaluate(() => { nav('budget'); productDetail('Livret A'); });
  await page.goBack(); await sleep(150);
  const g1 = await page.evaluate(() => ({ sheet: $('#ov').classList.contains('on'), view: document.querySelector('.view.on').id, alive: window.__alive }));
  log('Retour avec une fenêtre ouverte : la fenêtre se ferme, l\'écran reste', !g1.sheet && g1.view === 'v-budget' && g1.alive === 'oui', g1);
  await page.mouse.click(200, 300); await sleep(50); await page.goBack(); await sleep(150);
  const g2 = await page.evaluate(() => ({ view: document.querySelector('.view.on').id, alive: window.__alive }));
  log('Retour depuis un autre écran : retour à l\'Accueil', g2.view === 'v-dash' && g2.alive === 'oui', g2);
  await page.mouse.click(200, 300); await sleep(50); await page.goBack(); await sleep(150);
  await page.goBack().catch(() => {}); await sleep(150);
  const g3 = await page.evaluate(() => ({ view: document.querySelector('.view.on').id, alive: window.__alive, url: location.pathname }));
  log('Retours répétés sur l\'Accueil : l\'appli reste ouverte', g3.view === 'v-dash' && g3.alive === 'oui', g3);
  await page.evaluate(() => { showHelp('life'); }); await page.mouse.click(5, 5); await page.evaluate(() => { showHelp('life'); }); await page.goBack(); await sleep(120);
  log('Retour avec l\'aide ouverte : l\'aide se ferme', await page.evaluate(() => !$('#hlp').classList.contains('on')));
  const ob = await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorX);
  log('Balayage latéral du navigateur neutralisé (overscroll-behavior-x : none)', ob === 'none', ob);

  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
