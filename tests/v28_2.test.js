// Parcours v28.2 : import des relevés de l'assureur (opérations, situation, texte d'un PDF) sur un contrat d'assurance-vie.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const near = (a, b, e = 0.011) => Math.abs(a - b) < e;

const OPS = 'Contrat Assurance-vie - Relevé des opérations\nDate;Opération;Support;Montant;Nombre de parts\n15/01/2026;Versement libre;Fonds euros Euro Objectif Climat;1 000,00;\n15/01/2026;Versement libre;Amundi MSCI World;500,00;4,1234\n01/03/2026;Arbitrage - désinvestissement;Fonds euros Euro Objectif Climat;-2 000,00;\n01/03/2026;Arbitrage - réinvestissement;Amundi MSCI World;2 000,00;16,5\n31/12/2025;Participation aux bénéfices;Fonds euros Euro Objectif Climat;245,10;\n31/12/2025;Prélèvements sociaux;Fonds euros Euro Objectif Climat;-42,16;\n30/06/2026;Frais de gestion;Amundi MSCI World;-12,30;-0,1\n10/09/2026;Rachat partiel;Fonds euros Euro Objectif Climat;-3 000,00;\n';
const SIT = 'Situation de votre contrat Assurance-vie au 31/10/2026\nSupport;Nombre de parts;Valeur liquidative;Montant\nFonds euros Euro Objectif Climat;;;10 245,90\nAmundi MSCI World;20,5234;121,40;2 491,54\nSCPI Primovie;;;1 500,00\nTotal;;;14 237,44\n';
const PDF = 'Spirica - Assurance-vie\nRelevé annuel de situation\n05/10/2026 Versement complémentaire 250,00 €\n12/10/2026 Frais de gestion -3,20 €\n';

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-11-04T12:00:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); DB.settings.onboarded = true; save(); renderAll(); });
  const run = (txt) => page.evaluate((t) => { closeSheet(); openImport(); $('#imp_txt').value = t; impAnalyze(); return { mode: impMode, tabs: [...document.querySelectorAll('#imp_result .subtab')].map((x) => x.textContent.trim()), body: $('#imp_body').textContent }; }, txt);

  // ===== 1. Contrat pas encore converti =====
  const r0 = await run(OPS);
  log('Relevé d\'assurance-vie reconnu : onglet « Assurance-vie » de l\'import', r0.mode === 'life' && r0.tabs.includes('Assurance-vie'), r0);
  log('Sans contrat complet : invitation à convertir l\'assurance-vie d\'abord', /Convertissez d'abord « Assurance-vie »/.test(r0.body), r0.body);
  await page.evaluate(() => { closeSheet(); const c0 = window.confirm; window.confirm = () => true; convertLife(DB.savings.findIndex((s) => s.type === 'Assurance-vie')); window.confirm = c0; closeSheet(); });

  // ===== 2. Relevé d'opérations =====
  const ref = await page.evaluate(() => ({ net: consolidate().net, apports: consolidate().apports, n: DB.movements.length }));
  const r1 = await run(OPS);
  const v1 = await page.evaluate(() => ({ acc: impLife.acc, funds: impLife.rows.map((r) => r.fund), sum: $('#il_sum').textContent }));
  log('Supports rattachés : le fonds en euros au fonds de l\'appli, l\'ETF à créer', v1.acc === 'Assurance-vie' && v1.funds[0] === 'f1' && v1.funds[1] === 'new:Amundi MSCI World', v1);
  log('Résumé : 7 opérations dont 1 arbitrage, 1 nouveau support', /7 opérations à ajouter/.test(v1.sum) && /dont 1 arbitrage/.test(v1.sum) && /1 nouveau support/.test(v1.sum), v1.sum);
  await page.locator('#sheet button', { hasText: 'Importer sur ce contrat' }).click(); await sleep(150);
  const a1 = await page.evaluate(() => { const s = findSaving('Assurance-vie'), L = savingCalc(s).life, f2 = s.life.funds.find((f) => f.name === 'Amundi MSCI World');
    const ar = DB.movements.find((m) => m.p === s.name && m.t === 'Arbitrage');
    return { funds: s.life.funds.map((f) => f.kind + ':' + f.name), f2: f2 && f2.id, units: f2 && L.funds.find((f) => f.id === f2.id).units, ar: ar && [ar.fund, ar.fund2, ar.m, ar.q2], net: consolidate().net, apports: consolidate().apports,
      n: DB.movements.length, frais: DB.movements.filter((m) => m.p === s.name && m.t === 'Frais').length, bak: listBackups()[0].reason, title: document.querySelector('#sheet h2').textContent }; });
  log('Import : support « Amundi MSCI World » créé (UC), 20,5234 parts (4,1234 + 16,5 − 0,1)', a1.funds.includes('uc:Amundi MSCI World') && a1.units === 20.5234, a1);
  log('Arbitrage enregistré du fonds en euros vers l\'ETF (2 000 €, 16,5 parts reçues)', a1.ar && a1.ar[0] === 'f1' && a1.ar[1] === a1.f2 && a1.ar[2] === 2000 && a1.ar[3] === 16.5, a1.ar);
  log('Patrimoine : −1 309,36 € (versements, intérêts, PS et frais, rachat ; l\'arbitrage est neutre)', near(a1.net - ref.net, -1309.36), { d: a1.net - ref.net });
  log('Épargne de l\'année : +1 500 € versés − 3 000 € rachetés (les frais et l\'arbitrage n\'en sont pas)', near(a1.apports - ref.apports, -1500), { d: a1.apports - ref.apports });
  log('Prélèvements sociaux classés en frais, copie de sécurité faite, fiche du contrat ouverte', a1.frais === 2 && /Avant import du relevé du contrat/.test(a1.bak) && a1.title === 'Assurance-vie', a1);
  await run(OPS);
  const d1 = await page.evaluate(() => $('#il_sum').textContent);
  log('Même relevé importé une 2e fois : tout est reconnu comme déjà présent', /0 opération à ajouter · 7 déjà présentes/.test(d1), d1);

  // ===== 3. Relevé de situation =====
  await run(SIT);
  const v3 = await page.evaluate(() => ({ mode: impLife.P.mode, d: impLife.d, funds: impLife.rows.map((r) => r.fund), sum: $('#il_sum').textContent, rev: $('#il_rev').textContent }));
  log('Situation au 31/10/2026 : 3 supports, ETF reconnu, SCPI à créer', v3.mode === 'situation' && v3.d === '2026-10-31' && v3.funds[0] === 'f1' && !String(v3.funds[1]).startsWith('new:') && v3.funds[2] === 'new:SCPI Primovie', v3);
  const pre = await page.evaluate(() => ({ net: consolidate().net, apports: consolidate().apports }));
  await page.locator('#sheet button', { hasText: 'Importer sur ce contrat' }).click(); await sleep(150);
  const a3 = await page.evaluate(() => { const s = findSaving('Assurance-vie'), V = Fin.lifeValue(s.life, DB.movements, s.name, '2026-10-31'), f2 = s.life.funds.find((f) => f.name === 'Amundi MSCI World'), f3 = s.life.funds.find((f) => f.name === 'SCPI Primovie');
    return { euro: V.funds.find((f) => f.id === 'f1').value, uc: V.funds.find((f) => f.id === f2.id).value, px: [f2.px, f2.pxD], vals: f2.vals, scpi: f3 && V.funds.find((f) => f.id === f3.id).value, rep: DB.movements.find((m) => m.n === 'Support repris du relevé'),
      adj: DB.movements.find((m) => /Écart avec le relevé du 31\/10\/2026/.test(m.n || '')), net: consolidate().net, apports: consolidate().apports }; });
  log('Fonds en euros aligné sur le relevé (10 245,90 €) par un ajustement daté du 31/10', near(a3.euro, 10245.9) && a3.adj && a3.adj.d === '2026-10-31', a3);
  log('ETF : cours 121,40 € du 31/10 et valeur relevée enregistrés, 20,5234 parts × 121,40 € = 2 491,54 €', a3.px[0] === 121.4 && a3.px[1] === '2026-10-31' && a3.vals.some((x) => x.d === '2026-10-31' && x.v === 2491.54) && near(a3.uc, 2491.54), a3);
  log('SCPI inconnue : support créé et repris comme argent déjà détenu (1 500 €, pas un versement)', near(a3.scpi, 1500) && a3.rep && a3.rep.t === 'Reprise' && near(a3.apports, pre.apports), a3);

  // ===== 4. Texte d'un PDF =====
  const r4 = await run(PDF);
  const v4 = await page.evaluate(() => impLife && impLife.rows.map((r) => r.kind + ' ' + r.amount + ' ' + r.fund));
  log('Texte d\'un PDF d\'assureur : 2 opérations lues (versement, frais), sur le fonds en euros', r4.mode === 'life' && v4 && v4.join('|') === 'Dépôt 250 f1|Frais -3.2 f1', v4);

  // ===== 5. Onglet et bouton =====
  const b5 = await page.evaluate(() => { closeSheet(); nav('placements'); setPlace('life'); return [...document.querySelectorAll('#place-body .acts button')].map((b) => b.textContent.trim()); });
  log('Onglet Assurance-vie : bouton « Relevé » pour importer', b5[0] === 'Relevé', b5);
  const hid = await page.evaluate(() => { DB.settings.modules = Mods.setOn(DB.settings.modules, 'life', false); openImport(); $('#imp_txt').value = 'Contrat Assurance-vie\nDate;Opération;Support;Montant\n15/01/2026;Versement;Fonds euros;100,00\n'; impAnalyze(); const r = impMode;
    DB.settings.modules = Mods.setOn(DB.settings.modules, 'life', true); closeSheet(); return r; });
  log('Module Assurance-vie masqué : pas d\'onglet Assurance-vie dans l\'import', hid !== 'life', hid);

  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
