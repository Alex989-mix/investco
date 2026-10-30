// Parcours v21.1 : import du relevé CSV d'un Livret A (depuis le 1er janvier) sur le bon compte,
// sans double comptage, avec contrôle du solde et intérêts recalculés quinzaine par quinzaine.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const N = (s) => String(s || '').replace(/[  ]/g, ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const near = (a, b) => Math.abs(a - b) < 0.011;

const RELEVE = 'Livret A n° 12345678901\nRelevé du 01/01/2026 au 30/10/2026\nDate;Libellé;Débit;Crédit;Solde\n'
  + '31/12/2025;INTERETS 2025;;245,60;14 245,60\n15/03/2026;VIR DEPUIS COMPTE CHEQUE;;500,00;14 745,60\n'
  + '20/06/2026;RETRAIT GUICHET;300,00;;14 445,60\n10/09/2026;VERSEMENT ESPECES;;200,00;14 645,60\n';

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-10-30T12:00:00+01:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('dialog', (d) => d.accept());
  const btn = (txt) => page.locator('#sheet button', { hasText: txt }).first().click().then(() => sleep(250));
  // Situation typique : Livret A créé hier avec son solde du jour (reprise), compte courant
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet();
    const base = structuredClone(DEF);
    DB = Object.assign(base, { movements: [], assets: [], crowd: [], expenses: [], recurring: [], properties: [], loans: [], goals: [], resale: [], refPrices: [],
      savings: [{ name: 'Livret A', type: 'Livret A', bank: 'Ma banque', cap: 0, open: '2026-10-29', rate: null, rates: [], tax: 'Exonéré', ceil: null },
        { name: 'Compte courant', type: 'Compte courant', bank: 'Ma banque', cap: 0, open: null, rate: null, rates: [], tax: 'Exonéré', ceil: null }] });
    DB.settings = Object.assign({}, base.settings, { onboarded: true, snapshots: {}, refManual: {}, snapFin: {}, crowdAuto: { on: false }, lastBackup: '2026-10-29', lastProc: '2026-10-30', lastSnapMonth: '2026-10' });
    DB.movements.push({ d: '2026-10-29', p: 'Livret A', t: 'Reprise', q: null, pu: null, m: 14645.6, f: 0, n: "Solde à l'ouverture" },
      { d: '2026-01-01', p: 'Compte courant', t: 'Reprise', q: null, pu: null, m: 3000, f: 0, n: "Solde à l'ouverture" });
    DB.meta = { schema: SCHEMA, updatedAt: 0 }; save(); renderAll(); });
  const before = await page.evaluate(() => ({ la: findSaving('Livret A').cap, cc: compteCourant().cap, est: savingCalc(findSaving('Livret A')).net }));

  // ===== Import au doigt =====
  await page.locator('.nav a[data-v="add"]').click(); await sleep(150);
  await page.locator('#sheet button', { hasText: 'Importer un relevé' }).click(); await sleep(150);
  await page.fill('#imp_txt', RELEVE); await btn('Analyser');
  const ui = await page.evaluate(() => ({ mode: impMode, acc: $('#is_acc') && $('#is_acc').value, open: $('#is_open') && $('#is_open').value, n: impSav && impSav.rows.length, kinds: impSav && impSav.rows.map((r) => r.kind) }));
  log('Relevé reconnu comme relevé d\'épargne, compte « Livret A » proposé, solde de départ 14 000 € prérempli', ui.mode === 'saving' && ui.acc === 'Livret A' && /^14 ?000$/.test(N(ui.open)) && ui.n === 4, ui);
  log('Lignes classées : intérêts, virement compte courant, retrait, versement', JSON.stringify(ui.kinds) === '["Intérêts","Transfert","Retrait","Dépôt"]', ui.kinds);
  const sum = N(await page.textContent('#is_sum'));
  log('Résumé avant import : 4 opérations, solde de départ 14 000 €, solde final 14 645,60 €', sum.includes('4 opérations à ajouter') && sum.includes('14 000,00 €') && sum.includes('14 645,60 €'), sum);
  await btn('Importer sur ce compte');
  let res = N(await page.textContent('#sheet'));
  const mv = await page.evaluate(() => DB.movements.filter((m) => m.p === 'Livret A' || m.p2 === 'Livret A').map((m) => [m.d, m.t, m.m, m.p, m.p2 || '']));
  log('Opérations créées sur le Livret A : ajustement de départ au 30/12/2025, intérêts 2025, virement depuis le compte courant, retrait, versement',
    JSON.stringify(mv.filter((x) => x[1] !== 'Reprise')) === JSON.stringify([['2025-12-30', 'Ajustement', 14000, 'Livret A', ''], ['2025-12-31', 'Intérêts', 245.6, 'Livret A', ''], ['2026-03-15', 'Transfert', 500, 'Compte courant', 'Livret A'], ['2026-06-20', 'Retrait', 300, 'Livret A', ''], ['2026-09-10', 'Dépôt', 200, 'Livret A', '']]), mv);
  log('Saisie manuelle du solde (29/10) détectée comme doublon : écart signalé avec « Retirer ces saisies »', res.includes('double') || res.includes('Écart') ? res.includes("Solde à l'ouverture") && res.includes('Retirer ces saisies') : false, res.slice(0, 500));
  await btn('Retirer ces saisies');
  const after = await page.evaluate(() => ({ la: findSaving('Livret A').cap, cc: compteCourant().cap, est: savingCalc(findSaving('Livret A')).net, brut: savingCalc(findSaving('Livret A')).brut }));
  log('Après correction : Livret A à 14 645,60 €, identique au relevé ; compte courant −500 € (virement)', near(after.la, 14645.6) && near(after.cc, before.cc - 500), { before, after });
  // Intérêts 2026 attendus, quinzaine par quinzaine, au taux officiel de chaque quinzaine : 14 245,60 € toute l'année,
  // + 500 € dès le 16/03, − 300 € dès le 16/06, + 200 € dès le 16/09 (versement : quinzaine suivante ; retrait : quinzaine en cours)
  const exp = await page.evaluate(() => { let t = 0; for (let q = 0; q < 24; q++) { const d = new Date(2026, Math.floor(q / 2), q % 2 ? 16 : 1), k = ymd(d);
    const bal = 14245.6 + (k >= '2026-03-16' ? 500 : 0) - (k >= '2026-06-16' ? 300 : 0) + (k >= '2026-09-16' ? 200 : 0); t += bal * Fin.getParam('rate.Livret A', k, DB.params) / 24; } return Math.round(t * 100) / 100; });
  log('Intérêts 2026 recalculés quinzaine par quinzaine sur les vrais mouvements (' + String(exp).replace('.', ',') + ' €)', near(after.brut, exp), { brut: after.brut, exp });
  // Réimport du même fichier : rien ne change
  await page.evaluate((t) => { closeSheet(); openImport(); document.querySelector('#imp_txt').value = t; impAnalyze(); }, RELEVE); await sleep(200);
  const sum2 = N(await page.textContent('#is_sum'));
  await btn('Importer sur ce compte');
  const again = await page.evaluate(() => ({ la: findSaving('Livret A').cap, n: DB.movements.filter((m) => m.p === 'Livret A' || m.p2 === 'Livret A').length }));
  res = N(await page.textContent('#sheet'));
  log('Même relevé réimporté : 4 doublons ignorés, solde inchangé, « Les soldes concordent »', sum2.includes('0 opération à ajouter') && near(again.la, 14645.6) && again.n === 5 && res.includes('Les soldes concordent'), { sum2, again, res: res.slice(0, 300) });
  await page.evaluate(() => closeSheet());
  // Relevé du compte courant importé ensuite : le virement vers le livret n'est pas compté deux fois
  await page.evaluate(() => { openImport(); document.querySelector('#imp_txt').value = 'Date;Libellé;Montant\n14/03/2026;VIR LIVRET A;-500,00\n02/03/2026;CARREFOUR;-82,40\n'; impAnalyze(); }); await sleep(200);
  const ccMode = await page.evaluate(() => ({ mode: impMode, kinds: impReview.map((r) => [r.kind, r.acc || '']) }));
  await page.locator('#imp_body button', { hasText: 'Importer' }).last().click(); await sleep(300);
  const cc2 = await page.evaluate(() => ({ tr: DB.movements.filter((m) => m.t === 'Transfert').length, la: findSaving('Livret A').cap }));
  log('Relevé du compte courant : « VIR LIVRET A » reconnu comme virement, pas de double comptage (un seul transfert, à un jour d\'écart)', ccMode.mode === 'bank' && JSON.stringify(ccMode.kinds[0]) === '["Transfert","Livret A"]' && cc2.tr === 1 && near(cc2.la, 14645.6), { ccMode, cc2 });
  // Sans colonne Solde : solde de départ à saisir
  await page.evaluate(() => { openImport(); document.querySelector('#imp_txt').value = 'Livret A\nDate;Libellé;Montant\n05/10/2026;VERSEMENT;150,00\n'; impAnalyze(); }); await sleep(200);
  log('Sans colonne Solde : solde de départ vide, avertissement affiché', await page.evaluate(() => $('#is_open').value === '') && N(await page.textContent('#is_sum')).includes('Solde de départ non renseigné'));
  await page.evaluate(() => closeSheet());
  log('Une sauvegarde de sécurité est faite avant l\'import', await page.evaluate(() => listBackups().some((b) => /relevé « Livret A »/.test(b.reason))));
  log('Aucune violation de la politique de sécurité', (await page.evaluate(() => window.__csp.length)) === 0, await page.evaluate(() => window.__csp));
  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
