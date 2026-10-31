// Parcours v22 : nouveau design (carte hero, répartition sur l'accueil, lignes groupées),
// zones tactiles d'au moins 44 px et vouvoiement de toute l'interface.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const N = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Tutoiement : pronoms et impératifs de la 2e personne du singulier
const TU = /(?<!\p{L})(tu|ton|ta|tes|toi|t'as|t'a|t'ont|Ajoute|Touche|Coche|Saisis|Laisse|Choisis|Vérifie|Entre ton|Appuie|Fixe un|Indique|Corrige|Colle|Ouvre|Reviens|Suis)(?!\p{L})/u;

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-10-30T12:00:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', (d) => d.accept());
  // Données d'exemple complétées comme pour le guide : un studio LMNP à crédit, des dépenses du mois et des budgets
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); DB.settings.onboarded = true;
    DB.settings.catBudgets = { Courses: 300, Restau: 100, Loisirs: 80 };
    [['03', 'Carrefour', 82.4, 'Courses'], ['09', 'Lidl', 46.1, 'Courses'], ['11', 'Restaurant', 38, 'Restau'], ['18', 'Sushi', 74.5, 'Restau'], ['12', 'Cinéma', 24, 'Loisirs']].forEach(([d, label, amt, cat]) => DB.expenses.push({ d: '2026-10-' + d, label, amt, cat }));
    DB.properties = [{ id: 'p1', name: 'Studio Lyon 7e', type: 'Appartement', regime: 'LMNP', surface: 24, price: 128000, notary: 9600, works: 6500, buyD: '2023-05-15', rent: 690, vacancy: 0.5, mgmt: 0.07, charges: 0, copro: 65, taxFonciere: 720, pno: 110, maintenance: 250, values: [{ d: '2023-05-15', v: 128000 }, { d: '2026-09-30', v: 139000 }] }];
    DB.loans = [{ id: 'l1', name: 'Crédit studio', capital: 120000, rate: 0.0385, months: 240, start: '2023-06-01', insurance: 18, propertyId: 'p1' }];
    save(); renderAll(); nav('dash'); });
  await sleep(300);

  // ===== 1. Accueil =====
  const home = N(await page.textContent('#v-dash'));
  log('Accueil : carte patrimoine avec les 3 chiffres (Disponible, Revenus passifs, Épargné en octobre)', await page.evaluate(() => !!document.querySelector('#v-dash .hero3 .h-st')) && home.includes('Disponible') && home.includes('Revenus passifs') && home.includes('Épargné en octobre'), home.slice(0, 300));
  const classes = await page.evaluate(() => [...document.querySelectorAll('#v-dash .lgrp .fiche .t-name')].map((x) => x.textContent.trim()));
  log('Accueil : « Où est votre argent » liste les classes (Immobilier, Épargne, Bourse et crypto, Crowdfunding)', home.includes('Où est votre argent') && ['Immobilier', 'Épargne', 'Bourse et crypto', 'Crowdfunding'].every((c) => classes.includes(c)), classes);
  const sumOk = await page.evaluate(() => { const c = consolidate(); return Math.abs(c.reValue + c.sV + c.bV + c.iV - c.value) < 0.02; });
  log('Accueil : la somme des classes égale le total des actifs', sumOk);
  log('Accueil : barre de répartition affichée', await page.evaluate(() => document.querySelectorAll('#v-dash .stack > span').length >= 4));
  await page.locator('#v-dash .lgrp .fiche', { hasText: 'Épargne' }).first().click(); await sleep(250);
  log('Toucher « Épargne » ouvre Placements ▸ Épargne', await page.evaluate(() => document.querySelector('#v-placements').classList.contains('on') && placeTab === 'epargne'));

  // ===== 2. Placements : carte hero et rangée d'actions sur chaque onglet =====
  for (const [t, label] of [['bourse', 'Bourse et crypto'], ['epargne', 'Épargne et liquidités'], ['immo', 'Immobilier'], ['crowd', 'Crowdfunding']]) {
    await page.evaluate((x) => setPlace(x), t); await sleep(150);
    const r = await page.evaluate(() => ({ hero: document.querySelector('#place-body .hero3 .h-l')?.textContent || '', acts: document.querySelectorAll('#place-body .acts .btn').length, table: !!document.querySelector('#place-body table') }));
    log(`Placements ▸ ${label} : carte hero, boutons d'action, aucun tableau`, r.hero.includes(label) && r.acts >= 1 && !r.table, r);
  }
  await page.evaluate(() => setPlace('epargne')); await sleep(150);
  const grp = await page.evaluate(() => [...document.querySelectorAll('#place-body .grp > span')].map((g) => g.textContent.trim()));
  log('Épargne : comptes groupés (Épargne réglementée, Assurance-vie, Liquidités)', JSON.stringify(grp) === '["Épargne réglementée","Assurance-vie","Liquidités"]', grp);
  const la = N(await page.locator('#place-body .fiche', { hasText: 'Livret A' }).first().textContent());
  log('Livret A : solde, taux, plafond et intérêts de l\'année sur la ligne', /14 520 €/.test(la) && la.includes('1,7 %') && la.includes('plafond 22 950 €') && /Intérêts 2026 : \d/.test(la), la);
  await page.evaluate(() => setPlace('bourse')); await sleep(150);
  log('Bourse : sous-totaux PEA, Compte-titres, Crypto dans la carte hero', N(await page.textContent('#place-body .hero3 .h-st')).match(/PEA.*Compte-titres.*Crypto/) !== null, N(await page.textContent('#place-body .hero3')));

  // ===== 3. Budget en lignes =====
  await page.evaluate(() => { nav('budget'); budMonth = 0; renderBudget(); }); await sleep(200);
  const bud = N(await page.textContent('#v-budget'));
  log('Budget : carte hero (compte courant, mois, entrées, dépenses) et « Prévu vs réel » en lignes', await page.evaluate(() => !!document.querySelector('#v-budget .hero3 .bud-nav') && !document.querySelector('#v-budget table')) && bud.includes('Entrées') && bud.includes('Prévu vs réel'), bud.slice(0, 300));
  log('Budget : catégorie dépassée signalée (« Budget Restau dépassé »)', bud.includes('Budget Restau dépassé') && bud.includes('dépassé de 13 €'), (bud.match(/Restau.{0,80}/) || [])[0]);
  await page.locator('#v-budget .bud-nav button').first().click(); await sleep(200);
  log('Budget : ‹ affiche le mois précédent', N(await page.textContent('#v-budget .bud-nav')).includes('septembre'));
  await page.evaluate(() => { budMonth = 0; renderBudget(); });

  // ===== 4. Zones tactiles =====
  const sizes = await page.evaluate(() => { nav('placements'); setPlace('epargne');
    const h = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height));
    return { top: h('.top .btn.icon'), tabs: h('.subtab'), acts: h('#place-body .acts .btn'), nav: h('.nav a') }; });
  log('Boutons de l\'en-tête ≥ 40 px, onglets et boutons d\'action ≥ 44 px', sizes.top.every((x) => x >= 40) && sizes.tabs.every((x) => x >= 44) && sizes.acts.every((x) => x >= 44), sizes);

  // ===== 5. Vouvoiement =====
  const texts = await page.evaluate(() => { const T = [];
    for (const v of ['dash', 'budget', 'revente']) { nav(v); T.push([v, document.querySelector('#v-' + v).innerText]); }
    for (const t of ['bourse', 'epargne', 'immo', 'crowd']) { nav('placements'); setPlace(t); T.push([t, document.querySelector('#v-placements').innerText]); }
    T.push(['verrou', document.querySelector('#lock').innerText]);
    for (const k of Object.keys(HELP)) { try { T.push(['aide ' + k, HELP[k][0] + ' ' + HELP[k][1]().replace(/<[^>]+>/g, ' ')]); } catch (e) { T.push(['aide ' + k, '']); } }
    openSettings(); T.push(['réglages', document.querySelector('#sheet').innerText]); closeSheet();
    openGuide(); T.push(['guide', document.querySelector('#sheet').innerText]); closeSheet();
    openImport(); T.push(['import', document.querySelector('#sheet').innerText]); closeSheet();
    quickAdd(); T.push(['ajouter', document.querySelector('#sheet').innerText]); closeSheet();
    return T; });
  const tu = texts.map(([k, t]) => { const m = t.match(TU); return m ? k + ' : « ' + t.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, ' ') + ' »' : null; }).filter(Boolean);
  log(`Vouvoiement : aucun tutoiement sur ${texts.length} écrans, fenêtres et aides`, tu.length === 0, tu.slice(0, 5));
  log('Écran de verrouillage : « Saisissez votre code »', N(await page.textContent('#lk-sub')) === 'Saisissez votre code');
  const notes = await page.evaluate(() => (self.APP_RELEASE.notes || []).join(' '));
  log('Notes de la version au vouvoiement', !TU.test(notes), notes.slice(0, 200));

  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
