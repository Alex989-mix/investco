// Parcours au doigt des nouveautés v18 : cash-flow, PEA (fiche, versements, dividendes, ISIN, 5 ans),
// immobilier complet, verrouillage par code (et empreinte simulée). Téléphone 390 px, date figée 22/10/2026.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const typeIn = async (page, sel, txt) => { await page.fill(sel, ''); await page.locator(sel).pressSequentially(txt); };
const N = (s) => String(s || '').replace(/[  ]/g, ' ');

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-10-22T14:00:00+02:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '2468' : undefined));
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); DB.settings.onboarded = true; save(); });
  const btn = (txt) => page.locator('#sheet button', { hasText: txt }).first().click().then(() => page.waitForTimeout(150));

  // ===== 1. Cash-flow et taux d'épargne =====
  await page.evaluate(() => {
    DB.movements.push({ d: '2026-10-01', p: 'Compte courant', t: 'Dépôt', q: null, pu: null, m: 2000, f: 0, n: 'Salaire' },
      { d: '2026-09-01', p: 'Compte courant', t: 'Dépôt', q: null, pu: null, m: 2000, f: 0, n: 'Salaire' },
      { d: '2026-10-05', p: 'Compte courant', p2: 'Livret A', t: 'Transfert', q: null, pu: null, m: 300, f: 0, n: '' });
    DB.expenses = DB.expenses.filter((e) => !e.d.startsWith('2026-10'));
    DB.expenses.push({ d: '2026-10-03', label: 'Loyer', amt: 600, cat: 'Logement' }, { d: '2026-10-09', label: 'Courses', amt: 250, cat: 'Courses' }, { d: '2026-10-08', label: 'PRLV BITSTACK', amt: 100, cat: 'Investissement' });
    save(); renderAll(); nav('dash');
  });
  await page.waitForTimeout(300);
  const dash = N(await page.locator('#v-dash').textContent());
  log('Tableau de bord : carte « Cash-flow d\'octobre » (revenus 2 000 €, dépenses 850 €, épargne +1 150 €, taux 57,5 %)',
    /Cash-flow d.octobre/.test(dash) && /Revenus2 000 €/.test(dash.replace(/\s+/g, '').replace(/€/g, ' €')) || (dash.includes('2 000 €') && dash.includes('850 €') && dash.includes('+1 150 €') && dash.includes('57,5 %')), dash.match(/Cash-flow.{0,200}/)?.[0]);
  log('… « dont 100 € investis », graphique 12 mois affiché', dash.includes('dont 100 € investis') && await page.locator('#cfchart').count() === 1);

  // ===== 2. PEA : fiche, versements, dividende, ISIN =====
  await page.evaluate(() => { nav('placements'); setPlace('bourse'); });
  const peaCard = N(await page.locator('#place-body').textContent());
  log('Bourse : carte PEA affichée (versements estimés, date d\'ouverture à renseigner)', peaCard.includes('PEA') && peaCard.includes('(estim.)') && peaCard.includes('date d\'ouverture à renseigner'), peaCard.slice(0, 200));
  await page.locator('#place-body .del', { hasText: 'fiche PEA' }).click(); await page.waitForTimeout(150);
  await page.fill('#pe_open', '2021-11-15'); await page.fill('#pe_bank', 'Boursorama'); await page.fill('#pe_vd', '2021-11-15'); await typeIn(page, '#pe_vm', '3 000');
  await btn('Enregistrer');
  await page.fill('#pe_vd', '2023-01-10'); await typeIn(page, '#pe_vm', '500'); await btn('Enregistrer');
  await page.evaluate(() => closeSheet());
  const P = await page.evaluate(() => peaCalc());
  // Exemple : PEA = 5 parts CW8 achetées 400 € (2 000 €) → liquidités 3 500 − 2 000 = 1 500
  log('PEA : 3 500 € versés (réels), liquidités 1 500 €, 5 ans le 15/11/2026', P.real && P.versed === 3500 && P.cash === 1500 && P.fiveYears === '2026-11-15' && !P.mature, P);
  const bourse = N(await page.locator('#place-body').textContent());
  log('… carte : « ouvert le 15/11/2021 », « 5 ans le 15/11/2026 », liquidités 1 500,00 €', bourse.includes('ouvert le 15/11/2021') && bourse.includes('5 ans le 15/11/2026') && bourse.includes('1 500,00 €'), bourse.slice(0, 400));
  // Dividende au doigt
  await page.locator('.nav a[data-v="add"]').click(); await page.waitForTimeout(100); await btn('Opération');
  await page.selectOption('#f_t', 'Dividende'); await page.fill('#f_p', 'Amundi MSCI World (CW8)'); await typeIn(page, '#f_m', '12,40');
  const hint = await page.locator('#f_h2').textContent();
  await btn('Enregistrer');
  const dv = await page.evaluate(() => { const a = DB.assets.find((x) => x.env === 'PEA'); const c = assetCalc(a); return { divs: c.divs, pru: c.pru, qty: c.qty, cash: peaCalc().cash }; });
  log('Dividende 12,40 € : PRU et quantité inchangés, liquidités du PEA +12,40 €', dv.divs === 12.4 && Math.abs(dv.pru - 400) < 1e-9 && dv.qty === 5 && dv.cash === 1512.4 && /prix de revient/.test(hint), dv);
  // ISIN : invalide refusé, valide accepté
  await page.evaluate(() => { const i = DB.assets.findIndex((x) => x.env === 'PEA'); editAsset(i); });
  await page.fill('#a_isin', 'FR0010315771'); await btn('Enregistrer');
  const bad = await page.evaluate(() => ({ open: document.querySelector('#ov').classList.contains('on'), t: document.querySelector('#toast').textContent }));
  await page.fill('#a_isin', 'fr0010315770'); await btn('Enregistrer');
  const isin = await page.evaluate(() => DB.assets.find((x) => x.env === 'PEA').isin);
  log('ISIN faux refusé avec message ; ISIN valide enregistré en majuscules', bad.open && /ISIN invalide/.test(bad.t) && isin === 'FR0010315770', { bad, isin });
  // Patrimoine : les liquidités du PEA sont comptées
  const liq = await page.evaluate(() => repartition().find((r) => r.name === 'Liquidités').val - DB.savings.filter((s) => savingCalc(s).cat === 'Liquidités').reduce((a, s) => a + s.cap, 0));
  log('Répartition : liquidités du PEA (1 512,40 €) incluses', Math.abs(liq - 1512.4) < 0.001, liq);

  // ===== 3. Immobilier complet, au doigt =====
  await page.locator('.nav a[data-v="add"]').click(); await page.waitForTimeout(100); await btn('Bien immobilier');
  await page.fill('#pr_name', 'T2 Montpellier'); await page.selectOption('#pr_type', 'Appartement'); await page.selectOption('#pr_regime', 'nu');
  await typeIn(page, '#pr_surface', '42'); await typeIn(page, '#pr_price', '180 000'); await typeIn(page, '#pr_notary', '14 000'); await typeIn(page, '#pr_works', '6 000');
  await typeIn(page, '#pr_rent', '900'); await typeIn(page, '#pr_vac', '1'); await typeIn(page, '#pr_mgmt', '7');
  await typeIn(page, '#pr_tf', '1 200'); await typeIn(page, '#pr_copro', '80'); await typeIn(page, '#pr_pno', '150'); await typeIn(page, '#pr_maint', '300');
  await typeIn(page, '#pr_val', '215 000'); await page.fill('#pr_vald', '2026-06-01');
  await btn('Enregistrer');
  const card = N(await page.locator('#place-body .card', { hasText: 'T2 Montpellier' }).first().textContent());
  log('Bien : « Appartement · 42 m² · Location nue », coût 200 000 €, plus-value +15 000 € (+7,5 %)', card.includes('Appartement · 42 m² · Location nue') && card.includes('coût 200 000 €') && card.includes('+15 000 €') && card.includes('7,5 %'), card.slice(0, 300));
  log('… rendement brut 5,4 %, net 3,3 %, loyers 9 900 €/an (vacance 1 mois), charges 3 303 €/an, cash-flow +549,75 €', card.includes('Rendement brut 5,4 % · net 3,3 %') && card.includes('9 900 €/an (vacance 1 mois)') && card.includes('3 303 €/an') && card.includes('+549,75 €'), card.slice(0, 500));
  // Résidence principale : pas de loyer
  await page.evaluate(() => editProperty(-1)); await page.fill('#pr_name', 'Maison'); await page.selectOption('#pr_regime', 'RP');
  const rentHidden = await page.evaluate(() => getComputedStyle(document.querySelector('#pr_rentwrap')).display === 'none');
  await typeIn(page, '#pr_price', '300 000'); await typeIn(page, '#pr_notary', '22 000'); await btn('Enregistrer');
  const rp = await page.evaluate(() => { const p = DB.properties.find((x) => x.name === 'Maison'); return { rent: p.rent, c: propertyCalc(p) }; });
  log('Résidence principale : champs de loyer masqués, aucun loyer ni rendement', rentHidden && rp.rent === 0 && rp.c.grossYield === 0 && rp.c.cost === 322000, rp);
  // Stockage en centimes des nouveaux champs
  const stP = await page.evaluate(() => JSON.parse(localStorage.getItem('investco_v1')).properties.find((p) => p.name === 'T2 Montpellier'));
  log('Nouveaux montants stockés en centimes (frais de notaire 1 400 000, taxe foncière 120 000), gestion en fraction', stP.notary === 1400000 && stP.taxFonciere === 120000 && stP.mgmt === 0.07 && stP.vacancy === 1, stP);

  // ===== 4. Verrouillage =====
  await page.evaluate(() => openSettings());
  await page.locator('#sheet button', { hasText: 'Activer le verrouillage par code' }).click(); await page.waitForTimeout(150);
  await page.fill('#lk_new', '2468'); await page.fill('#lk_new2', '2469'); await btn('Enregistrer');
  const mism = await page.evaluate(() => ({ en: !!(DB.settings.lock && DB.settings.lock.enabled), t: document.querySelector('#toast').textContent }));
  await page.fill('#lk_new2', '2468'); await btn('Enregistrer'); await page.waitForTimeout(400);
  const L = await page.evaluate(() => DB.settings.lock);
  log('Codes différents refusés ; code 2468 enregistré haché (jamais en clair)', !mism.en && /ne correspondent pas/.test(mism.t) && L.enabled && L.hash.length === 64 && !JSON.stringify(L).includes('2468') && L.len === 4, { mism, L: { ...L, hash: L.hash && L.hash.slice(0, 8) } });
  // Rechargement : l'écran de verrouillage s'affiche, rien n'est lisible derrière
  await page.reload(); await page.waitForTimeout(1200);
  const locked = await page.evaluate(() => ({ on: document.querySelector('#lock').classList.contains('on'), top: document.elementFromPoint(195, 400)?.closest('#lock') != null }));
  log('À l\'ouverture : écran de verrouillage par-dessus tout le contenu', locked.on && locked.top, locked);
  for (const d of '1111') await page.locator('#lk-pad button', { hasText: d }).first().click();
  await page.waitForTimeout(600);
  const wrong = await page.evaluate(() => ({ on: document.querySelector('#lock').classList.contains('on'), msg: document.querySelector('#lk-msg').textContent }));
  log('Mauvais code : refusé, « Code incorrect »', wrong.on && wrong.msg === 'Code incorrect', wrong);
  for (const d of '2468') await page.locator('#lk-pad button', { hasText: d }).first().click();
  await page.waitForTimeout(600);
  log('Bon code : appli déverrouillée', !(await page.evaluate(() => document.querySelector('#lock').classList.contains('on'))));
  // Retour dans l'appli : verrouillage immédiat (délai 0)
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  log('Retour dans l\'appli : reverrouillée', await page.evaluate(() => document.querySelector('#lock').classList.contains('on')));
  // 5 erreurs → attente 30 s
  for (let k = 0; k < 5; k++) for (const d of '9999') await page.locator('#lk-pad button', { hasText: d }).first().click().then(() => page.waitForTimeout(40));
  await page.waitForTimeout(500);
  for (const d of '2468') await page.locator('#lk-pad button', { hasText: d }).first().click();
  await page.waitForTimeout(400);
  const wait = await page.evaluate(() => ({ on: document.querySelector('#lock').classList.contains('on'), msg: document.querySelector('#lk-msg').textContent }));
  log('5 erreurs : même le bon code est bloqué 30 s', wait.on && /réessaie dans \d+ s/.test(wait.msg), wait);
  await page.clock.setFixedTime(new Date('2026-10-22T14:05:00+02:00')); // 30 s plus tard (et au-delà)
  for (const d of '2468') await page.locator('#lk-pad button', { hasText: d }).first().click();
  await page.waitForTimeout(600);
  log('Après 30 s : le bon code déverrouille', !(await page.evaluate(() => document.querySelector('#lock').classList.contains('on'))));
  // Empreinte simulée (WebAuthn)
  await page.evaluate(() => {
    window.PublicKeyCredential = window.PublicKeyCredential || function () {}; PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true;
    navigator.credentials.create = async () => ({ rawId: new Uint8Array([1, 2, 3, 4]).buffer }); window.__bioOk = true;
    navigator.credentials.get = async () => { if (!window.__bioOk) throw new Error('refus'); return {}; };
  });
  await page.evaluate(() => openSettings()); await page.locator('#sheet button', { hasText: 'Activer l\'empreinte' }).click(); await page.waitForTimeout(300);
  log('Empreinte activée (identifiant enregistré)', await page.evaluate(() => DB.settings.lock.bio === btoa(String.fromCharCode(1, 2, 3, 4))));
  await page.evaluate(() => { closeSheet(); lockNow(); }); await page.waitForTimeout(900);
  log('Verrouillage avec empreinte : déverrouillé par l\'empreinte', !(await page.evaluate(() => document.querySelector('#lock').classList.contains('on'))));
  // Désactivation : demande le code
  await page.evaluate(() => openSettings()); await page.locator('#sheet button', { hasText: 'Désactiver' }).last().click(); await page.waitForTimeout(700);
  log('Désactivation avec le code : verrouillage retiré', await page.evaluate(() => DB.settings.lock.enabled === false));

  // ===== 5. Migration d'une base v17.2 =====
  const mig = await page.evaluate(() => {
    const old = JSON.parse(JSON.stringify(Fin.serialize(DB))); old.meta.schema = 5; delete old.pea;
    old.properties = [{ id: 'p1', name: 'Ancien', price: 20000000, rent: 90000, charges: 15000, values: [] }]; // centimes
    localStorage.setItem('investco_v1', JSON.stringify(old)); load();
    const p = DB.properties[0]; return { schema: DB.meta.schema, pea: DB.pea, regime: p.regime, notary: p.notary, c: propertyCalc(p) };
  });
  log('Migration v17.2 : fiche PEA créée, bien existant « Location nue » avec calculs inchangés', mig.schema === 6 && mig.pea && Array.isArray(mig.pea.versements) && mig.regime === 'nu' && mig.notary === 0 && Math.abs(mig.c.grossYield - 0.054) < 1e-9 && Math.abs(mig.c.netYield - 0.045) < 1e-9, mig);

  // ===== 6. Tour : nouvelles fenêtres, aucun NaN =====
  const fails = [];
  for (const f of ['editPea()', 'editProperty(-1)', 'editProperty(0)', 'lockSetup(false)', 'openSettings()']) {
    const ok = await page.evaluate((code) => { try { eval(code); return document.querySelector('#ov').classList.contains('on'); } catch (e) { return String(e); } }, f); if (ok !== true) fails.push([f, ok]); await page.evaluate(() => closeSheet());
  }
  log('Nouvelles fenêtres : toutes s\'ouvrent', fails.length === 0, fails);
  const all = await page.evaluate(() => { let t = ''; for (const v of ['dash', 'budget', 'revente']) { nav(v); t += document.querySelector('#v-' + v).textContent; } for (const x of ['bourse', 'epargne', 'immo']) { nav('placements'); setPlace(x); t += document.querySelector('#v-placements').textContent; } return t; });
  log('Aucun « NaN », « undefined », « null » ou « Infinity » affiché', !/NaN|undefined|Infinity|\bnull\b/.test(all), (all.match(/.{30}(NaN|undefined|Infinity|\bnull\b).{30}/) || [])[0]);
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
