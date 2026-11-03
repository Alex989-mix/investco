// Parcours v24 : registre des modules. Avec les réglages par défaut l'appli est identique à la v22 ;
// masquer un module ne change ni le patrimoine net, ni le récap fiscal, ni les données enregistrées.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = (x) => JSON.stringify(x);

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-11-03T12:00:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', (d) => d.accept());
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); DB.settings.onboarded = true;
    DB.resale = [{ name: 'iPhone 12', plat: 'Leboncoin', buyD: '2026-08-02', buy: 288, sellD: '2026-09-10', sell: 410, st: 'Vendu' }];
    DB.properties = [{ id: 'p1', name: 'Studio', type: 'Appartement', regime: 'LMNP', price: 128000, notary: 9600, works: 0, buyD: '2023-05-15', rent: 690, vacancy: 0, mgmt: 0, charges: 0, copro: 0, taxFonciere: 0, pno: 0, maintenance: 0, values: [] }];
    DB.loans = [{ id: 'l1', name: 'Crédit studio', capital: 100000, rate: 0.0385, months: 240, start: '2023-06-01', insurance: 0, propertyId: 'p1' }];
    save(); renderAll(); nav('dash'); });
  await sleep(250);

  // ===== 1. Migration 8 → 9 : tous les modules actifs, rien ne change à l'écran =====
  const mig = await page.evaluate(() => { const old = JSON.parse(JSON.stringify(Fin.serialize(DB))); old.meta.schema = 8; delete old.settings.modules;
    localStorage.setItem('investco_v1', JSON.stringify(old)); return true; });
  await page.reload(); await sleep(900);
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); });
  const m = await page.evaluate(() => ({ schema: DB.meta.schema, mods: DB.settings.modules, ids: Mods.ids(), bak: listBackups().map((b) => b.reason) }));
  log('Migration 8 → 9 : réglages des modules créés, tous les modules actifs', m.schema >= 9 && m.ids.every((id) => m.mods[id] && m.mods[id].on === true), m);
  log('… copie de sécurité faite avant la migration', m.bak.some((r) => /schéma 8 → \d+/.test(r)), m.bak);
  const ui = await page.evaluate(() => ({ nav: [...document.querySelectorAll('#nav a')].map((a) => a.textContent.trim()), on: document.querySelector('#nav a.on')?.dataset.v,
    tabs: (nav('placements'), [...document.querySelectorAll('#v-placements .subtab')].map((t) => t.textContent.trim())),
    add: (quickAdd(), [...document.querySelectorAll('#sheet .qadd .n')].map((x) => x.textContent)) }));
  await page.evaluate(() => { closeSheet(); nav('dash'); });
  log('Écran identique à la v22 : barre Accueil, Placements, Budget, Revente, Ajouter', J(ui.nav) === J(['Accueil', 'Placements', 'Budget', 'Revente', 'Ajouter']) && ui.on === 'dash', ui);
  log('… sous-onglets Bourse, Épargne, Assurance-vie (v28, une assurance-vie existe), Immobilier, Crowdfunding', J(ui.tabs) === J(['Bourse', 'Épargne', 'Assurance-vie', 'Immobilier', 'Crowdfunding']), ui.tabs);
  log('… 9 entrées dans « Ajouter » (v28 : contrat d\'assurance-vie)', ui.add.length === 9 && ui.add[0] === 'Opération' && ui.add[8] === 'Importer un relevé', ui.add);
  await page.locator('#nav a', { hasText: 'Budget' }).click(); await sleep(150);
  log('La barre générée fonctionne : « Budget » ouvre le Budget et s\'allume', await page.evaluate(() => document.querySelector('#v-budget').classList.contains('on') && document.querySelector('#nav a.on').dataset.v === 'budget'));
  await page.locator('#nav a', { hasText: 'Ajouter' }).click(); await sleep(150);
  log('« Ajouter » ouvre la fenêtre d\'ajout', await page.evaluate(() => document.querySelector('#ov').classList.contains('on')));
  await page.evaluate(() => closeSheet());

  // ===== 2. Masquer un module ne change jamais les chiffres =====
  const R = await page.evaluate(() => { const ref = { net: consolidate().net, tax: fiscalData().totalTaxable, data: JSON.stringify(Object.assign({}, Fin.serialize(DB), { settings: null, meta: null })) };
    const res = [];
    for (const id of Mods.ids()) { DB.settings.modules = Mods.setOn(Mods.defaults(), id, false); renderAll();
      res.push({ id, net: consolidate().net, tax: fiscalData().totalTaxable }); }
    DB.settings.modules = Mods.defaults(); renderAll();
    const after = JSON.stringify(Object.assign({}, Fin.serialize(DB), { settings: null, meta: null }));
    return { ref, res, same: after === ref.data }; });
  const bad = R.res.filter((x) => Math.abs(x.net - R.ref.net) > 0.005 || Math.abs(x.tax - R.ref.tax) > 0.005);
  log(`Patrimoine net identique quel que soit le module masqué (${R.res.length} cas, ${Math.round(R.ref.net)} €)`, bad.length === 0 && R.res.length === 10, bad);
  log('Récap fiscal identique quel que soit le module masqué', bad.length === 0);
  log('Masquer puis réactiver chaque module : données enregistrées identiques à l\'octet près', R.same);

  // ===== 3. Ce que l'on voit avec moins de modules =====
  const S = await page.evaluate(() => { const r = {};
    DB.settings.modules = Mods.setOn(Mods.setOn(Mods.defaults(), 'budget', false), 'resale', false); renderAll();
    r.navNoBud = [...document.querySelectorAll('#nav a')].map((a) => a.textContent.trim());
    placeTab = 'crowd'; DB.settings.modules = Mods.setOn(DB.settings.modules, 'crowd', false); renderPlacements(); nav('placements');
    r.tabsNoCrowd = [...document.querySelectorAll('#v-placements .subtab')].map((t) => t.textContent.trim()); r.placeTab = placeTab;
    r.body = !!document.querySelector('#place-body .hero3');
    quickAdd(); r.addNoCrowd = [...document.querySelectorAll('#sheet .qadd .n')].map((x) => x.textContent); closeSheet();
    const none = {}; Mods.ids().forEach((id) => { none[id] = { on: false, order: 10 }; }); DB.settings.modules = none; renderAll(); nav('placements');
    r.navNone = [...document.querySelectorAll('#nav a')].map((a) => a.textContent.trim()); r.emptyPlace = document.querySelector('#v-placements').textContent;
    nav('dash'); r.noAnalyse = !document.querySelector('#v-dash').textContent.includes('Évolution, performance'); r.netShown = document.querySelector('#heroval').textContent;
    r.net = consolidate().net;
    DB.settings.modules = Mods.defaults(); renderAll(); nav('dash'); return r; });
  log('Sans Budget ni Revente : barre Accueil, Placements, Ajouter', J(S.navNoBud) === J(['Accueil', 'Placements', 'Ajouter']), S.navNoBud);
  log('Onglet d\'un module masqué : on bascule sur le premier onglet actif, sans écran vide', !S.tabsNoCrowd.includes('Crowdfunding') && S.placeTab === 'bourse' && S.body, S);
  log('« Ajouter » ne propose que les modules actifs (sans Crowdfunding, Budget ni Revente : 5 entrées)', !S.addNoCrowd.includes('Projet Bricks / crowdfunding') && S.addNoCrowd.length === 5, S.addNoCrowd);
  log('Aucun module : barre Accueil et Ajouter, message clair dans Placements', J(S.navNone) === J(['Accueil', 'Ajouter']) && /Aucun module de placement actif/.test(S.emptyPlace), S);
  log('Aucun module : le patrimoine net reste complet sur l\'accueil, sans lien vers l\'Analyse', S.noAnalyse && Math.abs(S.net - R.ref.net) < 0.005, { net: S.net, ref: R.ref.net });
  const tap = await page.evaluate(() => [...document.querySelectorAll('#nav a')].map((a) => Math.round(a.getBoundingClientRect().height)));
  log('Barre générée : zones tactiles d\'au moins 44 px', tap.every((h) => h >= 44), tap);

  const vr = await page.evaluate(() => { DB.settings.modules = Mods.setOn(Mods.defaults(), 'budget', false); renderAll(); nav('dash');
    sessionStorage.setItem('investco_view', JSON.stringify({ v: 'budget', p: 'bourse', y: 0 })); viewApply(viewRead());
    const r = document.querySelector('#v-budget').classList.contains('on'); DB.settings.modules = Mods.defaults(); renderAll(); nav('dash'); return r; });
  log('Actualisation : l\'écran mémorisé d\'un module masqué depuis n\'est pas rouvert (retour à l\'accueil)', vr === false);

  // ===== 4. Sauvegarde et réimport =====
  const imp = await page.evaluate(() => { DB.settings.modules = Mods.setOn(Mods.defaults(), 'resale', false); save();
    const raw = JSON.parse(localStorage.getItem('investco_v1')); DB.settings.modules = Mods.defaults(); return raw.settings.modules.resale.on === false && raw.meta.schema >= 9; });
  log('Le choix des modules est enregistré avec les données (et part donc dans l\'export et Google Drive)', imp);

  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
