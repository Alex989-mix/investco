// Tests Bricks avec des projets fictifs mais réalistes. Date figée : 20/10/2026 12:30 Paris.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, detail) => { out.push({ t, ok, detail }); console.log((ok ? 'OK  ' : 'BUG ') + t + (detail ? '  →  ' + JSON.stringify(detail) : '')); };
const typeIn = async (page, sel, txt) => { await page.fill(sel, ''); await page.locator(sel).pressSequentially(txt); };

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-10-20T12:30:00+02:00' });

  // 1) Saisie à la française dans le formulaire (le champ taux d'un nouveau projet est vide)
  await page.evaluate(() => { DB.crowd = []; editCrowd(-1); });
  await page.fill('#c_name', 'Projet test virgule');
  const rateDefault = await page.evaluate(() => document.querySelector('#c_rate').value);
  await page.locator('#c_amt').pressSequentially('37,50');
  await page.locator('#c_rate').pressSequentially('10,5');
  await page.fill('#c_sub', '2026-01-31');
  await typeIn(page, '#c_dur', '24');
  await page.evaluate(() => saveCrowd(-1));
  const saved = await page.evaluate(() => DB.crowd[0]);
  log('Nouveau projet : champ taux vide (pas de « 10 » prérempli)', rateDefault === '', { champ: rateDefault });
  log('Formulaire : 37,50 € saisi avec virgule → 37,5', saved && saved.amt === 37.5, { stocké: saved && saved.amt });
  log('Formulaire : taux 10,5 % saisi avec virgule → 0,105', saved && Math.abs(saved.rate - 0.105) < 1e-12, { stocké: saved && saved.rate });

  // 1b) Avec un point, et avec séparateur de milliers
  await page.evaluate(() => { DB.crowd = []; editCrowd(-1); });
  await page.fill('#c_name', 'P2');
  await typeIn(page, '#c_amt', '1 250,00'); await typeIn(page, '#c_rate', '9.75');
  await page.evaluate(() => saveCrowd(-1));
  const saved2 = await page.evaluate(() => DB.crowd[0]);
  log('Formulaire : « 1 250,00 » et « 9.75 »', saved2 && saved2.amt === 1250 && Math.abs(saved2.rate - 0.0975) < 1e-12, saved2 && { amt: saved2.amt, rate: saved2.rate });

  // 1c) Saisie illisible : refusée, rien n'est enregistré
  await page.evaluate(() => { DB.crowd = []; editCrowd(-1); });
  await page.fill('#c_name', 'P3');
  await typeIn(page, '#c_amt', '37,5,0'); await typeIn(page, '#c_rate', '10');
  await page.evaluate(() => { try { saveCrowd(-1); } catch (e) {} });
  const n3 = await page.evaluate(() => ({ n: DB.crowd.length, bad: document.querySelector('#c_amt').classList.contains('bad'), toast: document.querySelector('#toast').textContent }));
  log('Saisie « 37,5,0 » refusée avec message, rien enregistré', n3.n === 0 && n3.bad, n3);
  await page.evaluate(() => closeSheet());

  // 1d) Réaffichage du taux
  await page.evaluate(() => { DB.crowd = [{ name: 'T', plat: 'Bricks', amt: 100, rate: 0.07, sub: '2026-01-08', dur: 12, day: 8, st: 'En cours', paid: [] }]; editCrowd(0); });
  const shownRate = await page.evaluate(() => document.querySelector('#c_rate').value);
  log('Formulaire : un taux de 7 % se réaffiche « 7 »', shownRate === '7', { affiché: shownRate });
  await page.evaluate(() => closeSheet());

  // 2) Calendrier : souscription le 31/01/2026, versement le 31, 24 mois
  const cal = await page.evaluate(() => {
    const c = { name: 'Fin de mois', plat: 'Bricks', amt: 250, rate: 0.10, sub: '2026-01-31', dur: 24, day: 31, st: 'En cours', paid: [] };
    const cc = crowdCalc(c); return { échus: cc.due.map(p => ymd(p.d)), ech: ymd(cc.ech), next: ymd(cc.next.d) };
  });
  const expectDue = ['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-30'];
  log('Calendrier 31/01 : un versement par mois, fin de mois respectée', JSON.stringify(cal.échus) === JSON.stringify(expectDue), cal);
  log('Calendrier 31/01 : échéance 31/01/2028, prochain versement 31/10/2026', cal.ech === '2028-01-31' && cal.next === '2026-10-31', cal);

  // 3) Premier versement à M+1
  const first = await page.evaluate(() => {
    const cc = crowdCalc({ name: 'X', plat: 'Bricks', amt: 1000, rate: 0.12, sub: '2026-09-15', dur: 12, day: 15, st: 'En cours', paid: [] });
    return { months: cc.due.map(p => p.mk), monthly: cc.monthly };
  });
  log('Souscrit le 15/09 : 1 versement échu, libellé octobre, 10 €', first.months.join() === '2026-10' && first.monthly === 10, first);

  // 4) Projet en retard / défaut dans le patrimoine
  const retard = await page.evaluate(() => {
    DB.crowd = [
      { name: 'A en cours', plat: 'Bricks', amt: 500, rate: 0.10, sub: '2025-10-08', dur: 24, day: 8, st: 'En cours', paid: [] },
      { name: 'B en retard', plat: 'Bricks', amt: 1500, rate: 0.11, sub: '2025-06-08', dur: 18, day: 8, st: 'Retard', paid: [] },
      { name: 'C défaut', plat: 'Bricks', amt: 200, rate: 0.11, sub: '2025-06-08', dur: 18, day: 8, st: 'Défaut', paid: [] },
      { name: 'D remboursé', plat: 'Bricks', amt: 900, rate: 0.11, sub: '2024-06-08', dur: 12, day: 8, st: 'Remboursé', paid: [] },
    ];
    const k = consolidate(); const r = repartition().find(x => x.name.startsWith('Crowd'));
    return { iI: k.iI, iV: k.iV, repartition: r.val };
  });
  log('« Retard » et « Défaut » comptés (2 200 €), « Remboursé » exclu', retard.iI === 2200 && retard.iV === 2200 && retard.repartition === 2200, retard);

  // 5) Valeur = capital (pas d'intérêts théoriques ajoutés)
  const val = await page.evaluate(() => { DB.crowd = [{ name: 'A', plat: 'Bricks', amt: 1200, rate: 0.10, sub: '2025-10-08', dur: 24, day: 8, st: 'En cours', paid: [] }]; return consolidate().iV; });
  log('Valeur Bricks = capital 1 200 €', val === 1200, { valeur: val });

  // 6) Perçu = versements pointés × montant calculé depuis le taux (au centime)
  const percu = await page.evaluate(() => {
    const c = { name: 'A', plat: 'Bricks', amt: 37.5, rate: 0.105, sub: '2026-04-08', dur: 24, day: 8, st: 'En cours', paid: ['2026-05', '2026-06'] };
    const cc = crowdCalc(c); return { mensuel: cc.monthly, perçu: cc.receivedAmt, àPointer: cc.missing };
  });
  log('37,50 € à 10,5 % : 0,33 €/mois, 2 pointés = 0,66 €, 4 à pointer', percu.mensuel === 0.33 && percu.perçu === 0.66 && percu.àPointer === 4, percu);

  // 7) Fiscalité 2026
  const fisc = await page.evaluate(() => {
    DB.crowd = [{ name: 'F', plat: 'Bricks', amt: 1200, rate: 0.10, sub: '2025-12-08', dur: 24, day: 8, st: 'En cours', paid: [] },
                { name: 'G retard', plat: 'Bricks', amt: 600, rate: 0.12, sub: '2026-04-08', dur: 12, day: 8, st: 'Retard', paid: ['2026-05', '2026-06'] }];
    return fiscalData().bricks;
  });
  // F : 10 versements de 10 € = 100 € ; G : seuls les 2 versements pointés (2 × 6 €) = 12 € → 112 €
  log('Fiscalité 2026 : 100 € (F) + 12 € reçus du projet en retard = 112 €', Math.abs(fisc - 112) < 0.001, { calculé: fisc });

  // 8) Imposition PFU par défaut sur le revenu mensuel
  const tax = await page.evaluate(() => {
    DB.crowd = [{ name: 'A', plat: 'Bricks', amt: 1200, rate: 0.10, sub: '2026-04-08', dur: 24, day: 8, st: 'En cours', paid: [] }];
    return { réglage: DB.settings.crowdTax, taux: crowdTaxRate(), pfu: DB.settings.flatTax, netMensuel: consolidate().immoMonthly };
  });
  log('Intérêts Bricks au PFU par défaut (10 € brut → 10 × (1 − PFU))', tax.réglage === 'pfu' && tax.taux === tax.pfu && Math.abs(tax.netMensuel - 10 * (1 - tax.pfu)) < 1e-9, tax);

  // 9) Nom avec guillemets et chevrons
  await page.evaluate(() => { DB.crowd = [{ name: 'Résidence "Le Lez" <B>', plat: 'Bricks', amt: 100, rate: 0.1, sub: '2026-01-08', dur: 12, day: 8, st: 'En cours', paid: [] }]; editCrowd(0); });
  const nm = await page.evaluate(() => document.querySelector('#c_name').value);
  log('Nom avec guillemets/chevrons conservé à la réédition', nm === 'Résidence "Le Lez" <B>', { relu: nm });
  await page.evaluate(() => closeSheet());

  // 10) Écran : grille de pointage pour un projet en retard, sans erreur
  const html = await page.evaluate(() => { DB.crowd = [{ name: 'R', plat: 'Bricks', amt: 600, rate: 0.1, sub: '2026-03-08', dur: 12, day: 8, st: 'Retard', paid: [] }]; renderAll(); placeImmo(); return document.querySelector('#place-body').innerHTML; });
  log('Projet « Retard » : échéancier complet affiché (12 cases, 7 échues en rouge)', html.includes('Échéancier') && (html.match(/togglePaid\(/g) || []).length === 12 && (html.match(/chk miss/g) || []).length === 7, {});

  // 11) Migration des cases pointées en v16 (décalées d'un mois)
  const mig = await page.evaluate(() => {
    DB.meta.schema = 1;
    DB.crowd = [{ name: 'M', plat: 'Bricks', amt: 500, rate: 0.10, sub: '2025-09-08', dur: 24, day: 8, st: 'En cours', paid: ['2025-09', '2025-10'] }];
    migrate(); return { paid: DB.crowd[0].paid, schema: DB.meta.schema };
  });
  log('Migration : cases v16 « 09/25, 10/25 » → « 10/25, 11/25 »', mig.paid.join() === '2025-10,2025-11' && mig.schema >= 2, mig);
  const mig2 = await page.evaluate(() => { migrate(); return DB.crowd[0].paid; });
  log('Migration : ne s\'applique qu\'une fois', mig2.join() === '2025-10,2025-11', { paid: mig2 });

  log('Aucune erreur JavaScript pendant les tests', errors.length === 0, errors);
  require('fs').writeFileSync(__dirname + '/bricks.results.json', JSON.stringify(out, null, 2));
  await browser.close();
  process.exitCode = out.every(o => o.ok) ? 0 : 1;
})();
