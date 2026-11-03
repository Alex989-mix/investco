// Parcours v28 : module Assurance-vie complète (contrats multisupports, conversion, arbitrages, frais, cours des UC, foyer fiscal).
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const near = (a, b) => Math.abs(a - b) < 0.005;

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-11-04T12:00:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); DB.settings.onboarded = true; save(); renderAll(); nav('dash'); });
  await sleep(200);

  // ===== 1. Migration et réglages =====
  const m0 = await page.evaluate(() => ({ schema: DB.meta.schema, life: DB.settings.modules.life, foyer: DB.settings.foyer, soon: MOD_SOON.map((x) => x[1]) }));
  log('Schéma 10 : module Assurance-vie actif (un produit Assurance-vie existe), foyer « seul », plus annoncé « bientôt »', m0.schema === 10 && m0.life && m0.life.on === true && m0.foyer === 'seul' && !m0.soon.some((x) => /Assurance-vie/.test(x)), m0);
  const mig = await page.evaluate(() => { const keep = JSON.stringify(DB); DB.savings = DB.savings.filter((s) => s.type !== 'Assurance-vie'); DB.settings.modules.life.on = true; delete DB.settings.foyer; MIGRATIONS[10]();
    const r = { on: DB.settings.modules.life.on, foyer: DB.settings.foyer }; DB = JSON.parse(keep); return r; });
  log('Migration 10 sans assurance-vie : module masqué (rien ne change à l\'écran)', mig.on === false && mig.foyer === 'seul', mig);

  // ===== 2. Conversion : rien ne bouge =====
  const ref = await page.evaluate(() => ({ net: consolidate().net, cap: findSaving('Assurance-vie').cap, apports: consolidate().apports, ref: yearRef(2026).auto, tax: fiscalData().totalTaxable,
    versed: savingCalc(findSaving('Assurance-vie')).versed, ops: DB.movements.filter((m) => m.p === 'Assurance-vie').length }));
  await page.evaluate(() => { nav('placements'); setPlace('life'); });
  const pl0 = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('#v-placements .subtab')].map((t) => t.textContent.trim()), conv: !!document.querySelector('#place-body button[onclick^="event.stopPropagation();convertLife"]') }));
  log('Onglet « Assurance-vie » entre Épargne et Immobilier, le produit simple propose « Convertir en contrat complet »', pl0.tabs.join() === 'Bourse,Épargne,Assurance-vie,Immobilier,Crowdfunding' && pl0.conv, pl0);
  page.once('dialog', (d) => d.accept());
  await page.evaluate(() => { productDetail('Assurance-vie'); });
  await page.locator('#sheet button', { hasText: 'Convertir en contrat complet' }).click(); await sleep(150);
  const c1 = await page.evaluate(() => { const s = findSaving('Assurance-vie'); return { life: !!s.life, funds: s.life && s.life.funds.map((f) => f.kind + ':' + f.name), rate: s.life && s.life.funds[0].rates.length,
    net: consolidate().net, cap: s.cap, apports: consolidate().apports, ref: yearRef(2026).auto, tax: fiscalData().totalTaxable, versed: savingCalc(s).versed,
    allFund: DB.movements.filter((m) => m.p === 'Assurance-vie').every((m) => m.fund === 'f1'), bak: listBackups()[0].reason, title: document.querySelector('#sheet h2').textContent }; });
  log('Conversion : un fonds en euros qui reprend le taux, toutes les opérations rattachées, copie de sécurité faite avant', c1.life && c1.funds.join() === 'euro:Fonds en euros' && c1.rate === 1 && c1.allFund && /Avant conversion/.test(c1.bak), c1);
  log('Conversion : solde, patrimoine net, apports, valeur au 1er janvier, versé et récap fiscal identiques au centime',
    near(c1.cap, ref.cap) && near(c1.net, ref.net) && near(c1.apports, ref.apports) && near(c1.ref, ref.ref) && near(c1.tax, ref.tax) && near(c1.versed, ref.versed), { ref, c1 });
  log('… la fiche du contrat s\'ouvre', c1.title === 'Assurance-vie');

  // ===== 3. Une unité de compte, un versement, un arbitrage, des frais =====
  await page.evaluate(() => { const i = DB.savings.findIndex((s) => s.name === 'Assurance-vie'); editFund(i, ''); });
  await page.fill('#u_name', 'ETF Monde'); await page.fill('#u_sym', 'cw8.pa'); await page.fill('#u_px', '100');
  await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await sleep(100);
  const f2 = await page.evaluate(() => findSaving('Assurance-vie').life.funds[1]);
  log('Support UC ajouté : symbole en majuscules, cours daté du jour', f2 && f2.id === 'f2' && f2.kind === 'uc' && f2.sym === 'CW8.PA' && f2.px === 100 && f2.pxD === '2026-11-04', f2);
  const before = await page.evaluate(() => ({ net: consolidate().net, apports: consolidate().apports }));
  await page.evaluate(() => editLifeOp(DB.savings.findIndex((s) => s.name === 'Assurance-vie'), -1, 'Dépôt'));
  await page.selectOption('#o_f', 'f2'); await page.fill('#o_m', '1000'); await page.fill('#o_q', '10');
  log('Versement sur une UC : le champ « Parts » apparaît', await page.isVisible('#o_q'));
  await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await sleep(100);
  const v1 = await page.evaluate(() => ({ net: consolidate().net, apports: consolidate().apports, uc: savingCalc(findSaving('Assurance-vie')).life.uc }));
  log('Versement de 1 000 € : apport de l\'année +1 000 €, patrimoine +1 000 €, UC = 10 parts × 100 €', near(v1.apports - before.apports, 1000) && near(v1.net - before.net, 1000) && near(v1.uc, 1000), { before, v1 });
  await page.evaluate(() => editLifeOp(DB.savings.findIndex((s) => s.name === 'Assurance-vie'), -1, 'Arbitrage'));
  log('Arbitrage : support d\'arrivée proposé', await page.isVisible('#o_f2'));
  await page.selectOption('#o_f', 'f1'); await page.selectOption('#o_f2', 'f2'); await page.fill('#o_m', '2000'); await page.fill('#o_q2', '20');
  await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await sleep(100);
  const a1 = await page.evaluate(() => { const L = savingCalc(findSaving('Assurance-vie')).life; return { net: consolidate().net, apports: consolidate().apports, euro: L.euro, uc: L.uc, units: L.funds[1].units, flows: cashFlows().length }; });
  log('Arbitrage de 2 000 € euros → UC : ni versement ni gain, patrimoine inchangé, 30 parts sur l\'UC', near(a1.net, v1.net) && near(a1.apports, v1.apports) && near(a1.uc, 3000) && a1.units === 30, a1);
  await page.evaluate(() => editLifeOp(DB.savings.findIndex((s) => s.name === 'Assurance-vie'), -1, 'Frais'));
  await page.fill('#o_m', '15');
  await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await sleep(100);
  const fr = await page.evaluate(() => ({ net: consolidate().net, apports: consolidate().apports, flows: cashFlows().length }));
  log('Frais de 15 € : la valeur baisse de 15 €, ce n\'est pas un retrait (apports et flux de performance inchangés)', near(a1.net - fr.net, 15) && near(fr.apports, a1.apports) && fr.flows === a1.flows, { a1, fr });

  // ===== 4. Cours automatique des UC (Yahoo simulé) =====
  await page.evaluate(() => { window.quoteVia = async (s) => (s === 'CW8.PA' ? { price: 110, prev: 109, cur: 'EUR' } : null); });
  await page.evaluate(() => lifeRefresh()); await sleep(200);
  const px = await page.evaluate(() => { const s = findSaving('Assurance-vie'); return { px: s.life.funds[1].px, uc: savingCalc(s).life.uc, net: consolidate().net }; });
  log('« Cours des UC » : 30 parts × 110 € = 3 300 €, patrimoine +300 €', px.px === 110 && near(px.uc, 3300) && near(px.net - fr.net, 300), px);
  const stored = await page.evaluate(() => { const st = Fin.serialize(DB).savings.find((s) => s.name === 'Assurance-vie'); return st.life.funds[1].px; });
  log('Stockage : cours de l\'UC en centimes', stored === 11000, stored);

  // ===== 5. UC sans symbole : valeur relevée =====
  await page.evaluate(() => editFund(DB.savings.findIndex((s) => s.name === 'Assurance-vie'), ''));
  await page.fill('#u_name', 'SCPI'); await page.fill('#u_val', '500'); await page.fill('#u_vald', '2026-10-31');
  await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await sleep(100);
  const sc = await page.evaluate(() => { const L = savingCalc(findSaving('Assurance-vie')).life; return L.funds[2]; });
  log('UC sans cours : valeur relevée de 500 € au 31/10 retenue', sc && sc.value === 500 && sc.src === 'val', sc);

  // ===== 6. Écrans =====
  const ui = await page.evaluate(() => { nav('placements'); setPlace('life'); const hero = document.querySelector('#place-body .h-v').textContent;
    const cap = findSaving('Assurance-vie').cap; setPlace('epargne'); const ep = [...document.querySelectorAll('#place-body .fiche .t-name')].map((x) => x.textContent);
    nav('dash'); const home = [...document.querySelectorAll('#v-dash .lgrp .fiche .t-name')].map((x) => x.textContent.trim()); return { hero, cap, ep, home }; });
  log('Onglet Assurance-vie : total du contrat ; l\'onglet Épargne ne le montre plus ; accueil : ligne « Assurance-vie »', ui.hero.replace(/\D/g, '') === String(Math.round(ui.cap)) && !ui.ep.includes('Assurance-vie') && ui.home.includes('Assurance-vie'), ui);
  await page.evaluate(() => lifeDetail(DB.savings.findIndex((s) => s.name === 'Assurance-vie')));
  const det = await page.evaluate(() => ({ funds: [...document.querySelectorAll('#sheet .lgrp .fiche .t-name')].map((x) => x.textContent), ops: [...document.querySelectorAll('#sheet table .t-name')].map((x) => x.textContent) }));
  log('Fiche du contrat : 3 supports, opérations nommées Versement / Arbitrage / Frais', det.funds.join() === 'Fonds en euros,ETF Monde,SCPI' && ['Versement', 'Arbitrage', 'Frais'].every((t) => det.ops.includes(t)), det);
  const ed = await page.evaluate(() => { const gi = DB.movements.findIndex((m) => m.t === 'Arbitrage'); editMov(gi); return { t: document.querySelector('#o_t') && document.querySelector('#o_t').value, h: document.querySelector('#sheet h2').textContent }; });
  log('Modifier une opération du contrat depuis la liste générale ouvre l\'éditeur du contrat', ed.t === 'Arbitrage', ed);
  await page.evaluate(() => closeSheet());

  // ===== 7. Masquer le module : les chiffres ne bougent pas =====
  const r7 = await page.evaluate(() => ({ net: consolidate().net, tax: fiscalData().totalTaxable }));
  const h7 = await page.evaluate(() => { DB.settings.modules = Mods.setOn(DB.settings.modules, 'life', false); save(); renderAll(); nav('dash');
    return { net: consolidate().net, tax: fiscalData().totalTaxable, tabs: Mods.placeTabs(DB.settings.modules).map((t) => t.tab), home: [...document.querySelectorAll('#v-dash .lgrp .fiche .t-name')].map((x) => x.textContent.trim()) }; });
  log('Module masqué : pas d\'onglet, contrat compté dans « Modules masqués », patrimoine et récap fiscal inchangés', !h7.tabs.includes('life') && h7.home.includes('Modules masqués') && !h7.home.includes('Assurance-vie') && near(h7.net, r7.net) && near(h7.tax, r7.tax), h7);
  await page.evaluate(() => { DB.settings.modules = Mods.setOn(DB.settings.modules, 'life', true); save(); renderAll(); });

  // ===== 8. Rachat et foyer fiscal =====
  const tx = await page.evaluate(() => { const s = findSaving('Assurance-vie');
    DB.movements.push({ d: '2026-10-01', p: s.name, t: 'Retrait', q: null, pu: null, m: 3000, f: 0, n: '', fund: 'f1' }); save();
    const V = s.cap + 3000, P = savingCalc(s).versed + 3000, part = Fin.lifeGainPart(3000, V, P), u8 = fiscalData();
    const open = s.open; s.open = '2017-01-15'; const seul = fiscalData(); s.open = open; return { part, u8: [u8.avOver8, u8.avAbat, u8.avTaxable], seul: [seul.avOver8, seul.avRachat, seul.avAbat, seul.avTaxable] }; });
  log('Rachat de 3 000 € : part de gains = rachat × (V − P) / V ; avant 8 ans elle est imposable en entier', tx.part > 0 && !tx.u8[0] && tx.u8[1] === 0 && near(tx.u8[2], tx.part), tx);
  log('… après 8 ans, couverte par l\'abattement du foyer (rien d\'imposable)', tx.seul[0] && tx.seul[1] === 3000 && near(tx.seul[2], tx.part) && near(tx.seul[3], 0), tx);
  const ab = await page.evaluate(() => { const s = findSaving('Assurance-vie'), open = s.open; s.open = '2017-01-15';
    DB.movements.push({ d: '2025-12-31', p: s.name, t: 'Intérêts', q: null, pu: null, m: 60000, f: 0, n: 'test', fund: 'f1' }, { d: '2026-10-15', p: s.name, t: 'Retrait', q: null, pu: null, m: 40000, f: 0, n: 'test', fund: 'f1' }); save();
    const seul = fiscalData(); DB.settings.foyer = 'couple'; const couple = fiscalData(); DB.settings.foyer = 'seul';
    DB.movements = DB.movements.filter((m) => m.n !== 'test'); s.open = open; save(); return { seul: seul.avAbat, couple: couple.avAbat }; });
  log('… abattement plafonné à 4 600 € (seul) ou 9 200 € (couple) quand la part de gains le dépasse', near(ab.seul, 4600) && near(ab.couple, 9200), ab);
  await page.evaluate(() => { openSettings && openSettings(); });
  const set = await page.evaluate(() => { const el = document.querySelector('#set_foyer'); return el ? [...el.options].map((o) => o.textContent) : null; });
  log('Réglages ▸ Ma situation fiscale : choix du foyer (4 600 € seul / 9 200 € couple)', set && /4\s?600/.test(set[0].replace(/ | /g, ' ')) && /9\s?200/.test(set[1].replace(/ | /g, ' ')), set);
  await page.evaluate(() => closeSheet());

  // ===== 9. Nouveau contrat depuis « Ajouter » =====
  await page.evaluate(() => quickAdd()); await sleep(80);
  const qa = await page.evaluate(() => [...document.querySelectorAll('#sheet .qadd .n')].map((x) => x.textContent));
  log('« Ajouter » propose « Contrat d\'assurance-vie »', qa.includes('Contrat d\'assurance-vie'), qa);
  await page.locator('#sheet .qadd button', { hasText: 'Contrat d\'assurance-vie' }).click(); await sleep(80);
  const n0 = await page.evaluate(() => consolidate().net);
  await page.fill('#l_name', 'Placement-direct Vie'); await page.fill('#l_bank', 'Spirica'); await page.fill('#l_open', '2025-03-10'); await page.fill('#l_cap', '5000'); await page.fill('#l_rate', '3');
  await page.locator('#sheet button', { hasText: 'Enregistrer' }).click(); await sleep(100);
  const nc = await page.evaluate(() => { const s = findSaving('Placement-direct Vie'); const c = savingCalc(s); return { cap: s.cap, life: !!s.life, rep: DB.movements.find((m) => m.p === s.name).t, net: consolidate().net, brut: c.brut, rate: c.rate }; });
  log('Nouveau contrat : 5 000 € déjà détenus (« Reprise »), fonds en euros à 3 %, patrimoine +5 000 €, intérêts estimés', nc.life && nc.cap === 5000 && nc.rep === 'Reprise' && near(nc.net - n0, 5000) && nc.rate === 0.03 && nc.brut > 140 && nc.brut < 160, nc);
  const sv = await page.evaluate(() => { const i = DB.savings.findIndex((s) => s.name === 'Placement-direct Vie'); editSaving(i); return !!document.querySelector('#l_name'); });
  log('« Modifier » d\'un contrat complet ouvre l\'éditeur du contrat (les supports ne peuvent pas être perdus)', sv);
  await page.evaluate(() => closeSheet());

  // ===== 10. Persistance =====
  await page.reload(); await sleep(400);
  const rl = await page.evaluate(() => { const s = findSaving('Assurance-vie'); return { funds: s.life.funds.length, px: s.life.funds[1].px, val: s.life.funds[2].vals[0].v, foyer: DB.settings.foyer }; });
  log('Après rechargement : supports, cours et valeurs relevées intacts', rl.funds === 3 && rl.px === 110 && rl.val === 500 && rl.foyer === 'seul', rl);

  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
