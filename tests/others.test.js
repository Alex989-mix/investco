// Passe de test sur les autres modules, données fictives réalistes.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, detail) => { out.push({ t, ok, detail }); console.log((ok ? 'OK  ' : 'BUG ') + t + (detail ? '  →  ' + JSON.stringify(detail) : '')); };
const typeIn = async (page, sel, txt) => { await page.fill(sel, ''); await page.locator(sel).pressSequentially(txt); };

(async () => {
  const browser = await chromium.launch();
  let { page, errors } = await openApp(browser, { fixedNow: '2026-10-20T12:30:00+02:00' });

  // --- Saisie décimale dans les autres formulaires ---
  await page.evaluate(() => { DB.expenses = []; editExpense(-1); });
  await page.fill('#e_label', 'Boulangerie');
  await typeIn(page, '#e_amt', '4,20');
  await page.evaluate(() => saveExpense(-1));
  const exp = await page.evaluate(() => DB.expenses[0]?.amt);
  log('Budget : dépense « 4,20 » enregistrée à 4,20 €', exp === 4.2, { stocké: exp });

  await page.evaluate(() => editResale(-1));
  await page.fill('#x_name', 'Veste');
  await typeIn(page, '#x_buy', '12,50');
  await page.evaluate(() => saveResale(-1));
  const rs = await page.evaluate(() => DB.resale.at(-1).buy);
  log('Revente : prix d\'achat « 12,50 » enregistré à 12,50 €', rs === 12.5, { stocké: rs });

  // Saisie avec point (référence) après vidage du champ
  await page.evaluate(() => { DB.crowd = []; editCrowd(-1); });
  await page.fill('#c_name', 'P');
  await typeIn(page, '#c_amt', '37.50'); await typeIn(page, '#c_rate', '10.5');
  await page.evaluate(() => saveCrowd(-1));
  const pt = await page.evaluate(() => DB.crowd[0]);
  log('Bricks : saisie avec un point (champ vidé avant) fonctionne', pt.amt === 37.5 && Math.abs(pt.rate - 0.105) < 1e-12, { amt: pt.amt, rate: pt.rate });

  // --- Budget : dépenses récurrentes, date de prélèvement ---
  const rec = await page.evaluate(() => {
    DB.expenses = []; DB.settings.lastProc = '2026-09-25';
    DB.recurring = [{ label: 'Salle de sport', amt: 30, cat: 'Loisirs', day: 1, start: '2026-01-01', active: true },
                    { label: 'Loyer', amt: 550, cat: 'Logement', day: 5, start: '2026-01-05', active: true }];
    runRecurring(); return DB.expenses.map(e => ({ l: e.label, d: e.d, mois: ymKey(e.d) }));
  });
  const sport = rec.find(r => r.l === 'Salle de sport'), loyer = rec.find(r => r.l === 'Loyer');
  log('Récurrent le 1er : daté du 01/10 et compté en octobre', sport && sport.d === '2026-10-01' && sport.mois === '2026-10', sport);
  log('Récurrent le 5 : daté du 05/10', loyer && loyer.d === '2026-10-05', loyer);

  // --- Livret A : changement de taux en cours d'année ---
  const la = await page.evaluate(() => {
    DB.movements = [{ d: '2025-06-01', p: 'Livret A', t: 'Dépôt', q: null, pu: null, m: 10000, f: 0, n: '' }];
    DB.savings = [{ name: 'Livret A', type: 'Livret A', bank: 'B', cap: 10000, open: '2025-06-01', rate: null, tax: 'Exonéré', ceil: 22950 }];
    return savingCalc(DB.savings[0]).brut;
  });
  // Table de l'appli : 1,7 % en janvier (taux du 01/08/2025), 1,5 % du 01/02 au 31/07, 1,7 % dès le 01/08 → 12 quinzaines à 1,7 % + 12 à 1,5 % = 160,00 €
  log('Livret A 10 000 € toute l\'année : intérêts 2026 = 160,00 € (taux par quinzaine)', Math.abs(la - 160) < 0.01, { calculé: Math.round(la * 100) / 100 });

  // --- PEA : vente partielle et PRU ---
  const pea = await page.evaluate(() => {
    DB.assets = [{ name: 'ETF Test', ticker: 'XX', type: 'ETF', env: 'PEA', price: 120, sellFee: 0, cur: 'EUR' }];
    DB.movements = [{ d: '2025-01-10', p: 'ETF Test', t: 'Achat', q: 10, pu: 100, m: null, f: 0, n: '' },
                    { d: '2026-03-10', p: 'ETF Test', t: 'Vente', q: 5, pu: 150, m: null, f: 0, n: '' }];
    const c = assetCalc(DB.assets[0]); return { qty: c.qty, pru: c.pru, pm: c.pm, investiRestant: c.inv, pv: c.pv };
  });
  // Attendu : 5 parts restantes, PRU 100 €, investi restant 500 €, PV latente (120-100)×5 = 100 €
  log('PEA : après vente de 5/10 parts, PRU reste 100 €', Math.abs(pea.pru - 100) < 0.01, pea);
  log('PEA : plus-value latente = 100 €', Math.abs(pea.pv - 100) < 0.01, { pv: pea.pv });

  // PEA vs CTO : plus-value réalisée de l'année
  const real = await page.evaluate(() => {
    DB.assets.push({ name: 'Action CTO', ticker: 'YY', type: 'Action', env: 'CTO', price: 50, sellFee: 0, cur: 'EUR' });
    DB.movements.push({ d: '2025-02-01', p: 'Action CTO', t: 'Achat', q: 10, pu: 40, m: null, f: 2, n: '' },
                      { d: '2026-05-01', p: 'Action CTO', t: 'Vente', q: 4, pu: 55, m: null, f: 1, n: '' });
    const f = fiscalData(); return { pvStock: f.pvStock, realisePEA: assetCalc(DB.assets[0]).realized };
  });
  // CTO : PRU = (400 + 2) / 10 = 40,20 ; vente 4 × 55 − 1 = 219 ; PV = 219 − 160,80 = 58,20. La vente PEA (250 € de PV) n'est pas imposable.
  log('Fiscalité : PV réalisée CTO 58,20 €, vente dans le PEA exclue', Math.abs(real.pvStock - 58.2) < 0.001, real);

  // Livret A avec versement en cours d'année (règle des quinzaines + changement de taux)
  const la2 = await page.evaluate(() => {
    DB.movements = [{ d: '2025-06-01', p: 'Livret A', t: 'Dépôt', q: null, pu: null, m: 10000, f: 0, n: '' },
                    { d: '2026-03-10', p: 'Livret A', t: 'Dépôt', q: null, pu: null, m: 2400, f: 0, n: '' }];
    DB.savings = [{ name: 'Livret A', type: 'Livret A', bank: 'B', cap: 12400, open: '2025-06-01', rate: null, tax: 'Exonéré', ceil: 22950 }];
    return savingCalc(DB.savings[0]).brut;
  });
  // 10 000 € : 160,00 €. Versement 2 400 € le 10/03 → produit à partir du 16/03 : 9 quinzaines à 1,5 % + 10 à 1,7 %
  // 2 400 × (9 × 1,5 % + 10 × 1,7 %) / 24 = 30,50 € → total 190,50 €
  log('Livret A + versement du 10/03 : 190,50 €', Math.abs(la2 - 190.5) < 0.01, { calculé: Math.round(la2 * 100) / 100 });

  // Réglages : TMI 30 % → barème = 30 % + PS 18,6 % ; PFU 2026 = 31,4 % (paramètres datés)
  await page.evaluate(() => openSettings());
  await page.selectOption('#set_tmi', '0.3'); await page.selectOption('#set_crypto', 'bareme');
  await page.evaluate(() => saveSettings());
  const tx = await page.evaluate(() => ({ tmi: DB.settings.tmi, pfu: taxPFU(), bareme: taxBareme(), crypto: cryptoTaxRate(), av: taxAV() }));
  log('Réglages : TMI 30 % → barème 48,6 %, crypto au barème, PFU 31,4 %, assurance-vie 30 %', tx.tmi === 0.3 && Math.abs(tx.bareme - 0.486) < 1e-9 && tx.crypto === tx.bareme && Math.abs(tx.pfu - 0.314) < 1e-9 && Math.abs(tx.av - 0.30) < 1e-9, tx);

  // --- Date « aujourd'hui » juste après minuit ---
  await page.context().close();
  ({ page, errors } = await openApp(browser, { fixedNow: '2026-10-20T00:30:00+02:00' }));
  const td = await page.evaluate(() => ymd(today()));
  log('À 00h30 le 20/10, la date par défaut des formulaires est le 20/10', td === '2026-10-20', { obtenu: td });

  log('Aucune erreur JavaScript', errors.length === 0, errors);
  require('fs').writeFileSync(__dirname + '/others.results.json', JSON.stringify(out, null, 2));
  await browser.close();
  process.exitCode = out.every(o => o.ok) ? 0 : 1;
})();
