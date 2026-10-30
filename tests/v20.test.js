// Parcours v20 (téléphone 390 px, date figée au 29/10/2026) :
// tableau Épargne simplifié, portefeuille Bricks rémunéré branché aux projets, quinzaines expliquées,
// bulles d'aide « ? ». Vérifie surtout l'absence de double comptage et de crédit rétroactif.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const typeIn = async (page, sel, txt) => { await page.fill(sel, ''); await page.locator(sel).pressSequentially(txt); };
const N = (s) => String(s || '').replace(/[  ]/g, ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  // Base v19 (schéma 6) : projets sans identifiant, assurance-vie à taux manuel
  const { page, errors } = await openApp(browser, { fixedNow: '2026-10-29T12:00:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', (d) => d.accept());
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); DB.settings.onboarded = true; save(); });
  const btn = (txt) => page.locator('#sheet button', { hasText: txt }).first().click().then(() => sleep(200));
  const W = () => page.evaluate(() => { const w = DB.savings.find((s) => s.type === 'Portefeuille plateforme'); return w ? { name: w.name, cap: w.cap, rates: w.rates, ops: DB.movements.filter((m) => m.p === w.name).map((m) => [m.t, m.m, m.link || '', m.d]) } : null; });
  const apports = () => page.evaluate(() => consolidate().apports);

  // ===== 0. Migration d'une base v19 =====
  const mig = await page.evaluate(() => {
    const old = JSON.parse(JSON.stringify(Fin.serialize(DB))); old.meta.schema = 6;
    old.crowd.forEach((c) => { delete c.id; delete c.wallet; }); old.savings.forEach((s) => delete s.rates);
    localStorage.setItem('investco_v1', JSON.stringify(old)); load(); renderAll();
    const av = DB.savings.find((s) => s.name === 'Assurance-vie'), la = DB.savings.find((s) => s.name === 'Livret A');
    return { schema: DB.meta.schema, ids: DB.crowd.every((c) => /^c/.test(c.id)), uniq: new Set(DB.crowd.map((c) => c.id)).size === DB.crowd.length, av: av.rates, la: la.rates, laRate: savingCalc(la).rate };
  });
  log('Migration : identifiant unique sur chaque projet, taux manuel de l\'assurance-vie conservé en historique daté, Livret A toujours au taux officiel',
    mig.schema >= 7 && mig.ids && mig.uniq && JSON.stringify(mig.av) === '[{"from":"2020-09-05","rate":0.025}]' && mig.la.length === 0 && mig.laRate === 0.017, mig);

  await sleep(1500); await page.evaluate(() => closeSheet()); // fenêtre « Nouveautés » affichée après la migration
  // ===== 1. Tableau Épargne =====
  await page.evaluate(() => { nav('placements'); setPlace('epargne'); });
  // v21 : fiches (solde, taux, intérêts de l'année) ; versé net et intérêts perçus dans le détail du produit
  const fi = N(await page.evaluate(() => [...document.querySelectorAll('#place-body .fiche')].find((f) => f.textContent.includes('Livret A')).textContent));
  log('Fiche épargne : solde, taux, « Intérêts 2026 », plus de « Versé net » ni de « Gains » sur la page', fi.includes('14 520 €') && fi.includes('1,7 %') && fi.includes('Intérêts 2026') && !N(await page.textContent('#place-body')).includes('Versé net') && !N(await page.textContent('#place-body')).includes('Gains'), fi);
  await page.evaluate(() => { DB.movements.push({ d: '2025-12-31', p: 'LDDS', t: 'Intérêts', q: null, pu: null, m: 85.4, f: 0, n: '' }, { d: '2026-02-01', p: 'LDDS', t: 'Ajustement', q: null, pu: null, m: 50, f: 0, n: '' }); save(); renderAll(); nav('placements'); setPlace('epargne'); });
  const ldds = N(await page.evaluate(() => { productDetail('LDDS'); return document.querySelector('#sheet').textContent; }));
  log('Intérêts perçus = opérations « Intérêts » seulement (85 €), l\'ajustement de 50 € n\'en fait pas partie', /Intérêts perçus\s*85 €/.test(ldds), ldds.slice(0, 300));
  log('Le montant versé net reste dans la fiche du produit', N(await page.evaluate(() => { productDetail('LDDS'); return document.querySelector('#sheet').textContent; })).includes('Versé net'));
  await page.evaluate(() => closeSheet());

  // ===== 2. Quinzaines =====
  const la = N(await page.evaluate(() => [...document.querySelectorAll('#place-body .fiche')].find((r) => r.textContent.includes('Livret A')).textContent));
  log('Livret A : « Versé ce jour : intérêts dès le 1 nov. » (aujourd\'hui 29/10)', la.includes('Versé ce jour : intérêts dès le 1 nov.'), la);
  log('Ancienne note technique sur les quinzaines retirée de la page', !N(await page.textContent('#place-body')).includes('1er/16 suivant'));
  await page.locator('#place-body .fiche', { hasText: 'Livret A' }).first().locator('.hq').click(); await sleep(150);
  const hq = N(await page.textContent('#hlp'));
  log('« ? » du Livret A : explication avec exemples (versé le 10 mars → dès le 16 mars ; retiré le 20 mars → plus depuis le 16 mars ; 31 décembre)',
    await page.evaluate(() => document.querySelector('#hlp').classList.contains('on')) && hq.includes('Versé le 10 mars → intérêts dès le 16 mars') && hq.includes('Retiré le 20 mars → plus d\'intérêts depuis le 16 mars') && hq.includes('31 décembre'), hq.slice(0, 300));
  await page.click('#hlp button'); await sleep(100);
  log('« Compris » ferme l\'aide', !(await page.evaluate(() => document.querySelector('#hlp').classList.contains('on'))));

  // ===== 3. Création du portefeuille Bricks depuis le crowdfunding =====
  await page.evaluate(() => setPlace('crowd'));
  log('Crowdfunding sans portefeuille : carte « Portefeuille de la plateforme » avec « + Créer »', N(await page.textContent('#place-body')).includes('Portefeuille de la plateforme'));
  await page.locator('#place-body button', { hasText: '+ Créer' }).click(); await sleep(200);
  const pre = await page.evaluate(() => ({ n: $('#s_name').value, t: $('#s_type').value, r: $('#s_rate').value, tax: $('#s_tax').value }));
  log('Formulaire prérempli : Portefeuille Bricks, type « Portefeuille plateforme », 2,4 %, PFU', pre.n === 'Portefeuille Bricks' && pre.t === 'Portefeuille plateforme' && pre.r === '2,4' && pre.tax === 'PFU standard', pre);
  await typeIn(page, '#s_cap', '1 000'); await btn('Enregistrer');
  let w = await W();
  log('Portefeuille créé : solde 1 000 €, taux daté 2,4 % depuis aujourd\'hui', w && w.cap === 1000 && JSON.stringify(w.rates) === '[{"from":"2026-10-29","rate":0.024}]', w);
  const est = await page.evaluate(() => { const s = DB.savings.find((x) => x.type === 'Portefeuille plateforme'); return { y: savingYearInterest(s), net: r2(savingCalc(s).net) }; });
  log('Intérêts au jour le jour : 1 000 € × 2,4 % × 64 j / 365 = 4,21 € brut, 2,89 € net (PFU 31,4 %)', est.y === 4.21 && est.net === 2.89, est);
  await page.evaluate(() => { nav('placements'); setPlace('crowd'); });
  const card = N(await page.textContent('#place-body'));
  log('Carte du portefeuille : solde disponible, intérêts 2026, courus, boutons', card.includes('Portefeuille Bricks') && card.includes('Solde disponible') && card.includes('1 000,00 €') && card.includes('+ Intérêts reçus'), card.slice(card.indexOf('Portefeuille Bricks'), card.indexOf('Portefeuille Bricks') + 260));

  // ===== 4. Nouveau projet payé depuis le portefeuille =====
  const ap0 = await apports();
  await page.evaluate(() => editCrowd(-1));
  log('Nouveau projet : portefeuille présélectionné, « Payé depuis ce portefeuille » coché', await page.evaluate(() => $('#c_wallet').value === 'Portefeuille Bricks' && $('#c_debit').checked));
  await typeIn(page, '#c_name', 'Résidence Nantes'); await typeIn(page, '#c_amt', '300'); await typeIn(page, '#c_rate', '12');
  await page.fill('#c_sub', '2026-06-29'); await typeIn(page, '#c_dur', '24'); await typeIn(page, '#c_day', '8');
  await btn('Enregistrer');
  w = await W();
  log('Projet payé depuis le portefeuille : 300 € débités (solde 700 €)', w.cap === 700 && w.ops.some((o) => o[0] === 'Retrait' && o[1] === 300 && /:sub$/.test(o[2])), w);
  log('Pas de double comptage dans le gain de l\'année : apports inchangés', Math.abs((await apports()) - ap0) < 0.005, { ap0, ap1: await apports() });
  const patr = await page.evaluate(() => consolidate().net);

  // ===== 5. Coupons pointés =====
  const idx = await page.evaluate(() => DB.crowd.findIndex((c) => c.name === 'Résidence Nantes'));
  await page.evaluate((i) => togglePaid(i, '2026-07'), idx); await sleep(100);
  w = await W();
  log('Versement de juillet coché : 3,00 € brut → 2,06 € net crédités sur le portefeuille, en « Intérêts »', w.cap === 702.06 && w.ops.some((o) => o[0] === 'Intérêts' && o[1] === 2.06 && o[3] === '2026-07-08'), w);
  log('Patrimoine : +2,06 € (le coupon est un gain, pas un apport)', Math.abs((await page.evaluate(() => consolidate().net)) - patr - 2.06) < 0.005 && Math.abs((await apports()) - ap0) < 0.005);
  await page.evaluate((i) => { togglePaid(i, '2026-07'); togglePaid(i, '2026-07'); togglePaid(i, '2026-07'); }, idx);
  w = await W();
  log('Cocher / décocher plusieurs fois : jamais de doublon (état final : décoché, rien crédité)', w.cap === 700 && !w.ops.some((o) => o[0] === 'Intérêts'), w);
  await page.evaluate((i) => { togglePaid(i, '2026-07'); togglePaid(i, '2026-08'); }, idx);

  // ===== 6. Modification du projet =====
  await page.evaluate((i) => editCrowd(i), idx); await typeIn(page, '#c_amt', '400'); await btn('Enregistrer');
  w = await W();
  log('Montant modifié à 400 € : débit et coupons suivent (400 € ; 2 × 2,74 €)', w.ops.filter((o) => o[0] === 'Retrait')[0][1] === 400 && w.ops.filter((o) => o[0] === 'Intérêts').every((o) => o[1] === 2.74) && w.ops.filter((o) => o[0] === 'Intérêts').length === 2, w);
  await page.evaluate((i) => editCrowd(i), idx); await page.selectOption('#c_st', 'Remboursé'); await btn('Enregistrer');
  w = await W();
  log('Passage à « Remboursé » : capital de 400 € recrédité sur le portefeuille', w.ops.some((o) => o[0] === 'Dépôt' && o[1] === 400 && /:cap$/.test(o[2])), w);
  log('Remboursement neutre pour les apports', Math.abs((await apports()) - ap0) < 0.005, { ap0, a: await apports() });
  await page.evaluate((i) => editCrowd(i), idx); await page.selectOption('#c_st', 'En cours'); await btn('Enregistrer');
  log('Retour à « En cours » : capital retiré du portefeuille', !(await W()).ops.some((o) => /:cap$/.test(o[2])));

  // ===== 7. Projet existant relié au portefeuille : rien de rétroactif =====
  const ex = await page.evaluate(() => DB.crowd.findIndex((c) => c.name === 'Résidence Montpellier'));
  await page.evaluate((i) => { DB.crowd[i].paid = ['2025-10', '2025-11', '2025-12']; save(); editCrowd(i); }, ex);
  const capBefore = (await W()).cap;
  log('Projet existant : « Payé depuis ce portefeuille » décoché par défaut', await page.evaluate(() => !$('#c_debit').checked));
  await page.selectOption('#c_wallet', 'Portefeuille Bricks'); await btn('Enregistrer');
  log('Projet existant relié : ni débit ni coupons passés ajoutés (le solde saisi les contient déjà)', (await W()).cap === capBefore, { capBefore, w: await W() });
  await page.evaluate((i) => togglePaid(i, '2026-01'), ex);
  log('… mais le prochain versement coché est bien crédité (500 € × 10 % ÷ 12 = 4,17 € → 2,86 € net)', Math.abs((await W()).cap - capBefore - 2.86) < 0.005, await W());
  await page.evaluate((i) => markRepaid(i), ex);
  log('« Capital reçu » : 500 € recrédités', Math.abs((await W()).cap - capBefore - 2.86 - 500) < 0.005);

  // ===== 8. Suppression d'un projet relié =====
  await page.evaluate((i) => delCrowd(i), idx);
  w = await W();
  log('Suppression du projet : ses opérations automatiques disparaissent du portefeuille', !w.ops.some((o) => o[2].includes(':sub') && o[1] === 400) && !(await page.evaluate(() => DB.crowd.some((c) => c.name === 'Résidence Nantes'))), w);

  // ===== 9. Rémunération du portefeuille =====
  await page.evaluate(() => { nav('placements'); setPlace('crowd'); });
  await page.locator('#place-body button', { hasText: '+ Intérêts reçus' }).click(); await sleep(200);
  const f = await page.evaluate(() => ({ t: $('#f_t').value, p: $('#f_p').value, m: $('#f_m').value }));
  log('« + Intérêts reçus » : opération Intérêts préremplie (montant estimé, à corriger)', f.t === 'Intérêts' && f.p === 'Portefeuille Bricks' && f.m !== '', f);
  await typeIn(page, '#f_m', '0,45'); await btn('Enregistrer');
  const acc = await page.evaluate(() => walletAccrued(DB.savings.find((s) => s.type === 'Portefeuille plateforme')));
  log('Après saisie : intérêts courus repartent de demain (0 €)', acc.amt === 0 && acc.from === '2026-10-30', acc);
  log('Intérêts perçus du portefeuille dans le tableau Épargne', await page.evaluate(() => { nav('placements'); setPlace('epargne'); const w = DB.savings.find((x) => x.type === 'Portefeuille plateforme'); productDetail(w.name); const t = document.querySelector('#sheet').textContent; closeSheet(); return savingCalc(w).received >= 0.45 && t.includes('Intérêts perçus'); }));

  // ===== 10. Changement de taux daté =====
  const wi = await page.evaluate(() => DB.savings.findIndex((s) => s.type === 'Portefeuille plateforme'));
  const y0 = await page.evaluate((i) => savingYearInterest(DB.savings[i]), wi);
  await page.evaluate((i) => editSaving(i), wi); await typeIn(page, '#s_rate', '2'); await page.fill('#s_rated', '2026-11-01'); await btn('Enregistrer');
  w = await W();
  const y1 = await page.evaluate((i) => savingYearInterest(DB.savings[i]), wi);
  log('Nouveau taux 2 % au 1er novembre : ajouté à l\'historique (2,4 % conservé), estimation en baisse', w.rates.length === 2 && w.rates.some((r) => r.rate === 0.024) && w.rates.some((r) => r.from === '2026-11-01' && r.rate === 0.02) && y1 < y0, { w: w.rates, y0, y1 });
  await page.evaluate((i) => editSaving(i), wi);
  log('Historique des taux affiché dans la fiche', N(await page.textContent('#sheet')).includes('2,4 % depuis le 29/10/2026') && N(await page.textContent('#sheet')).includes('2 % depuis le 01/11/2026'));

  // ===== 11. Bulles d'aide =====
  await typeIn(page, '#s_name', 'Portefeuille Bricks (saisie)');
  await page.locator('#sheet .hq').first().click(); await sleep(150);
  log('« ? » dans un formulaire : l\'aide s\'ouvre par-dessus, le formulaire et la saisie restent', await page.evaluate(() => document.querySelector('#hlp').classList.contains('on') && document.querySelector('#ov').classList.contains('on') && $('#s_name').value === 'Portefeuille Bricks (saisie)'));
  await page.keyboard.press('Escape'); await sleep(100);
  log('Échap ferme l\'aide', !(await page.evaluate(() => document.querySelector('#hlp').classList.contains('on'))));
  await page.evaluate(() => closeSheet());
  const keys = await page.evaluate(() => { const bad = []; Object.keys(HELP).forEach((k) => { try { showHelp(k); const t = document.querySelector('#hlp-b').textContent; if (t.length < 40 || /undefined|NaN|\$\{/.test(t)) bad.push(k); } catch (e) { bad.push(k + ':' + e); } }); hideHelp(); return { n: Object.keys(HELP).length, bad }; });
  log('Toutes les fiches d\'aide (' + keys.n + ') s\'affichent, sans « undefined » ni « NaN »', keys.bad.length === 0 && keys.n >= 20, keys);
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const used = [...new Set([...src.matchAll(/hq\('([a-zA-Z]+)'\)/g)].map((m) => m[1]))];
  const missing = await page.evaluate((u) => u.filter((k) => !HELP[k]), used);
  log('Chaque « ? » de l\'appli a son explication', missing.length === 0, missing);
  const views = await page.evaluate(() => { const r = {}; for (const [v, t] of [['dash'], ['budget'], ['revente'], ['placements', 'bourse'], ['placements', 'epargne'], ['placements', 'crowd']]) { nav(v); if (t) setPlace(t); const el = document.querySelector('#v-' + v); r[v + (t || '')] = el.querySelectorAll('.hq').length; } return r; });
  log('« ? » présents sur les écrans (budget, revente, bourse, épargne, immo)', views.budget > 0 && views.revente > 0 && views.placementsbourse > 0 && views.placementsepargne > 0 && views.placementscrowd > 0, views);
  const txt = await page.evaluate(() => { let t = ''; for (const v of ['dash', 'budget', 'revente']) { nav(v); t += document.querySelector('#v-' + v).textContent; } for (const x of ['bourse', 'epargne', 'immo', 'crowd']) { nav('placements'); setPlace(x); t += document.querySelector('#v-placements').textContent; } return t; });
  log('Pages allégées : les longues explications ne sont plus affichées en clair', !/Touche ✎ pour modifier|Les récurrentes se déduisent automatiquement|Le versement mensuel est calculé depuis le taux annuel|Coût = prix d'achat \+ frais/.test(txt));
  log('Aucun « NaN », « undefined » ou « Infinity » affiché', !/NaN|undefined|Infinity/.test(txt), (txt.match(/.{30}(NaN|undefined|Infinity).{30}/) || [])[0]);
  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
