// Parcours v26 : premier écran « Composez votre appli » (piste 2 « Catalogue »), au doigt, sur une installation neuve.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const N = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = (x) => JSON.stringify(x);
const TU = /(?<!\p{L})(tu|ton|ta|tes|toi|Touche|Choisis|Compose)(?!\p{L})/u;
const sel = (page) => page.evaluate(() => [...document.querySelectorAll('#sheet .mtile.on .mt-n')].map((x) => x.textContent));

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-11-03T12:00:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.querySelector('#splash')?.remove());
  await page.waitForSelector('#sheet h2'); await sleep(200);
  log('Installation neuve : écran de bienvenue', N(await page.textContent('#sheet h2')) === 'Bienvenue sur Invest.co');
  await page.locator('#sheet button', { hasText: 'Partir de mes données' }).click(); await sleep(200);
  log('« Partir de mes données » ouvre « Composez votre appli » (étape 2 sur 2)', N(await page.textContent('#sheet h2')) === 'Composez votre appli' && N(await page.textContent('#sheet')).includes('Étape 2 sur 2'));
  log('Point de départ « Épargnant » : Épargne, Budget, Import ; bouton « Continuer · 3 modules »', J(await sel(page)) === J(['Épargne réglementée', 'Budget', 'Import de relevés']) && N(await page.textContent('#sheet .btn.wide')) === 'Continuer · 3 modules', await sel(page));
  await page.locator('#sheet .obp button', { hasText: 'Immobilier' }).click(); await sleep(150);
  log('Raccourci « Immobilier » : Épargne, Immobilier, Crowdfunding, Analyse, Import', J(await sel(page)) === J(['Épargne réglementée', 'Immobilier et crédits', 'Crowdfunding', 'Analyse et fiscalité', 'Import de relevés']), await sel(page));
  await page.locator('#sheet .mtile', { hasText: 'Épargne réglementée' }).click(); await sleep(150);
  log('Retirer l\'Épargne retire aussi le Crowdfunding (qui en dépend)', J(await sel(page)) === J(['Immobilier et crédits', 'Analyse et fiscalité', 'Import de relevés']) && !(await page.evaluate(() => !!document.querySelector('#sheet .obp button.on'))), await sel(page));
  await page.locator('#sheet .mtile', { hasText: 'Crowdfunding' }).click(); await sleep(150);
  log('Ajouter le Crowdfunding rajoute l\'Épargne', (await sel(page)).includes('Épargne réglementée') && (await sel(page)).includes('Crowdfunding'));
  await page.locator('#sheet .obp button', { hasText: 'Tout' }).click(); await sleep(150);
  log('Raccourci « Tout » : les 8 modules', (await sel(page)).length === 8 && N(await page.textContent('#sheet .btn.wide')) === 'Continuer · 8 modules');
  for (let k = 0; k < 10 && (await sel(page)).length; k++) { await page.locator('#sheet .mtile.on').first().click(); await sleep(80); }
  await sleep(150);
  log('Aucun module coché : « Continuer » désactivé', await page.evaluate(() => document.querySelector('#sheet .btn.wide').disabled) && N(await page.textContent('#sheet .btn.wide')) === 'Continuer · 0 module');
  const small = await page.evaluate(() => [...document.querySelectorAll('#sheet button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 40).map((b) => b.textContent.trim()));
  log('Boutons et tuiles d\'au moins 40 px', small.length === 0, small);
  log('Écran au vouvoiement', !TU.test(await page.evaluate(() => document.querySelector('#sheet').innerText)));
  await page.locator('#sheet button', { hasText: 'Retour' }).click(); await sleep(150);
  log('« Retour » ramène à la bienvenue', N(await page.textContent('#sheet h2')) === 'Bienvenue sur Invest.co');
  await page.locator('#sheet button', { hasText: 'Partir de mes données' }).click(); await sleep(150);
  await page.locator('#sheet .obp button', { hasText: 'Bourse' }).click(); await sleep(150);
  await page.locator('#sheet .btn.wide').click(); await sleep(300);
  const r = await page.evaluate(() => ({ ov: document.querySelector('#ov').classList.contains('on'), ob: DB.settings.onboarded, nav: [...document.querySelectorAll('#nav a')].map((a) => a.textContent.trim()),
    tabs: [...document.querySelectorAll('#v-placements .subtab')].map((t) => t.textContent.trim()), view: document.querySelector('.view.on').id, crypto: modOn('crypto'),
    data: [DB.assets.length, DB.movements.length, DB.crowd.length, DB.savings.map((s) => s.name)], saved: JSON.parse(localStorage.getItem('investco_v1')).settings.modules.budget.on }));
  log('Profil Bourse validé : barre Accueil, Placements, Ajouter ; onglets Bourse et Épargne ; ouverture sur Placements', !r.ov && r.ob && J(r.nav) === J(['Accueil', 'Placements', 'Ajouter']) && J(r.tabs) === J(['Bourse', 'Épargne']) && r.view === 'v-placements', r);
  log('… Crypto suit la Bourse, base vierge avec un compte courant, choix enregistré', r.crypto && J(r.data) === J([0, 0, 0, ['Compte courant']]) && r.saved === false, r);
  await page.evaluate(() => quickAdd()); await sleep(150);
  log('« Ajouter » propose seulement Opération et Importer un relevé', J(await page.evaluate(() => [...document.querySelectorAll('#sheet .qadd .n')].map((x) => x.textContent))) === J(['Opération', 'Importer un relevé']));
  await page.evaluate(() => closeSheet());
  await page.reload(); await sleep(900);
  log('Après rechargement : pas de nouvel écran de bienvenue, modules conservés', await page.evaluate(() => !document.querySelector('#ov').classList.contains('on') && !modOn('budget') && modOn('stocks')));

  // « Explorer avec les exemples » : tous les modules, comme avant
  const ctx2 = await browser.newContext({ locale: 'fr-FR' });
  const p2 = await (await openApp(browser, { fixedNow: '2026-11-03T12:00:00+01:00' })).page;
  await p2.evaluate(() => document.querySelector('#splash')?.remove()); await p2.waitForSelector('#sheet h2'); await sleep(200);
  await p2.locator('#sheet button', { hasText: 'Explorer avec les exemples' }).click(); await sleep(200);
  log('« Explorer avec les exemples » : tous les modules restent actifs', await p2.evaluate(() => Mods.ids().every((id) => modOn(id)) && [...document.querySelectorAll('#nav a')].length === 5));
  await ctx2.close();

  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
