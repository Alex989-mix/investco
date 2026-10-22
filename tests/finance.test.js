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

console.log(out.every(Boolean) ? '\n✓ finance.js : tout est bon' : '\n✗ finance.js : erreurs');
process.exitCode = out.every(Boolean) ? 0 : 1;
