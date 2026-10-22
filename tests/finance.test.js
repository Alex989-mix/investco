// Tests unitaires des calculs purs (app/js/finance.js) — rapides, sans navigateur : node tests/finance.test.js
const F = require('../app/js/finance.js');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined ? '  →  ' + JSON.stringify(d) : '')); };
const near = (a, b, e = 0.005) => Math.abs(a - b) <= e;

// --- Centimes
const db = { movements: [{ m: 37.5, pu: 0.1 + 0.2, f: 1.005 }], savings: [{ cap: 1000.5, ceil: null }], resale: [{ buy: 12.5, sell: null }],
  properties: [{ price: 250000, values: [{ d: '2026-01-01', v: 260000.99 }] }], settings: { goal: 60000, snapshots: { 2026: 48000.4 }, catBudgets: { Courses: 300 } },
  params: [{ key: 'ceil.Livret A', from: '2027-01-01', value: 25000, unit: '€' }, { key: 'tax.ps', from: '2027-01-01', value: 0.19, unit: '%' }], meta: {} };
const st = F.serialize(db);
log('Stockage : 37,50 € → 3750 centimes, 0,1+0,2 → 30, 1,005 → 101', st.movements[0].m === 3750 && st.movements[0].pu === 30 && st.movements[0].f === 101, st.movements[0]);
log('Stockage : tous les montants sont des entiers', [st.savings[0].cap, st.properties[0].price, st.properties[0].values[0].v, st.settings.goal, st.settings.snapshots[2026], st.settings.catBudgets.Courses, st.params[0].value].every(Number.isInteger) && st.params[1].value === 0.19 && st.savings[0].ceil === null, st.properties[0]);
const back = F.deserialize(JSON.parse(JSON.stringify(st)));
log('Relecture : centimes → euros sans perte', back.movements[0].m === 37.5 && back.savings[0].cap === 1000.5 && back.properties[0].values[0].v === 260000.99 && back.settings.snapshots[2026] === 48000.4 && back.meta.money === undefined && st.meta.money === 'cents');
log('Relecture d\'une ancienne sauvegarde en euros : inchangée', F.deserialize({ movements: [{ m: 37.5 }], meta: {} }).movements[0].m === 37.5);
log('Mémoire non modifiée par la mise en stockage', db.movements[0].m === 37.5);

// --- Paramètres datés
log('Livret A : 1,5 % le 15/03/2026, 1,7 % le 20/10/2026', F.getParam('rate.Livret A', '2026-03-15') === 0.015 && F.getParam('rate.Livret A', '2026-10-20') === 0.017);
log('PS : 17,2 % en 2025, 18,6 % en 2026 ; PS réduits 17,2 %', F.getParam('tax.ps', '2025-12-31') === 0.172 && F.getParam('tax.ps', '2026-01-01') === 0.186 && F.getParam('tax.ps.reduit', '2026-06-01') === 0.172);
log('PEL : taux fixé à l\'ouverture (2021 → 1 %, 2024 → 2,25 %)', F.getParam('rate.PEL', '2021-04-20') === 0.01 && F.getParam('rate.PEL', '2024-05-01') === 0.0225);
const user = [{ key: 'rate.Livret A', from: '2027-02-01', value: 0.02, unit: '%' }, { key: 'rate.Livret A', from: '2026-08-01', value: 0.0175, unit: '%' }];
log('Valeur ajoutée par l\'utilisateur : prise en compte à sa date, l\'historique est gardé', F.getParam('rate.Livret A', '2027-03-01', user) === 0.02 && F.getParam('rate.Livret A', '2026-01-01', user) === 0.017 && F.paramHistory('rate.Livret A', user).length === 7);
log('À date égale, la valeur de l\'utilisateur l\'emporte', F.getParam('rate.Livret A', '2026-09-01', user) === 0.0175);

// --- Crédit : 200 000 € à 3,5 % sur 20 ans → mensualité 1 159,92 € (valeur de référence des simulateurs)
const loan = { capital: 200000, rate: 0.035, months: 240, start: '2024-01-15', insurance: 30 };
log('Mensualité 200 000 € / 3,5 % / 240 mois = 1 159,92 €', F.loanPayment(200000, 0.035, 240) === 1159.92, F.loanPayment(200000, 0.035, 240));
const rows = F.amortization(loan);
log('Amortissement : 240 échéances, capital remboursé = 200 000,00 €, CRD final 0', rows.length === 240 && near(rows.reduce((a, r) => a + r.principal, 0), 200000, 0.001) && rows[239].crd === 0);
log('1re échéance : intérêts 583,33 €, capital 576,59 €', rows[0].interest === 583.33 && rows[0].principal === 576.59, rows[0]);
const s = F.loanStatus(loan, '2026-10-20');
log('Au 20/10/2026 : 33 échéances payées, CRD cohérent avec le tableau', s.paidCount === 33 && s.crd === rows[32].crd && s.next.date === '2026-11-15', { crd: s.crd, payées: s.paidCount });
log('Mensualité assurance comprise : 1 189,92 €', s.monthlyTotal === 1189.92);
log('Prêt à 0 % : 12 000 € sur 24 mois = 500 €', F.loanPayment(12000, 0, 24) === 500 && F.amortization({ capital: 12000, rate: 0, months: 24, start: '2026-01-31' })[0].date === '2026-02-28');

// --- Bien
const p = { price: 200000, rent: 900, charges: 150, values: [{ d: '2025-06-01', v: 210000 }, { d: '2026-06-01', v: 215000 }] };
log('Valeur du bien : dernière estimation à la date', F.propertyValue(p, '2026-01-01') === 210000 && F.propertyValue(p, '2026-10-01') === 215000 && F.propertyValue({ price: 1 }, '2026-01-01') === 1);
const ps = F.propertyStats(p, 800);
log('Rendement brut 5,4 %, net 4,5 %, cash-flow −50 €', near(ps.grossYield, 0.054, 1e-9) && near(ps.netYield, 0.045, 1e-9) && ps.cashflow === -50, ps);

// --- Revente
const items = [
  { name: 'A', buy: 280, fees: 8, buyD: '2026-08-01', sell: 410, sellFees: 20.5, shipFees: 6, sellD: '2026-08-20', st: 'Vendu', plat: 'Vinted' },
  { name: 'B', buy: 110, fees: 5, buyD: '2026-09-05', st: 'En vente' },
  ...Array.from({ length: 29 }, (_, i) => ({ name: 'x' + i, buy: 10, fees: 0, buyD: '2026-01-01', sell: 20, sellD: '2026-02-01', st: 'Vendu', plat: 'Leboncoin' })),
];
const it = F.resaleItem(items[0]);
log('Article : marge brute 122 €, nette 95,50 €, 19 jours', it.gross === 122 && it.net === 95.5 && it.days === 19, it);
const yOcc = F.resaleYear(items, 2026, { regime: 'occasionnel' }), yBic = F.resaleYear(items, 2026, { regime: 'microbic', abattement: 0.71 });
log('Année : 30 ventes, CA 990 €, stock 1 article / 115 €', yOcc.count === 30 && yOcc.revenue === 990 && yOcc.stockCount === 1 && yOcc.stockValue === 115, { count: yOcc.count, ca: yOcc.revenue });
log('Régime occasionnel : 0 € imposable ; micro-BIC : 29 % du CA = 287,10 €', yOcc.taxable === 0 && yBic.taxable === 287.1, yBic.taxable);
const lbc = yOcc.dac7.find(d => d.plat === 'Leboncoin'), vin = yOcc.dac7.find(d => d.plat === 'Vinted');
log('DAC7 : Leboncoin 29 ventes → proche du seuil, non déclaré ; Vinted 1 vente → rien', lbc.count === 29 && !lbc.reported && lbc.near && !vin.near);

// --- Plafonds et objectifs
log('Plafond Livret A : 21 000 € versés → proche (91,5 %), 22 950 € → atteint', F.ceilingStatus(21000, 22950).level === 'near' && F.ceilingStatus(22950, 22950).level === 'full' && F.ceilingStatus(1000, 22950).level === null);
log('PEA : achats 10 000 €, vente 4 000 €, rachat 3 000 € → versements estimés 10 000 €',
  F.peaVersements([{ d: '2024-01-01', t: 'Achat', q: 100, pu: 100 }, { d: '2025-01-01', t: 'Vente', q: 40, pu: 100 }, { d: '2025-02-01', t: 'Achat', q: 30, pu: 100 }]) === 10000);
const g = F.goalProgress({ target: 10000, deadline: '2027-10-20' }, 4000, '2026-10-20');
log('Objectif 10 000 € dans 12 mois avec 4 000 € → 500 €/mois', g.left === 6000 && g.months === 12 && g.monthly === 500 && near(g.ratio, 0.4, 1e-9), g);

// --- Budget
const ex = [
  { d: '2026-10-03', label: 'Carrefour', amt: 82.4, cat: 'Courses' }, { d: '2026-10-10', label: 'Resto', amt: 60, cat: 'Restau' },
  { d: '2026-09-03', label: 'Carrefour', amt: 100, cat: 'Courses' }, { d: '2026-08-03', label: 'Carrefour', amt: 50, cat: 'Courses' }, { d: '2026-07-03', label: 'Carrefour', amt: 30, cat: 'Courses' },
  { d: '2026-07-14', label: 'Netflix', amt: 13.49, cat: 'Abonnements' }, { d: '2026-08-14', label: 'Netflix', amt: 13.49, cat: 'Abonnements' }, { d: '2026-09-14', label: 'Netflix', amt: 13.49, cat: 'Abonnements' }, { d: '2026-10-14', label: 'NETFLIX', amt: 13.49, cat: 'Abonnements' },
  { d: '2026-09-20', label: 'Spotify', amt: 10, cat: 'Abonnements' }, { d: '2026-10-20', label: 'Spotify', amt: 10, cat: 'Abonnements' }, { d: '2026-08-20', label: 'Spotify', amt: 10, cat: 'Abonnements' },
];
const bv = F.budgetVsActual(ex, { Courses: 80, Loisirs: 50 }, '2026-10');
const co = bv.rows.find(r => r.cat === 'Courses'), lo = bv.rows.find(r => r.cat === 'Loisirs');
log('Budget octobre : Courses prévu 80 / réel 82,40 → dépassé de 2,40 ; mois précédent 100 ; moyenne 3 mois 60', co.real === 82.4 && co.over && co.diff === -2.4 && co.prev === 100 && co.avg3 === 60, co);
log('Catégorie budgétée sans dépense : Loisirs 0 / 50, restant 50', lo.real === 0 && lo.diff === 50 && !lo.over);
const rec = F.detectRecurring(ex, '2026-10', ['Spotify']);
log('Abonnement détecté : Netflix 13,49 € (4 mois) ; Spotify ignoré (déjà déclaré) ; Carrefour non (montants variables)', rec.length === 1 && rec[0].label === 'Netflix' && rec[0].amt === 13.49 && rec[0].day === 14, rec);
log('Doublon d\'import reconnu (casse et espaces ignorés)', F.sameExpense({ d: '2026-10-14', amt: 13.49, label: 'NETFLIX ' }, { d: '2026-10-14', amt: 13.490000001, label: 'netflix' }) && !F.sameExpense({ d: '2026-10-14', amt: 13.49, label: 'x' }, { d: '2026-10-15', amt: 13.49, label: 'x' }));

// --- v18 : immobilier complet
const bien = { price: 180000, notary: 14000, works: 6000, regime: 'nu', rent: 900, vacancy: 1, charges: 0, copro: 80, taxFonciere: 1200, pno: 150, maintenance: 300, mgmt: 0.07 };
const st18 = F.propertyStats(bien, 800, 215000);
// coût 200 000 ; loyers 900×11 = 9 900 ; charges 80×12 + 1200 + 150 + 300 + 7 % × 9 900 = 3 303 ; net (9 900 − 3 303)/200 000 = 3,2985 %
log('Bien : coût 200 000 €, loyers encaissés 9 900 € (1 mois de vacance), charges 3 303 €', st18.cost === 200000 && st18.rentY === 9900 && st18.chargesY === 3303, st18);
log('… rendement brut 5,4 %, net 3,30 %, cash-flow (9 900 − 3 303)/12 − 800 = −250,25 €', Math.abs(st18.grossYield - 0.054) < 1e-9 && Math.abs(st18.netYield - 0.032985) < 1e-9 && st18.cashflow === -250.25, st18);
log('… plus-value latente 15 000 € (+7,5 %)', st18.gain === 15000 && Math.abs(st18.gainPct - 0.075) < 1e-9);
const rp = F.propertyStats({ price: 300000, notary: 22000, regime: 'RP', rent: 900 }, 1400, 340000);
log('Résidence principale : pas de loyer ni de rendement, plus-value 18 000 €', rp.rentY === 0 && rp.grossYield === 0 && rp.gain === 18000 && rp.cashflow === -1400, rp);
log('Ancien bien (prix « frais inclus », charges mensuelles) : calcul inchangé', (() => { const o = F.propertyStats({ price: 200000, rent: 900, charges: 150 }, 800); return Math.abs(o.grossYield - 0.054) < 1e-9 && Math.abs(o.netYield - 0.045) < 1e-9 && o.cashflow === -50; })());

// --- v18 : cash-flow et taux d'épargne
const mv18 = [{ d: '2026-10-01', p: 'CC', t: 'Dépôt', m: 2000 }, { d: '2026-10-05', p: 'CC', t: 'Transfert', p2: 'Livret A', m: 300 }, { d: '2026-10-07', p: 'Livret A', p2: 'CC', t: 'Transfert', m: 100 }, { d: '2026-09-01', p: 'CC', t: 'Dépôt', m: 1800 }];
const ex18 = [{ d: '2026-10-03', amt: 600, cat: 'Logement' }, { d: '2026-10-09', amt: 250, cat: 'Courses' }, { d: '2026-10-08', amt: 100, cat: 'Investissement' }, { d: '2026-09-04', amt: 1500, cat: 'Logement' }];
const cf = F.monthCashflow(mv18, ex18, 'CC', '2026-10');
log('Octobre : revenus 2 000 € (transferts exclus), dépenses 850 € (investissement exclu), épargne 1 150 €, taux 57,5 %', cf.income === 2000 && cf.spent === 850 && cf.invested === 100 && cf.saved === 1150 && Math.abs(cf.rate - 0.575) < 1e-9, cf);
const ser = F.cashflowSeries(mv18, ex18, 'CC', '2026-10', 12);
log('Série 12 mois : novembre 2025 → octobre 2026, taux moyen (1 150 + 300) / 3 800 = 38,2 %', ser.months.length === 12 && ser.months[0].ym === '2025-11' && ser.months[11].ym === '2026-10' && Math.abs(ser.avgRate - 1450 / 3800) < 1e-9, { premier: ser.months[0].ym, taux: ser.avgRate });
log('Mois sans revenu : taux non défini (pas de division par zéro)', F.monthCashflow([], [{ d: '2026-10-01', amt: 10, cat: 'Courses' }], 'CC', '2026-10').rate === null);

// --- v18 : PEA
log('ISIN valides : FR0010315770 (Amundi MSCI World), US0378331005 (Apple), IE00B4L5Y983', F.isinValid('FR0010315770') && F.isinValid('US0378331005') && F.isinValid('ie00b4l5y983'));
log('ISIN invalides : chiffre de contrôle faux, longueur fausse', !F.isinValid('FR0010315771') && !F.isinValid('FR001031577') && !F.isinValid(''));
const peaOps = [{ d: '2022-03-01', t: 'Achat', q: 10, pu: 300, f: 2 }, { d: '2024-01-10', t: 'Vente', q: 4, pu: 400, f: 1 }, { d: '2025-06-01', t: 'Dividende', m: 25 }];
const ps1 = F.peaStatus({ open: '2021-11-15', versements: [{ d: '2021-11-15', m: 3000 }, { d: '2023-01-10', m: 500 }] }, peaOps, 150000, '2026-10-22');
// liquidités = 3 500 − 3 002 + 1 599 + 25 = 2 122
log('PEA : 3 500 € versés, liquidités 2 122 €, reste 146 500 € de plafond', ps1.versed === 3500 && ps1.real && ps1.cash === 2122 && ps1.room === 146500, ps1);
log('PEA ouvert le 15/11/2021 : 5 ans le 15/11/2026, pas encore atteints au 22/10/2026', ps1.fiveYears === '2026-11-15' && !ps1.mature && ps1.years > 4.9);
const ps2 = F.peaStatus({ open: '2019-01-01', versements: [] }, peaOps, 150000, '2026-10-22');
log('Sans versement saisi : estimation (3 002 €), pas de liquidités affichées ; plus de 5 ans', ps2.versed === 3002 && !ps2.real && ps2.cash === null && ps2.mature, ps2);

console.log(out.every(Boolean) ? '\n✓ finance.js : tout est bon' : '\n✗ finance.js : erreurs');
(async () => {
  const salt = '00112233445566778899aabbccddeeff';
  const h1 = await F.hashPin('1234', salt, 1000), h2 = await F.hashPin('1234', salt, 1000), h3 = await F.hashPin('1235', salt, 1000), h4 = await F.hashPin('1234', 'ffeeddccbbaa99887766554433221100', 1000);
  log('Code haché : même code + même sel → même empreinte ; code ou sel différent → empreinte différente ; jamais le code en clair', h1 === h2 && h1 !== h3 && h1 !== h4 && h1.length === 64 && !h1.includes('1234'));
  // ===== v19 : cours crypto en direct =====
  log('Paire Kraken : BTC-EUR, btc, XBT-EUR, ETH/EUR, SOL-USD → paire en euros', F.krakenPair('BTC-EUR') === 'BTC/EUR' && F.krakenPair(' btc ') === 'BTC/EUR' && F.krakenPair('XBT-EUR') === 'BTC/EUR' && F.krakenPair('ETH/EUR') === 'ETH/EUR' && F.krakenPair('SOL-USD') === 'SOL/EUR');
  log('Paire Kraken : ticker invalide ou injecté → aucune paire', [null, '', 'CW8.PA', 'EUR', 'BTC"}];alert(1)', '<img>', 'A', 'BITCOIN-ETHEREUM'].every((t) => F.krakenPair(t) === null));
  log('Cours reçu : valeurs non numériques, nulles, négatives, infinies ou démesurées rejetées', [null, undefined, 'abc', NaN, 0, -5, Infinity, 2e8, {}, [61000]].every((v) => F.acceptTick(null, v) === null));
  log('Cours reçu : premier cours valide accepté (nombre ou texte numérique)', F.acceptTick(null, 61234.5) === 61234.5 && F.acceptTick(null, '0.4521') === 0.4521);
  log('Cours reçu : variation de ±25 % par rapport au dernier cours direct rejetée, petite variation acceptée', F.acceptTick(60000, 80000) === null && F.acceptTick(60000, 40000) === null && F.acceptTick(60000, 60120) === 60120);
  // ===== v19.1 : variation du jour des actions et ETF =====
  log('Variation du jour : 101,50 € pour une clôture à 100 € → +1,5 % ; 99 € → -1 %', F.dayChange(101.5, 100) === 1.5 && F.dayChange(99, 100) === -1 && F.dayChange(706.12, 712.94) === -0.96);
  log('Variation du jour : clôture absente, nulle, texte ou écart aberrant (≥ 100 %) → non affichée', [[100, null], [100, 0], [100, 'abc'], [null, 100], [250, 100], [-5, 100], [Infinity, 100]].every(([a, b]) => F.dayChange(a, b) === null));
  console.log(out.every(Boolean) ? '✓ hachage OK' : '✗ erreurs');
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
