// Parcours utilisateur réels, au doigt (clics et saisies), sur écran de téléphone.
// Reproduit les problèmes signalés : livret vidé de ses opérations, nouveau projet Bricks sans cases.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push({ t, ok }); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined ? '  →  ' + JSON.stringify(d) : '')); };
const typeIn = async (page, sel, txt) => { await page.fill(sel, ''); await page.locator(sel).pressSequentially(txt); };
const sheetOpen = (page) => page.evaluate(() => document.querySelector('#ov').classList.contains('on'));

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-10-21T13:00:00+02:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', d => d.accept());
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); });
  const click = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(150); };
  const cellOf = async (name) => page.evaluate((n) => { const tr = [...document.querySelectorAll('#place-body tr')].find(r => r.textContent.includes(n)); return tr ? [...tr.children].map(td => td.textContent.replace(/[\u202f\u00a0]/g, ' ').trim()) : null; }, name);

  // ===== 1. Livret A : supprimer toutes ses opérations, au doigt =====
  await click('.nav a[data-v="placements"]');
  await page.evaluate(() => setPlace('epargne'));
  log('Données d\'exemple : Livret A à 14 520 € (inchangé par la migration)', (await cellOf('Livret A'))?.[1] === '14 520 €', await cellOf('Livret A'));
  for (let k = 0; k < 10; k++) {
    await page.evaluate(() => setPlace('epargne'));
    await page.locator('#place-body tr', { hasText: 'Livret A' }).locator('.t-name').first().click(); await page.waitForTimeout(150);
    const edit = page.locator('#sheet .del');
    if (await edit.count() === 0) { await page.evaluate(() => closeSheet()); break; }
    await edit.first().click(); await page.waitForTimeout(150);
    await page.locator('#sheet button', { hasText: 'Supprimer' }).click(); await page.waitForTimeout(150);
  }
  await page.evaluate(() => setPlace('epargne'));
  const la = await cellOf('Livret A');
  log('Livret A sans aucune opération : solde 0 €, aucun intérêt perçu', la && la[1] === '0 €' && la[4] === '—', la);
  log('Livret A sans opération : intérêts 0 €', la && /^0,00 €$/.test(la[3]), la && la[3]);

  // ===== 2. Saisir un solde dans le formulaire du produit → opération « Ajustement » =====
  await page.locator('#place-body tr', { hasText: 'Livret A' }).locator('.del').first().click(); await page.waitForTimeout(150);
  await typeIn(page, '#s_cap', '1 000,50'); await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await page.waitForTimeout(150);
  await page.evaluate(() => setPlace('epargne'));
  log('Solde saisi « 1 000,50 » → Livret A à 1 001 €', (await cellOf('Livret A'))?.[1] === '1 001 €', await cellOf('Livret A'));
  const adj = await page.evaluate(() => DB.movements.filter(m => m.p === 'Livret A').map(m => [m.t, m.m]));
  log('… enregistré comme un dépôt d\'ouverture de 1 000,50 € (versé, pas des gains)', JSON.stringify(adj) === '[["Dépôt",1000.5]]' && (await cellOf('Livret A'))[1] === '1 001 €', adj);
  // Correction ultérieure du solde → « Ajustement »
  await page.locator('#place-body tr', { hasText: 'Livret A' }).locator('.del').first().click(); await page.waitForTimeout(150);
  await typeIn(page, '#s_cap', '1 010,50'); await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await page.waitForTimeout(150);
  await page.evaluate(() => setPlace('epargne'));
  const adj2 = await page.evaluate(() => DB.movements.filter(m => m.p === 'Livret A').map(m => [m.t, m.m]));
  log('Correction du solde à 1 010,50 € → « Ajustement » de +10 €', JSON.stringify(adj2) === '[["Dépôt",1000.5],["Ajustement",10]]' && (await cellOf('Livret A'))[1] === '1 011 €', adj2);
  await page.locator('#place-body tr', { hasText: 'Livret A' }).locator('.del').first().click(); await page.waitForTimeout(150);
  await typeIn(page, '#s_cap', '1 000,50'); await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await page.waitForTimeout(150);

  // ===== 3. Renommer le livret : son solde suit =====
  await page.locator('#place-body tr', { hasText: 'Livret A' }).locator('.del').first().click(); await page.waitForTimeout(150);
  await page.fill('#s_name', 'Livret A Boursorama'); await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await page.waitForTimeout(150);
  await page.evaluate(() => setPlace('epargne'));
  log('Renommage : « Livret A Boursorama » garde ses 1 001 €', (await cellOf('Livret A Boursorama'))?.[1] === '1 001 €', await cellOf('Livret A Boursorama'));

  // ===== 4. Transfert Livret → compte courant via le bouton Ajouter =====
  const ccBefore = await page.evaluate(() => compteCourant().cap);
  await click('.nav a[data-v="add"]');
  await page.locator('#sheet button', { hasText: 'Opération' }).click(); await page.waitForTimeout(150);
  await page.selectOption('#f_t', 'Transfert');
  await page.fill('#f_p', 'Livret A Boursorama'); await page.fill('#f_p2', 'Compte courant'); await typeIn(page, '#f_m', '200');
  await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await page.waitForTimeout(150);
  const tr = await page.evaluate(() => ({ livret: DB.savings.find(s => s.name === 'Livret A Boursorama').cap, cc: compteCourant().cap }));
  log('Transfert 200 € : livret 800,50 €, compte courant +200 €', tr.livret === 800.5 && Math.abs(tr.cc - ccBefore - 200) < 0.001, { ...tr, ccAvant: ccBefore });

  // ===== 5. Dépense ajoutée puis supprimée : le compte courant revient exactement =====
  const cc0 = await page.evaluate(() => compteCourant().cap);
  await click('.nav a[data-v="add"]');
  await page.locator('#sheet button', { hasText: 'Dépense du compte courant' }).click(); await page.waitForTimeout(150);
  await page.fill('#e_label', 'Pharmacie'); await typeIn(page, '#e_amt', '12,40');
  await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await page.waitForTimeout(150);
  const cc1 = await page.evaluate(() => compteCourant().cap);
  await page.evaluate(() => { const i = DB.expenses.findIndex(e => e.label === 'Pharmacie'); editExpense(i); });
  await page.locator('#sheet button', { hasText: 'Supprimer' }).click(); await page.waitForTimeout(150);
  const cc2 = await page.evaluate(() => compteCourant().cap);
  log('Dépense 12,40 € : compte courant −12,40 € puis retour exact après suppression', Math.abs(cc0 - cc1 - 12.4) < 0.001 && cc2 === cc0, { avant: cc0, après: cc1, retour: cc2 });

  // ===== 6. Nouveau projet Bricks souscrit aujourd'hui, via le bouton Ajouter =====
  await click('.nav a[data-v="add"]');
  await page.locator('#sheet button', { hasText: 'Projet Bricks' }).click(); await page.waitForTimeout(150);
  await page.fill('#c_name', 'lalala'); await typeIn(page, '#c_amt', '100'); await typeIn(page, '#c_rate', '10');
  await page.fill('#c_sub', '2026-10-08'); await typeIn(page, '#c_dur', '24'); await typeIn(page, '#c_day', '8');
  await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await page.waitForTimeout(250);
  const card = page.locator('#place-body .card', { hasText: 'lalala' });
  const boxes = card.locator('.chk');
  log('Nouveau projet « lalala » : l\'échéancier affiche 24 cases', await boxes.count() === 24, await boxes.count());
  await boxes.first().click(); await page.waitForTimeout(150);
  const percu = await card.textContent();
  log('Cocher le 1er versement → Perçu 0,83 €', /Perçu\s*0,83\s*€/.test(percu.replace(/ | /g, ' ')), percu.match(/Perçu[^A-Za-z]*/)?.[0]);
  await page.locator('#place-body .card', { hasText: 'lalala' }).locator('.chk').first().click(); await page.waitForTimeout(150);
  log('Décocher → Perçu 0 €', /Perçu\s*0\s*€|Perçu\s*0,00\s*€/.test((await page.locator('#place-body .card', { hasText: 'lalala' }).textContent()).replace(/ | /g, ' ')));

  // ===== 7. Migration d'une base v16.1 réelle (livret vidé à −480 €, écarts hérités) =====
  const mig = await page.evaluate(() => {
    DB.meta.schema = 2;
    DB.savings = [
      { name: 'Livret A', type: 'Livret A', cap: -480, open: '2015-06-01', rate: null, tax: 'Exonéré', ceil: 22950 },
      { name: 'LDDS', type: 'LDDS', cap: 5180, open: '2018-03-12', rate: null, tax: 'Exonéré', ceil: 12000 },
      { name: 'Compte courant', type: 'Compte courant', cap: 1500, open: null, rate: null, tax: 'Exonéré', ceil: null },
    ];
    DB.movements = [{ d: '2018-03-12', p: 'LDDS', t: 'Dépôt', q: null, pu: null, m: 5000, f: 0, n: '' }];
    DB.expenses = [{ d: '2026-10-03', label: 'Courses', amt: 82, cat: 'Courses' }];
    migrate(); recalcBalances();
    return { soldes: DB.savings.map(s => [s.name, s.cap]), ajustements: DB.movements.filter(m => m.t === 'Ajustement').map(m => [m.p, m.m]), schema: DB.meta.schema };
  });
  log('Migration : Livret A −480 € → 0 €, LDDS reste 5 180 €, compte courant reste 1 500 €',
    JSON.stringify(mig.soldes) === '[["Livret A",0],["LDDS",5180],["Compte courant",1500]]' && mig.schema >= 3, mig);

  // ===== 8. Tour complet de l'appli : chaque écran et chaque formulaire s'ouvre sans erreur =====
  await page.evaluate(() => { resetData(); });
  const screens = [];
  for (const v of ['dash', 'placements', 'budget', 'revente']) { await click(`.nav a[data-v="${v}"]`); screens.push(v); }
  for (const t of ['bourse', 'epargne', 'immo']) { await page.evaluate((x) => { nav('placements'); setPlace(x); }, t); screens.push(t); }
  const forms = ['editMov(-1)', 'editMov(0)', 'editAsset(-1)', 'editAsset(0)', 'editSaving(-1)', 'editSaving(0)', 'editCrowd(-1)', 'editCrowd(0)',
    'editExpense(-1)', 'editExpense(0)', 'editRecurring(-1)', 'editRecurring(0)', 'editResale(-1)', 'editResale(0)', 'openSettings()', 'editBudgets()', 'editGoal()', 'quickAdd()', 'whatsNew(true)', 'productDetail(DB.savings[0].name)', 'productDetail(DB.assets[0].name)'];
  const formFails = [];
  for (const f of forms) { const ok = await page.evaluate((code) => { try { eval(code); return document.querySelector('#ov').classList.contains('on'); } catch (e) { return String(e); } }, f); if (ok !== true) formFails.push([f, ok]); await page.evaluate(() => closeSheet()); }
  log('Les 7 écrans et les 21 fenêtres s\'ouvrent', formFails.length === 0, formFails.length ? formFails : undefined);
  const dashTxt = await page.evaluate(() => { nav('dash'); return document.querySelector('#v-dash').textContent; });
  log('Tableau de bord : aucun « NaN », « undefined » ni « Infinity » affiché', !/NaN|undefined|Infinity/.test(dashTxt));
  const allTxt = await page.evaluate(() => { let t = ''; for (const v of ['budget', 'revente']) { nav(v); t += document.querySelector('#v-' + v).textContent; } for (const x of ['bourse', 'epargne', 'immo']) { nav('placements'); setPlace(x); t += document.querySelector('#v-placements').textContent; } return t; });
  log('Autres écrans : aucun « NaN », « undefined » ni « Infinity » affiché', !/NaN|undefined|Infinity/.test(allTxt), (allTxt.match(/.{30}(NaN|undefined|Infinity).{30}/) || [])[0]);

  log('Aucune erreur JavaScript pendant tout le parcours', errors.length === 0, errors.length ? errors : undefined);
  await browser.close();
  process.exitCode = out.every(o => o.ok) ? 0 : 1;
})();
