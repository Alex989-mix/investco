/* Invest.co — calculs financiers purs (sans interface), testés dans tests/finance.test.js.
   Règles du projet :
   - les montants sont stockés en centimes entiers (voir toCents / fromCents et MONEY_FIELDS) ;
   - les taux et plafonds réglementaires ne sont jamais codés en dur dans l'appli : ils viennent de
     PARAM_DEFAULTS (date de validité « from »), complétés par les valeurs ajoutées par l'utilisateur ;
   - l'historique est conservé : une nouvelle valeur s'ajoute avec sa date, elle n'écrase pas l'ancienne. */
(function (root) {
  'use strict';

  // ---------- Arrondis et centimes ----------
  const round2 = (v) => Math.round(Number(((+v || 0) * 100).toPrecision(12))) / 100;
  // toPrecision(12) neutralise les erreurs binaires (1,005 × 100 = 100,4999… → 101 centimes)
  const toCents = (eur) => (eur == null || eur === '' || !isFinite(+eur)) ? eur : Math.round(Number((+eur * 100).toPrecision(12)));
  const fromCents = (c) => (c == null || c === '' || !isFinite(+c)) ? c : (+c) / 100;

  // Champs monétaires de chaque collection : convertis en centimes au stockage (localStorage, export, Drive)
  const MONEY_FIELDS = {
    movements: ['pu', 'm', 'f'],
    assets: ['price'],
    savings: ['cap', 'ceil'],
    crowd: ['amt'],
    expenses: ['amt'],
    recurring: ['amt'],
    resale: ['buy', 'fees', 'sell', 'sellFees', 'shipFees'],
    loans: ['capital', 'insurance'],
    properties: ['price', 'rent', 'charges'],
    goals: ['target'],
  };
  // Champs monétaires dans des sous-listes : properties[].values[].v
  const NESTED_MONEY = { properties: { values: ['v'] } };
  const SETTINGS_MONEY = ['goal'];
  const SETTINGS_MONEY_MAPS = ['snapshots', 'catBudgets'];

  function mapMoney(db, fn) {
    const out = JSON.parse(JSON.stringify(db));
    for (const [coll, fields] of Object.entries(MONEY_FIELDS)) {
      (out[coll] || []).forEach((row) => {
        fields.forEach((f) => { if (f in row) row[f] = fn(row[f]); });
        const nested = NESTED_MONEY[coll];
        if (nested) for (const [sub, sf] of Object.entries(nested)) (row[sub] || []).forEach((x) => sf.forEach((f) => { if (f in x) x[f] = fn(x[f]); }));
      });
    }
    const s = out.settings || {};
    SETTINGS_MONEY.forEach((f) => { if (f in s) s[f] = fn(s[f]); });
    SETTINGS_MONEY_MAPS.forEach((m) => { if (s[m]) for (const k of Object.keys(s[m])) s[m][k] = fn(s[m][k]); });
    (out.params || []).forEach((p) => { if (p.unit === '€') p.value = fn(p.value); });
    return out;
  }
  // Données en mémoire (euros) → données stockées (centimes entiers)
  const serialize = (db) => { const o = mapMoney(db, toCents); o.meta = Object.assign({}, o.meta, { money: 'cents' }); return o; };
  // Données stockées → mémoire. Les anciennes sauvegardes (avant v17, en euros) sont reconnues.
  const deserialize = (raw) => {
    if (!(raw && raw.meta && raw.meta.money === 'cents')) return raw;
    const o = mapMoney(raw, fromCents); delete o.meta.money; return o; // en mémoire : euros, sans le marqueur
  };

  // ---------- Paramètres réglementaires datés ----------
  // unit : '%' (fraction : 0.017 = 1,7 %), '€' ou '' (nombre). src : d'où vient la valeur.
  const P = (key, from, value, unit, label, src) => ({ key, from, value, unit, label, src: src || '' });
  const SRC_LIVRETS = 'Taux réglementés publiés au Journal officiel (Banque de France)';
  const SRC_PS = 'LFSS 2026 : CSG portée à 10,6 % sur les revenus du capital (PS 18,6 %, PFU 31,4 %)';
  const PARAM_DEFAULTS = [
    // Taux des livrets (en vigueur à partir de la date)
    P('rate.Livret A', '2023-02-01', 0.03, '%', 'Taux Livret A', SRC_LIVRETS),
    P('rate.Livret A', '2025-02-01', 0.024, '%', 'Taux Livret A', SRC_LIVRETS),
    P('rate.Livret A', '2025-08-01', 0.017, '%', 'Taux Livret A', SRC_LIVRETS),
    P('rate.Livret A', '2026-02-01', 0.015, '%', 'Taux Livret A', SRC_LIVRETS),
    P('rate.Livret A', '2026-08-01', 0.017, '%', 'Taux Livret A', SRC_LIVRETS),
    P('rate.LDDS', '2023-02-01', 0.03, '%', 'Taux LDDS', SRC_LIVRETS),
    P('rate.LDDS', '2025-02-01', 0.024, '%', 'Taux LDDS', SRC_LIVRETS),
    P('rate.LDDS', '2025-08-01', 0.017, '%', 'Taux LDDS', SRC_LIVRETS),
    P('rate.LDDS', '2026-02-01', 0.015, '%', 'Taux LDDS', SRC_LIVRETS),
    P('rate.LDDS', '2026-08-01', 0.017, '%', 'Taux LDDS', SRC_LIVRETS),
    P('rate.LEP', '2026-02-01', 0.025, '%', 'Taux LEP', SRC_LIVRETS),
    P('rate.CEL', '2026-02-01', 0.010, '%', 'Taux CEL', SRC_LIVRETS),
    P('rate.CEL', '2026-08-01', 0.0125, '%', 'Taux CEL', SRC_LIVRETS),
    P('rate.Livret Jeune', '2026-02-01', 0.015, '%', 'Taux plancher Livret Jeune', SRC_LIVRETS),
    P('rate.Livret Jeune', '2026-08-01', 0.017, '%', 'Taux plancher Livret Jeune', SRC_LIVRETS),
    // PEL : taux fixé à l'ouverture (la date d'ouverture du plan sert de date de lecture)
    P('rate.PEL', '2016-08-01', 0.01, '%', 'Taux PEL (à l\'ouverture)', SRC_LIVRETS),
    P('rate.PEL', '2023-01-01', 0.02, '%', 'Taux PEL (à l\'ouverture)', SRC_LIVRETS),
    P('rate.PEL', '2024-01-01', 0.0225, '%', 'Taux PEL (à l\'ouverture)', SRC_LIVRETS),
    P('rate.PEL', '2025-01-01', 0.0175, '%', 'Taux PEL (à l\'ouverture)', SRC_LIVRETS),
    P('rate.PEL', '2026-01-01', 0.02, '%', 'Taux PEL (à l\'ouverture)', SRC_LIVRETS),
    // Plafonds de versement (les intérêts capitalisés peuvent les dépasser)
    P('ceil.Livret A', '2013-01-01', 22950, '€', 'Plafond Livret A', 'Code monétaire et financier'),
    P('ceil.LDDS', '2012-10-01', 12000, '€', 'Plafond LDDS', 'Code monétaire et financier'),
    P('ceil.LEP', '2023-01-01', 10000, '€', 'Plafond LEP', 'Code monétaire et financier'),
    P('ceil.Livret Jeune', '2013-01-01', 1600, '€', 'Plafond Livret Jeune', 'Code monétaire et financier'),
    P('ceil.CEL', '2013-01-01', 15300, '€', 'Plafond CEL', 'Code monétaire et financier'),
    P('ceil.PEL', '2013-01-01', 61200, '€', 'Plafond PEL', 'Code monétaire et financier'),
    P('ceil.PEA', '2014-01-01', 150000, '€', 'Plafond de versements PEA', 'Code monétaire et financier'),
    // Fiscalité des revenus du capital
    P('tax.ir.pfu', '2018-01-01', 0.128, '%', 'Part impôt du PFU', 'CGI art. 200 A'),
    P('tax.ps', '2018-01-01', 0.172, '%', 'Prélèvements sociaux (cas général)', 'CSS'),
    P('tax.ps', '2026-01-01', 0.186, '%', 'Prélèvements sociaux (cas général)', SRC_PS),
    P('tax.ps.reduit', '2018-01-01', 0.172, '%', 'Prélèvements sociaux (assurance-vie, PEL, immobilier)', SRC_PS),
    P('tax.av.abattement', '2018-01-01', 4600, '€', 'Abattement assurance-vie > 8 ans (personne seule)', 'CGI art. 125-0 A'),
    P('tax.av.ir8', '2018-01-01', 0.075, '%', 'Taux d\'impôt assurance-vie > 8 ans (≤ 150 000 €)', 'CGI art. 125-0 A'),
    // Achat-revente
    P('revente.microbic.abattement', '2018-01-01', 0.71, '%', 'Abattement micro-BIC (vente de marchandises)', 'CGI art. 50-0'),
    P('revente.dac7.ventes', '2023-01-01', 30, '', 'Seuil DAC7 : nombre de ventes par plateforme et par an', 'Directive (UE) 2021/514 (DAC7)'),
    P('revente.dac7.montant', '2023-01-01', 2000, '€', 'Seuil DAC7 : montant des ventes par plateforme et par an', 'Directive (UE) 2021/514 (DAC7)'),
  ];

  // Valeur d'un paramètre à une date (AAAA-MM-JJ) : la plus récente dont « from » ≤ date.
  // Les valeurs de l'utilisateur (userParams) l'emportent à date égale.
  function getParam(key, date, userParams, fallback) {
    const d = date || '9999-12-31';
    let best = null;
    const consider = (p, isUser) => {
      if (p.key !== key || p.from > d) return;
      if (!best || p.from > best.p.from || (p.from === best.p.from && isUser)) best = { p, isUser };
    };
    PARAM_DEFAULTS.forEach((p) => consider(p, false));
    (userParams || []).forEach((p) => consider(p, true));
    return best ? best.p.value : (fallback === undefined ? null : fallback);
  }
  // Historique complet d'un paramètre (défauts + utilisateur), du plus récent au plus ancien
  function paramHistory(key, userParams) {
    return PARAM_DEFAULTS.filter((p) => p.key === key).map((p) => Object.assign({ user: false }, p))
      .concat((userParams || []).filter((p) => p.key === key).map((p) => Object.assign({ user: true }, p)))
      .sort((a, b) => (a.from < b.from ? 1 : a.from > b.from ? -1 : (a.user ? -1 : 1)));
  }
  const paramKeys = () => [...new Set(PARAM_DEFAULTS.map((p) => p.key))];

  // ---------- Dates (chaînes AAAA-MM-JJ, sans fuseau horaire) ----------
  const parseYmd = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return { y, m, d }; };
  const fmtYmd = (y, m, d) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const lastDay = (y, m) => new Date(y, m, 0).getDate();
  // Ajoute n mois ; jour ramené au dernier jour du mois si besoin (31/01 + 1 mois = 28/02)
  function addMonthsYmd(s, n) {
    const { y, m, d } = parseYmd(s);
    const t = (y * 12 + (m - 1)) + n, ny = Math.floor(t / 12), nm = (t % 12) + 1;
    return fmtYmd(ny, nm, Math.min(d, lastDay(ny, nm)));
  }
  const monthsDiff = (a, b) => { const A = parseYmd(a), B = parseYmd(b); return (B.y - A.y) * 12 + (B.m - A.m) + (B.d >= A.d ? 0 : -1); };

  // ---------- Crédit immobilier (prêt amortissable à mensualités constantes) ----------
  // Mensualité hors assurance : C × t / (1 − (1 + t)^−n), t = taux annuel / 12
  function loanPayment(capital, annualRate, months) {
    if (!(capital > 0) || !(months > 0)) return 0;
    const t = (annualRate || 0) / 12;
    if (t === 0) return round2(capital / months);
    return round2(capital * t / (1 - Math.pow(1 + t, -months)));
  }
  // Tableau d'amortissement, au centime. Échéance n°k le même jour, k mois après le début.
  // La dernière échéance solde exactement le capital restant (pas de reliquat d'arrondi).
  function amortization(loan) {
    const C = +loan.capital || 0, n = +loan.months || 0, t = (+loan.rate || 0) / 12;
    const pay = loanPayment(C, loan.rate, n), ins = +loan.insurance || 0;
    const rows = []; let crd = C;
    for (let k = 1; k <= n; k++) {
      const interest = round2(crd * t);
      let principal = round2(pay - interest);
      if (k === n || principal > crd) principal = crd;
      crd = round2(crd - principal);
      rows.push({ k, date: addMonthsYmd(loan.start, k), payment: round2(principal + interest), interest, principal, insurance: ins, crd });
    }
    return rows;
  }
  // Capital restant dû à une date (après les échéances passées)
  function loanStatus(loan, date) {
    const rows = amortization(loan), past = rows.filter((r) => r.date <= date);
    const crd = past.length ? past[past.length - 1].crd : (+loan.capital || 0);
    const y = String(date).slice(0, 4);
    const year = rows.filter((r) => r.date.slice(0, 4) === y);
    const totalInterest = round2(rows.reduce((a, r) => a + r.interest, 0));
    return {
      payment: loanPayment(+loan.capital, +loan.rate, +loan.months), monthlyTotal: round2(loanPayment(+loan.capital, +loan.rate, +loan.months) + (+loan.insurance || 0)),
      crd, paidCount: past.length, remainingCount: rows.length - past.length,
      interestYear: round2(year.reduce((a, r) => a + r.interest, 0)), principalYear: round2(year.reduce((a, r) => a + r.principal, 0)),
      totalInterest, totalInsurance: round2((+loan.insurance || 0) * rows.length),
      end: rows.length ? rows[rows.length - 1].date : loan.start, next: rows.find((r) => r.date > date) || null,
    };
  }

  // ---------- Bien immobilier locatif ----------
  // Valeur estimée à une date : dernière estimation datée ≤ date, sinon prix d'achat
  function propertyValue(p, date) {
    const v = (p.values || []).filter((x) => x.d <= date).sort((a, b) => (a.d < b.d ? 1 : -1));
    return v.length ? +v[0].v : (+p.price || 0);
  }
  // Rendements calculés sur le prix d'achat (frais inclus), cash-flow mensuel crédit compris
  function propertyStats(p, loanMonthly) {
    const price = +p.price || 0, rent = +p.rent || 0, charges = +p.charges || 0;
    return {
      grossYield: price ? rent * 12 / price : 0,
      netYield: price ? (rent - charges) * 12 / price : 0,
      cashflow: round2(rent - charges - (loanMonthly || 0)),
    };
  }

  // ---------- Achat-revente ----------
  function resaleItem(r) {
    const cost = round2((+r.buy || 0) + (+r.fees || 0));
    const sold = r.st === 'Vendu' && r.sell != null && r.sell !== '';
    const sellCosts = round2((+r.sellFees || 0) + (+r.shipFees || 0));
    const gross = sold ? round2(+r.sell - cost) : 0;           // marge brute : prix de vente − coût d'achat
    const net = sold ? round2(+r.sell - cost - sellCosts) : 0; // marge nette : − frais de plateforme et d'envoi
    let days = null;
    if (sold && r.buyD && r.sellD) days = Math.round((Date.UTC(...ymdArr(r.sellD)) - Date.UTC(...ymdArr(r.buyD))) / 86400000);
    return { cost, sold, sellCosts, gross, net, roi: cost ? net / cost : 0, days };
  }
  const ymdArr = (s) => { const { y, m, d } = parseYmd(s); return [y, m - 1, d]; };
  // Synthèse annuelle : CA, marges, rotation, stock, seuils DAC7 par plateforme, base imposable selon le régime
  function resaleYear(items, year, opts) {
    const o = opts || {};
    const soldY = items.filter((r) => r.st === 'Vendu' && r.sellD && String(r.sellD).slice(0, 4) === String(year));
    const calc = soldY.map(resaleItem);
    const revenue = round2(soldY.reduce((a, r) => a + (+r.sell || 0), 0));
    const gross = round2(calc.reduce((a, c) => a + c.gross, 0)), net = round2(calc.reduce((a, c) => a + c.net, 0));
    const withDays = calc.filter((c) => c.days != null);
    const avgDays = withDays.length ? Math.round(withDays.reduce((a, c) => a + c.days, 0) / withDays.length) : null;
    const stock = items.filter((r) => r.st === 'En vente');
    const stockValue = round2(stock.reduce((a, r) => a + (+r.buy || 0) + (+r.fees || 0), 0));
    const byPlat = {};
    soldY.forEach((r) => { const k = r.plat || 'Autre'; byPlat[k] = byPlat[k] || { count: 0, amount: 0 }; byPlat[k].count++; byPlat[k].amount = round2(byPlat[k].amount + (+r.sell || 0)); });
    const dac7n = o.dac7Count || 30, dac7m = o.dac7Amount || 2000;
    const dac7 = Object.entries(byPlat).map(([plat, v]) => ({ plat, ...v, reported: v.count >= dac7n || v.amount >= dac7m,
      near: v.count >= dac7n * 0.8 || v.amount >= dac7m * 0.8 }));
    // Régime : « occasionnel » = ventes de biens personnels d'occasion, non imposables (hors objet > 5 000 € et
    // bijoux/objets d'art) ; « microbic » = activité d'achat-revente, imposée sur le CA après abattement.
    const taxable = o.regime === 'microbic' ? round2(revenue * (1 - (o.abattement == null ? 0.71 : o.abattement))) : 0;
    return { count: soldY.length, revenue, gross, net, avgDays, stockCount: stock.length, stockValue, byPlat, dac7, taxable };
  }

  // ---------- Plafonds ----------
  // Niveau d'alerte d'un compte plafonné : 'full' (≥ 100 %), 'near' (≥ 90 %), sinon null
  function ceilingStatus(versed, ceil) {
    if (!(ceil > 0)) return null;
    const ratio = versed / ceil;
    return { ratio, room: round2(Math.max(0, ceil - versed)), level: ratio >= 1 ? 'full' : ratio >= 0.9 ? 'near' : null };
  }
  // Versements cumulés sur un PEA (estimation) : pic du montant net investi (achats − ventes), car une vente
  // ne libère pas de plafond et le réinvestissement du produit d'une vente n'est pas un nouveau versement.
  function peaVersements(ops) {
    let cash = 0, peak = 0;
    ops.slice().sort((a, b) => (a.d < b.d ? -1 : 1)).forEach((m) => {
      const g = (m.q != null && m.pu != null) ? m.q * m.pu : (+m.m || 0);
      if (m.t === 'Achat') cash += g + (+m.f || 0); else if (m.t === 'Vente') cash -= g - (+m.f || 0);
      if (cash > peak) peak = cash;
    });
    return round2(peak);
  }

  // ---------- Objectifs d'épargne ----------
  function goalProgress(goal, current, date) {
    const target = +goal.target || 0, left = round2(Math.max(0, target - current));
    const months = goal.deadline ? Math.max(0, monthsDiff(date, goal.deadline)) : null;
    return { current: round2(current), target, ratio: target ? Math.min(1, current / target) : 0, left, months,
      monthly: months ? round2(left / months) : (months === 0 ? left : null), late: !!(goal.deadline && goal.deadline < date && left > 0) };
  }

  // ---------- Budget ----------
  const ymShift = (ym, n) => addMonthsYmd(ym + '-01', n).slice(0, 7);
  // Prévu vs réel par catégorie pour le mois « ym » (AAAA-MM), avec le mois précédent et la moyenne des 3 mois précédents
  function budgetVsActual(expenses, budgets, ym) {
    const sumBy = (m) => { const o = {}; expenses.forEach((e) => { if (String(e.d).slice(0, 7) === m) o[e.cat] = round2((o[e.cat] || 0) + (+e.amt || 0)); }); return o; };
    const cur = sumBy(ym), prev = sumBy(ymShift(ym, -1)), p3 = [1, 2, 3].map((k) => sumBy(ymShift(ym, -k)));
    const cats = [...new Set([...Object.keys(budgets || {}).filter((k) => budgets[k] > 0), ...Object.keys(cur)])];
    const rows = cats.map((cat) => {
      const plan = +(budgets || {})[cat] || 0, real = cur[cat] || 0;
      return { cat, plan, real, diff: round2(plan - real), over: plan > 0 && real > plan, prev: prev[cat] || 0,
        avg3: round2(p3.reduce((a, o) => a + (o[cat] || 0), 0) / 3) };
    }).sort((a, b) => b.real - a.real || b.plan - a.plan);
    const tot = (f) => round2(rows.reduce((a, r) => a + r[f], 0));
    return { rows, plan: tot('plan'), real: tot('real'), prev: tot('prev'), avg3: tot('avg3') };
  }
  // Dépenses qui reviennent chaque mois (même libellé, montant stable à ±10 %, au moins 3 des 4 derniers mois),
  // pas encore déclarées en dépense récurrente
  function detectRecurring(expenses, ym, knownLabels) {
    const norm = (l) => String(l || '').toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
    const known = new Set((knownLabels || []).map(norm));
    const months = [1, 2, 3, 4].map((k) => ymShift(ym, -k + 1));
    const groups = {};
    expenses.filter((e) => !e.auto && months.includes(String(e.d).slice(0, 7))).forEach((e) => {
      const k = norm(e.label); if (!k || known.has(k)) return;
      (groups[k] = groups[k] || []).push(e);
    });
    return Object.values(groups).map((list) => {
      const ms = new Set(list.map((e) => String(e.d).slice(0, 7))); if (ms.size < 3) return null;
      const amts = list.map((e) => +e.amt).sort((a, b) => a - b), med = amts[Math.floor(amts.length / 2)];
      if (!amts.every((a) => Math.abs(a - med) <= med * 0.1)) return null;
      const days = list.map((e) => +String(e.d).slice(8, 10)).sort((a, b) => a - b);
      return { label: list[0].label, amt: med, cat: list[0].cat, day: days[Math.floor(days.length / 2)], months: ms.size };
    }).filter(Boolean);
  }
  // Doublon d'import : même date, même montant au centime, même libellé (sans casse ni espaces)
  const sameExpense = (a, b) => String(a.d) === String(b.d) && Math.round(+a.amt * 100) === Math.round(+b.amt * 100)
    && String(a.label || '').toLowerCase().replace(/\s+/g, ' ').trim() === String(b.label || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const api = { round2, budgetVsActual, detectRecurring, sameExpense, toCents, fromCents, MONEY_FIELDS, serialize, deserialize, PARAM_DEFAULTS, getParam, paramHistory, paramKeys,
    addMonthsYmd, monthsDiff, loanPayment, amortization, loanStatus, propertyValue, propertyStats, resaleItem, resaleYear,
    ceilingStatus, peaVersements, goalProgress };
  root.Fin = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
