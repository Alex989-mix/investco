// Parcours v27 : la Crypto devient un module à part entière, masquable seule ou affichable seule.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const N = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = (x) => JSON.stringify(x);

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-11-03T12:00:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); DB.settings.onboarded = true; save(); renderAll(); nav('dash'); });
  await sleep(200);
  const ref = await page.evaluate(() => ({ net: consolidate().net, value: consolidate().value, tax: fiscalData().totalTaxable,
    crypto: DB.assets.filter(Mods.isCryptoAsset).map((a) => a.name), others: DB.assets.filter((a) => !Mods.isCryptoAsset(a)).map((a) => a.name) }));
  log('Données d\'exemple : des cryptos et des titres de bourse', ref.crypto.length > 0 && ref.others.length > 0, ref);
  const view = () => page.evaluate(() => { renderAll(); nav('placements'); setPlace('bourse');
    return { tabs: [...document.querySelectorAll('#v-placements .subtab')].map((t) => t.textContent.trim()), hero: document.querySelector('#place-body .hero3 .h-l').textContent.replace(/\?/g, '').trim(),
      names: [...document.querySelectorAll('#place-body .fiche .t-name')].map((x) => x.textContent), groups: [...document.querySelectorAll('#place-body .grp > span:first-child')].map((x) => x.textContent.replace(/\?/g, '').trim()),
      heroV: document.querySelector('#place-body .h-v').textContent, home: (nav('dash'), [...document.querySelectorAll('#v-dash .lgrp .fiche .t-name')].map((x) => x.textContent.trim())),
      net: consolidate().net, tax: fiscalData().totalTaxable }; });

  // ===== 1. Les deux actifs : comme avant =====
  const a = await view();
  log('Bourse et Crypto actives : onglet « Bourse », carte « Bourse et crypto », toutes les lignes', a.tabs[0] === 'Bourse' && a.hero.startsWith('Bourse et crypto') && J(a.names.slice().sort()) === J(ref.crypto.concat(ref.others).sort()) && a.home.includes('Bourse et crypto'), a);

  // ===== 2. Crypto masquée =====
  await page.evaluate(() => { openModules(); }); await sleep(100);
  await page.locator('#sheet .mrow', { hasText: 'Crypto' }).locator('button', { hasText: 'Masquer' }).click(); await sleep(150);
  const toast = await page.evaluate(() => document.querySelector('#toast').textContent);
  await page.evaluate(() => closeSheet());
  const b = await view();
  log('Crypto masquée au doigt : « vos données sont conservées »', /Crypto masqué.*données sont conservées/.test(toast), toast);
  log('… onglet « Bourse », carte « Bourse », plus aucune ligne ni enveloppe crypto', b.tabs[0] === 'Bourse' && /^Bourse(?! et)/.test(b.hero) && J(b.names.slice().sort()) === J(ref.others.slice().sort()) && !b.groups.some((g) => /^Crypto/.test(g)), b);
  log('… accueil : ligne « Bourse » et la crypto dans « Modules masqués »', b.home.includes('Bourse') && b.home.includes('Modules masqués') && !b.home.includes('Bourse et crypto'), b.home);
  log('… patrimoine net et récap fiscal inchangés', Math.abs(b.net - ref.net) < 0.005 && Math.abs(b.tax - ref.tax) < 0.005);

  // ===== 3. Crypto seule =====
  await page.evaluate(() => { DB.settings.modules = Mods.setOn(Mods.setOn(DB.settings.modules, 'crypto', true), 'stocks', false); save(); });
  const c = await view();
  log('Crypto seule : onglet « Crypto », carte « Crypto », seulement les cryptos, pas de fiche PEA', c.tabs[0] === 'Crypto' && /^Crypto/.test(c.hero) && J(c.names.slice().sort()) === J(ref.crypto.slice().sort()) && !c.groups.some((g) => /^PEA/.test(g)), c);
  log('… accueil : ligne « Crypto », la bourse dans « Modules masqués », total inchangé', c.home.includes('Crypto') && c.home.includes('Modules masqués') && Math.abs(c.net - ref.net) < 0.005, c.home);
  await page.evaluate(() => quickAdd()); await sleep(100);
  log('… « Ajouter » propose toujours « Opération » (une seule fois)', (await page.evaluate(() => [...document.querySelectorAll('#sheet .qadd .n')].filter((x) => x.textContent === 'Opération').length)) === 1);
  await page.evaluate(() => closeSheet());
  const sum = await page.evaluate(() => { nav('dash'); return [...document.querySelectorAll('#v-dash .lgrp .fiche .fv')].reduce((t, x) => t + Number(x.textContent.replace(/[^\d,-]/g, '').replace(',', '.')), 0); });
  log('… la somme des lignes de l\'accueil égale toujours le total des actifs', Math.abs(sum - Math.round(ref.value)) <= 5, { sum, value: ref.value });

  // ===== 4. Ni l'un ni l'autre, puis retour =====
  await page.evaluate(() => { DB.settings.modules = Mods.setOn(DB.settings.modules, 'crypto', false); save(); renderAll(); });
  const d = await page.evaluate(() => ({ tabs: Mods.placeTabs(DB.settings.modules).map((t) => t.tab), home: [...document.querySelectorAll('#v-dash .lgrp .fiche .t-name')].map((x) => x.textContent.trim()), net: consolidate().net }));
  log('Ni Bourse ni Crypto : pas d\'onglet Bourse, tout le portefeuille dans « Modules masqués »', !d.tabs.includes('bourse') && d.home.includes('Modules masqués') && !d.home.some((x) => /Bourse|Crypto/.test(x)) && Math.abs(d.net - ref.net) < 0.005, d);
  await page.evaluate(() => { DB.settings.modules = Mods.defaults(); save(); });
  const e = await view();
  log('Tout réactivé : retour à l\'identique', e.tabs[0] === 'Bourse' && e.hero.startsWith('Bourse et crypto') && e.names.length === ref.crypto.length + ref.others.length);

  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
