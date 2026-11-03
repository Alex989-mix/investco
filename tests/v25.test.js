// Parcours v25 : Réglages ▸ Modules (piste 2 « Catalogue »). Masquer, ajouter, réordonner, au doigt ;
// les données restent comptées dans le patrimoine et le récap fiscal ; l'accueil regroupe la valeur masquée.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const N = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = (x) => JSON.stringify(x);
const TU = /(?<!\p{L})(tu|ton|ta|tes|toi|Ajoute|Touche|Choisis|Masque|Active)(?!\p{L})/u;

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-11-03T12:00:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', (d) => d.accept());
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); DB.settings.onboarded = true;
    DB.resale = [{ name: 'iPhone 12', plat: 'Leboncoin', buyD: '2026-08-02', buy: 288, sellD: '2026-09-10', sell: 410, st: 'Vendu' }]; save(); renderAll(); nav('dash'); });
  await sleep(200);
  const ref = await page.evaluate(() => ({ net: consolidate().net, value: consolidate().value, tax: fiscalData().totalTaxable }));

  // ===== 1. Entrée dans les Réglages =====
  await page.evaluate(() => openSettings()); await sleep(150);
  log('Réglages : entrée « Modules » en tête, « 10 actifs sur 10 »', N(await page.textContent('#sheet .fiche')).includes('Modules') && N(await page.textContent('#sheet')).includes('10 actifs sur 10'));
  await page.locator('#sheet .fiche', { hasText: 'Modules' }).click(); await sleep(150);
  const s0 = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#sheet .mrow .n')].map((x) => x.textContent), tiles: document.querySelectorAll('#sheet .mtile:not(.soon)').length, soon: document.querySelectorAll('#sheet .mtile.soon').length }));
  log('Modules : 10 modules dans « Dans votre appli » (Crypto et Assurance-vie comprises), catalogue vide, 5 modules prévus', s0.rows.length === 10 && s0.tiles === 0 && s0.soon === 5 && s0.rows.includes('Crypto') && s0.rows.includes('Assurance-vie'), s0);

  // ===== 2. Masquer au doigt =====
  await page.locator('#sheet .mrow', { hasText: 'Crowdfunding' }).locator('button', { hasText: 'Masquer' }).click(); await sleep(200);
  const s1 = await page.evaluate(() => ({ on: modOn('crowd'), toast: document.querySelector('#toast').textContent, tile: [...document.querySelectorAll('#sheet .mtile:not(.soon)')].map((t) => t.textContent),
    tabs: [...document.querySelectorAll('#v-placements .subtab')].map((t) => t.textContent.trim()), net: consolidate().net, tax: fiscalData().totalTaxable, crowd: DB.crowd.length }));
  log('Masquer le Crowdfunding : onglet retiré de Placements, tuile dans le catalogue avec « données masquées »', !s1.on && !s1.tabs.includes('Crowdfunding') && s1.tile.length === 1 && /Crowdfunding/.test(s1.tile[0]) && /données masquées/.test(s1.tile[0]), s1);
  log('… message : « vos données sont conservées »', /Crowdfunding masqué.*données sont conservées/.test(s1.toast), s1.toast);
  log('… projets conservés, patrimoine net et récap fiscal inchangés', s1.crowd > 0 && Math.abs(s1.net - ref.net) < 0.005 && Math.abs(s1.tax - ref.tax) < 0.005, { s1, ref });
  await page.evaluate(() => { closeSheet(); nav('dash'); }); await sleep(150);
  const home = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#v-dash .lgrp .fiche .t-name')].map((x) => x.textContent.trim()), txt: document.querySelector('#v-dash').textContent }));
  log('Accueil : ligne « Modules masqués » qui garde la valeur dans le total', home.rows.includes('Modules masqués') && !home.rows.includes('Crowdfunding') && N(home.txt).includes('Crowdfunding · '), home.rows);
  const sum = await page.evaluate(() => [...document.querySelectorAll('#v-dash .lgrp .fiche .fv')].reduce((a, x) => a + Number(x.textContent.replace(/[^\d,-]/g, '').replace(',', '.')), 0));
  log('Accueil : la somme des lignes égale toujours le total des actifs', Math.abs(sum - Math.round(ref.value)) <= 4, { sum, value: ref.value });
  await page.locator('#v-dash .fiche', { hasText: 'Modules masqués' }).click(); await sleep(150);
  log('Toucher « Modules masqués » ouvre l\'écran Modules', N(await page.textContent('#sheet h2')) === 'Modules');

  // ===== 3. Dépendances =====
  await page.locator('#sheet .mtile', { hasText: 'Crowdfunding' }).click(); await sleep(150);
  log('Toucher une tuile du catalogue réactive le module', await page.evaluate(() => modOn('crowd') && [...document.querySelectorAll('#v-placements .subtab')].some((t) => t.textContent.trim() === 'Crowdfunding')));
  await page.locator('#sheet .mrow', { hasText: 'Épargne réglementée' }).locator('button', { hasText: 'Masquer' }).click(); await sleep(150);
  const dep = await page.evaluate(() => ({ s: modOn('savings'), c: modOn('crowd'), toast: document.querySelector('#toast').textContent }));
  log('Masquer l\'Épargne masque aussi le Crowdfunding, et le dit', !dep.s && !dep.c && /et Crowdfunding, qui en dépend/.test(dep.toast), dep);
  await page.locator('#sheet .mtile', { hasText: 'Crowdfunding' }).click(); await sleep(150);
  const dep2 = await page.evaluate(() => ({ s: modOn('savings'), c: modOn('crowd'), toast: document.querySelector('#toast').textContent }));
  log('Ajouter le Crowdfunding rajoute l\'Épargne dont il dépend', dep2.s && dep2.c && /avec Épargne réglementée/.test(dep2.toast), dep2);

  // ===== 4. Ordre des onglets =====
  const before = await page.evaluate(() => Mods.placeTabs(DB.settings.modules).map((t) => t.label));
  await page.locator('#sheet .mrow', { hasText: 'Crowdfunding' }).locator('button[aria-label^="Monter"]').click(); await sleep(150);
  const after = await page.evaluate(() => [...document.querySelectorAll('#v-placements .subtab')].map((t) => t.textContent.trim()));
  log('Flèche « Monter » : Crowdfunding passe avant Immobilier dans Placements', J(before) === J(['Bourse', 'Épargne', 'Assurance-vie', 'Immobilier', 'Crowdfunding']) && J(after) === J(['Bourse', 'Épargne', 'Assurance-vie', 'Crowdfunding', 'Immobilier']), { before, after });
  log('Premier onglet : sa flèche « Monter » est désactivée', await page.evaluate(() => document.querySelector('#sheet .mrow button[aria-label="Monter Bourse"]').disabled));

  // ===== 5. Barre du bas, zones tactiles, persistance =====
  await page.locator('#sheet .mrow', { hasText: 'Achat-revente' }).locator('button', { hasText: 'Masquer' }).click(); await sleep(150);
  log('Masquer l\'Achat-revente retire l\'onglet Revente de la barre', J(await page.evaluate(() => [...document.querySelectorAll('#nav a')].map((a) => a.textContent.trim()))) === J(['Accueil', 'Placements', 'Budget', 'Ajouter']));
  const small = await page.evaluate(() => [...document.querySelectorAll('#sheet button')].filter((b) => b.offsetParent && !b.classList.contains('hq') && b.getBoundingClientRect().height < 40).map((b) => b.textContent.trim() || b.getAttribute('aria-label')));
  log('Écran Modules : boutons d\'au moins 40 px', small.length === 0, small);
  const txt = await page.evaluate(() => document.querySelector('#sheet').innerText);
  log('Écran Modules au vouvoiement', !TU.test(txt), (txt.match(TU) || [])[0]);
  await page.reload(); await sleep(900);
  const per = await page.evaluate(() => ({ resale: modOn('resale'), tabs: Mods.placeTabs(DB.settings.modules).map((t) => t.tab), n: DB.resale.length }));
  log('Après rechargement : choix et ordre conservés, articles toujours là', !per.resale && J(per.tabs) === J(['bourse', 'epargne', 'life', 'crowd', 'immo']) && per.n === 1, per);

  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
