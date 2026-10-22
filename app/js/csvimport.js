/* Invest.co — lecture de relevés CSV de toute banque et des exports crypto (Bitstack…).
   Fonctions pures, testées dans tests/csvimport.test.js. Aucune hypothèse sur une banque précise :
   on détecte l'encodage, le séparateur, la ligne de titres (après d'éventuelles lignes d'en-tête),
   puis le rôle de chaque colonne d'après son titre ET son contenu. */
(function (root) {
  'use strict';

  // ---------- Encodage ----------
  // UTF-8 (avec ou sans BOM), UTF-16 (BOM), sinon Windows-1252 (exports Excel / banques françaises)
  function decode(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8.subarray(2));
    if (u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(u8.subarray(2));
    const body = (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) ? u8.subarray(3) : u8;
    try { return new TextDecoder('utf-8', { fatal: true }).decode(body); }
    catch (e) { return new TextDecoder('windows-1252').decode(body); }
  }

  // ---------- Découpage CSV (guillemets, "" échappés, retours à la ligne dans un champ) ----------
  function parseCSV(text, delim) {
    const rows = []; let row = [], f = '', q = false;
    const t = String(text).replace(/^﻿/, '');
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
      if (c === '"' && f.trim() === '') { q = true; f = ''; continue; }
      if (c === delim) { row.push(f); f = ''; continue; }
      if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; continue; }
      f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.map((r) => r.map((x) => x.replace(/^="?|"$/g, (m) => (m === '="' || m === '=' ? '' : m)).trim()))
      .filter((r) => r.some((x) => x !== ''));
  }
  // Séparateur : celui qui donne le nombre de colonnes le plus régulier (> 1) sur les premières lignes
  function detectDelim(text) {
    const sample = String(text).split(/\r?\n/).filter((l) => l.trim()).slice(0, 60).join('\n');
    let best = ',', bestScore = -1;
    for (const d of [';', ',', '\t', '|']) {
      const rows = parseCSV(sample, d), counts = {};
      rows.forEach((r) => { if (r.length > 1) counts[r.length] = (counts[r.length] || 0) + 1; });
      const [n, freq] = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] || [1, 0];
      const score = freq * Math.min(+n, 12);
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  // ---------- Nombres ----------
  const strip = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Montant au format français, anglais ou bancaire : « -1 234,56 », « 1.234,56 », « 1,234.56 », « (12,00) »,
  // « 82,40- », « +12 € », « −5 » (signe moins typographique), « 1234.5 EUR ». decimal : ',' ou '.' si connu.
  function parseAmount(v, decimal) {
    if (v == null) return null;
    let s = String(v).trim().replace(/[−‒–—]/g, '-').replace(/[\s  ']/g, '')
      .replace(/(eur|euros?|€|\$|usd|btc)$/i, '').replace(/^(eur|€|\$)/i, '');
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-$/.test(s)) { neg = !neg; s = s.slice(0, -1); }
    if (/^[+-]/.test(s)) { if (s[0] === '-') neg = !neg; s = s.slice(1); }
    if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    let dec = null;
    if (lc >= 0 && ld >= 0) dec = lc > ld ? ',' : '.';
    else if (lc >= 0) dec = (s.match(/,/g).length > 1) ? null : (decimal === '.' && /^\d{1,3}(,\d{3})+$/.test(s) ? null : ',');
    else if (ld >= 0) dec = (s.match(/\./g).length > 1) ? null : (decimal === ',' && /^\d{1,3}(\.\d{3})+$/.test(s) ? null : '.');
    const thou = dec === ',' ? '.' : ',';
    s = s.split(thou).join('');
    if (dec) s = s.replace(dec, '.'); else s = s.replace(/[.,]/g, '');
    const n = Number(s);
    return isFinite(n) ? (neg ? -n : n) : null;
  }

  // ---------- Dates ----------
  const MONTHS = { jan: 1, janv: 1, janvier: 1, january: 1, feb: 2, fev: 2, fevr: 2, fevrier: 2, february: 2, mar: 3, mars: 3, march: 3,
    apr: 4, avr: 4, avril: 4, april: 4, may: 5, mai: 5, jun: 6, juin: 6, june: 6, jul: 7, juil: 7, juillet: 7, july: 7, aug: 8, aou: 8, aout: 8, august: 8,
    sep: 9, sept: 9, septembre: 9, september: 9, oct: 10, octobre: 10, october: 10, nov: 11, novembre: 11, november: 11, dec: 12, decembre: 12, december: 12 };
  const valid = (y, m, d) => y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= new Date(y, m, 0).getDate();
  const fmt = (y, m, d) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  // order : 'DMY' (France, par défaut) ou 'MDY'
  function parseDate(v, order) {
    if (v == null) return null;
    const s = strip(v).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ t].*)?$/);
    if (m) return valid(+m[1], +m[2], +m[3]) ? fmt(+m[1], +m[2], +m[3]) : null;
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[ t].*)?$/);
    if (m) {
      let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
      let d = a, mo = b; if (order === 'MDY') { d = b; mo = a; }
      if (!valid(y, mo, d) && valid(y, d, mo)) { const t = d; d = mo; mo = t; }
      return valid(y, mo, d) ? fmt(y, mo, d) : null;
    }
    m = s.match(/^(\d{1,2})(?:er)?[ -]([a-z]+)\.?[ -](\d{4})/);
    if (m && MONTHS[m[2]]) return valid(+m[3], MONTHS[m[2]], +m[1]) ? fmt(+m[3], MONTHS[m[2]], +m[1]) : null;
    m = s.match(/^([a-z]+)\.? (\d{1,2}),? (\d{4})/);
    if (m && MONTHS[m[1]]) return valid(+m[3], MONTHS[m[1]], +m[2]) ? fmt(+m[3], MONTHS[m[1]], +m[2]) : null;
    if (/^\d{8}$/.test(s)) { const y = +s.slice(0, 4), mo = +s.slice(4, 6), d = +s.slice(6); if (valid(y, mo, d)) return fmt(y, mo, d); }
    return null;
  }
  // Ordre jour/mois d'une colonne : MDY seulement si une valeur a un « mois » > 12 en 2e position
  function dateOrder(values) {
    let dmy = 0, mdy = 0;
    values.forEach((v) => { const m = strip(v).match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/); if (!m) return; if (+m[1] > 12) dmy++; if (+m[2] > 12) mdy++; });
    return mdy > dmy ? 'MDY' : 'DMY';
  }
  // Séparateur décimal majoritaire d'une colonne de montants
  function decimalOf(values) {
    let c = 0, d = 0;
    values.forEach((v) => { const s = String(v).replace(/[\s  ]/g, ''); if (/,\d{1,8}\)?-?(€|eur)?$/i.test(s) && !/\.\d{1,2}$/.test(s)) c++; else if (/\.\d{1,8}\)?-?(€|eur)?$/i.test(s)) d++; });
    return c >= d ? ',' : '.';
  }

  // ---------- Rôles des colonnes ----------
  const has = (h, words) => words.some((w) => h.includes(w));
  const H = {
    date: ['date', 'jour', 'day', 'dateop', 'booking'],
    dateLow: ['valeur', 'value', 'started', 'debut'],                       // date de valeur : seulement à défaut
    label: ['libelle', 'label', 'description', 'intitule', 'motif', 'nature', 'payee', 'beneficiaire', 'contrepartie', 'counterparty', 'merchant', 'commercant', 'tiers', 'name', 'nom'],
    detail: ['detail', 'information', 'reference', 'memo', 'commentaire', 'complement', 'note'],
    amount: ['montant', 'amount', 'somme', 'total', 'valeur de l', 'mouvement', 'transaction'],
    notAmount: ['solde', 'balance', 'franc', 'foreign', 'etrang', 'origin', 'devise', 'currency', 'cours', 'rate', 'taux', 'numero', 'number', 'compte', 'account', 'reference'],
    debit: ['debit', 'depense', 'sortie', 'withdrawal', 'paid out', 'money out', 'retrait'],
    credit: ['credit', 'recette', 'entree', 'deposit', 'paid in', 'money in', 'versement'],
    sens: ['sens', 'side', 'debit/credit', 'd/c', 'cr/dr', 'direction'],
    fee: ['frais', 'fee', 'commission'],
    state: ['state', 'statut', 'status', 'etat'],
    currency: ['devise', 'currency', 'monnaie'],
    category: ['categorie', 'category'],
  };
  const SENS_VALUES = /^(d|c|db|cr|dr|debit|credit|debiteur|crediteur|\+|-|in|out|entree|sortie|incoming|outgoing)$/;
  const HEADER_WORDS = ['date', 'libell', 'montant', 'debit', 'credit', 'amount', 'description', 'label', 'operation', 'valeur', 'solde', 'devise', 'type', 'categ',
    'quantit', 'prix', 'frais', 'fee', 'balance', 'currency', 'reference', 'detail', 'statut', 'state', 'payee', 'btc', 'eur', 'sens', 'nature', 'intitul', 'motif'];

  function profile(rows, j) {
    const vals = rows.map((r) => r[j]).filter((v) => v != null && String(v).trim() !== '');
    const n = vals.length || 1;
    const dec = decimalOf(vals);
    const nums = vals.map((v) => parseAmount(v, dec));
    return {
      filled: vals.length / Math.max(1, rows.length),
      dateRatio: vals.filter((v) => parseDate(v)).length / n,
      numRatio: nums.filter((x) => x != null).length / n,
      decRatio: vals.filter((v) => /[.,]\d{1,8}\)?-?\s*(€|eur)?$/i.test(String(v).trim())).length / n,
      negRatio: nums.filter((x) => x != null && x < 0).length / n,
      sensRatio: vals.filter((v) => SENS_VALUES.test(strip(v).trim())).length / n,
      textLen: vals.reduce((a, v) => a + (/[a-z]/i.test(v) ? String(v).length : 0), 0) / n,
      distinct: new Set(vals.map((v) => strip(v))).size,
      dec,
    };
  }

  // Ligne de titres : la plus « titre » parmi les 40 premières (au moins 2 mots-clés, pas de montants)
  function findHeader(rows) {
    let best = -1, bestScore = 1;
    rows.slice(0, 40).forEach((r, i) => {
      if (r.length < 2) return;
      const hits = r.filter((c) => { const h = strip(c); return h.length < 60 && HEADER_WORDS.some((w) => h.includes(w)); }).length;
      const numeric = r.filter((c) => parseAmount(c) != null && /\d[.,]\d/.test(c)).length;
      const dates = r.filter((c) => parseDate(c)).length;
      const score = hits * 2 - numeric * 3 - dates * 3;
      if (hits >= 2 && score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  }

  // Analyse d'un tableau bancaire : renvoie le rôle de chaque colonne
  function mapBank(header, data) {
    const cols = Math.max(header ? header.length : 0, ...data.slice(0, 200).map((r) => r.length));
    const P = Array.from({ length: cols }, (_, j) => profile(data.slice(0, 300), j));
    const hs = Array.from({ length: cols }, (_, j) => strip(header ? header[j] : ''));
    const pick = (test, score) => { let b = -1, bs = -Infinity; for (let j = 0; j < cols; j++) if (test(j)) { const sc = score(j); if (sc > bs) { bs = sc; b = j; } } return b; };
    const map = { date: -1, label: -1, details: [], amount: -1, debit: -1, credit: -1, sens: -1, fee: -1, state: -1, currency: -1 };
    // Date : titre « date » (pas « valeur ») et contenu de dates ; sinon la colonne la plus « dates »
    map.date = pick((j) => P[j].dateRatio > 0.6 && has(hs[j], H.date) && !has(hs[j], H.dateLow), (j) => P[j].dateRatio + (has(hs[j], ['operation', 'op', 'completed', 'comptab', 'booking']) ? 1 : 0) - j * 0.01);
    if (map.date < 0) map.date = pick((j) => P[j].dateRatio > 0.6, (j) => P[j].dateRatio - (has(hs[j], H.dateLow) ? 0.5 : 0) - j * 0.01);
    const used = (j) => Object.values(map).some((v) => v === j) || map.details.includes(j);
    // Débit / Crédit
    map.debit = pick((j) => !used(j) && has(hs[j], H.debit) && !has(hs[j], H.credit) && P[j].numRatio > 0.5, (j) => -j);
    map.credit = pick((j) => !used(j) && has(hs[j], H.credit) && !has(hs[j], H.debit) && P[j].numRatio > 0.5, (j) => -j);
    // Sens (D/C, debit/credit…) : par le titre ou par le contenu
    map.sens = pick((j) => !used(j) && P[j].sensRatio > 0.8 && P[j].distinct <= 4, (j) => (has(hs[j], H.sens) ? 2 : 0) + P[j].sensRatio);
    if (map.debit < 0 || map.credit < 0) {
      map.debit = map.debit >= 0 && map.credit >= 0 ? map.debit : -1; map.credit = map.debit >= 0 ? map.credit : -1;
      // Montant : titre « montant/amount » hors solde/devise étrangère, contenu numérique avec décimales
      map.amount = pick((j) => !used(j) && j !== map.sens && P[j].numRatio > 0.8 && !has(hs[j], H.notAmount) && !has(hs[j], H.fee),
        (j) => (has(hs[j], H.amount) ? 3 : 0) + (/eur/.test(hs[j]) ? 1 : 0) + P[j].decRatio + P[j].negRatio * 0.5 - j * 0.01);
      // Sans titres, deux colonnes numériques rarement remplies ensemble = débit / crédit
      if (map.amount >= 0 && !header) {
        const nums = Array.from({ length: cols }, (_, j) => j).filter((j) => !used(j) && j !== map.amount && P[j].numRatio > 0.8 && P[j].decRatio > 0.8 && P[j].filled < 0.9);
        if (P[map.amount].filled < 0.9 && nums.length === 1) {
          const a = map.amount, b = nums[0], both = data.filter((r) => String(r[a] || '').trim() && String(r[b] || '').trim()).length;
          if (both / data.length < 0.1) { map.debit = Math.min(a, b); map.credit = Math.max(a, b); map.amount = -1; }
        }
      }
    }
    map.fee = pick((j) => !used(j) && has(hs[j], H.fee) && P[j].numRatio > 0.5, (j) => -j);
    map.state = pick((j) => !used(j) && has(hs[j], H.state), (j) => -j);
    map.currency = pick((j) => !used(j) && has(hs[j], H.currency) && !has(hs[j], H.amount) && P[j].numRatio < 0.2, (j) => -j);
    // Libellé : titre de libellé et le plus de texte ; à défaut, la colonne la plus textuelle
    map.label = pick((j) => !used(j) && P[j].textLen > 2 && !has(hs[j], H.category) && !has(hs[j], H.detail) && !has(hs[j], H.currency) && !has(hs[j], H.state),
      (j) => (has(hs[j], H.label) ? 50 : 0) + P[j].textLen + P[j].distinct * 0.01);
    map.details = Array.from({ length: cols }, (_, j) => j).filter((j) => !used(j) && j !== map.label && has(hs[j], H.detail) && P[j].textLen > 2);
    return { map, profiles: P };
  }

  const SKIP_STATE = /(declin|refus|revert|cancel|annul|fail|echou|rejet)/;
  // Relevé bancaire complet → opérations { date, label, amount (signé : − dépense, + revenu) }
  function readBank(text, opts) {
    const o = opts || {};
    const delim = o.delim || detectDelim(text);
    const rows = parseCSV(text, delim);
    const h = findHeader(rows);
    const header = h >= 0 ? rows[h] : null;
    const data = rows.slice(h + 1).filter((r) => r.length > 1);
    const { map, profiles } = mapBank(header, data);
    const m = Object.assign({}, map, o.map || {});
    const dateOrd = dateOrder(data.map((r) => r[m.date]));
    const decOf = (j) => (j >= 0 ? profiles[j].dec : ',');
    const out = []; let skipped = 0;
    data.forEach((r) => {
      const date = m.date >= 0 ? parseDate(r[m.date], dateOrd) : null;
      let amount = null;
      if (m.debit >= 0 || m.credit >= 0) {
        const d = m.debit >= 0 ? parseAmount(r[m.debit], decOf(m.debit)) : null, c = m.credit >= 0 ? parseAmount(r[m.credit], decOf(m.credit)) : null;
        if (d != null || c != null) amount = Math.abs(c || 0) - Math.abs(d || 0); // les débits notés « -82,40 » restent des débits
      } else if (m.amount >= 0) {
        amount = parseAmount(r[m.amount], decOf(m.amount));
        if (amount != null && m.sens >= 0) { const s = strip(r[m.sens]).trim(); const isDebit = /^(d|db|dr|debit|debiteur|-|out|sortie|outgoing)$/.test(s); amount = isDebit ? -Math.abs(amount) : Math.abs(amount); }
      }
      if (amount != null && m.fee >= 0) { const f = parseAmount(r[m.fee], decOf(m.fee)); if (f) amount -= Math.abs(f); }
      if (m.state >= 0 && SKIP_STATE.test(strip(r[m.state]))) { skipped++; return; }
      if (!date || amount == null || amount === 0) { skipped++; return; }
      const parts = [m.label >= 0 ? r[m.label] : ''].concat(m.details.map((j) => r[j])).map((x) => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
      const label = [...new Set(parts)].join(' · ') || 'Opération';
      out.push({ date, label, amount: Math.round(amount * 100) / 100, currency: m.currency >= 0 ? String(r[m.currency] || '').toUpperCase() : 'EUR' });
    });
    const unsigned = out.length > 2 && m.debit < 0 && m.credit < 0 && m.sens < 0 && out.every((x) => x.amount > 0);
    return { rows: out, skipped, delim, headerRow: h, header, map: m, unsigned, columns: header || (data[0] || []).map((_, j) => 'Colonne ' + (j + 1)) };
  }

  // ---------- Exports crypto (Bitstack et autres plateformes) ----------
  const CH = {
    type: ['type', 'operation', 'transaction', 'nature', 'sens', 'side', 'kind', 'categorie', 'category', 'action', 'libelle', 'description', 'label'],
    qty: ['quantite', 'quantity', 'qty', 'btc', 'sats', 'satoshi', 'crypto', 'volume', 'amount (btc', 'montant btc', 'montant en btc', 'received', 'recu'],
    eur: ['eur', '€', 'fiat', 'montant', 'amount', 'total', 'valeur', 'value', 'cost', 'cout', 'investi', 'spent', 'depense', 'paye'],
    price: ['prix', 'price', 'cours', 'rate', 'taux'],
    fee: ['frais', 'fee', 'commission'],
    asset: ['asset', 'actif', 'crypto-monnaie', 'cryptomonnaie', 'coin', 'symbol', 'symbole', 'ticker', 'devise', 'currency'],
    state: ['state', 'statut', 'status', 'etat'],
  };
  // Type d'opération → Achat, Vente, Gratuit (bonus : coût nul) ou Ignorer (retrait vers un portefeuille, dépôt d'euros…)
  function cryptoKind(v) {
    const s = strip(v);
    if (!s) return null;
    if (/(vente|sell|sale|cession|vendu)/.test(s)) return 'Vente';
    if (/(bonus|parrain|referral|cashback|reward|recompense|cadeau|gift|airdrop|offert|promo|staking|interet)/.test(s)) return 'Gratuit';
    if (/(retrait|withdraw|envoi|send|sent|transfert|transfer|sortie|depot|deposit|reception|receive|virement|frais|fee)/.test(s)) return 'Ignorer';
    if (/(achat|buy|bought|purchase|dca|arrondi|round|recurr|programm|investissement|invest|epargne|ponctuel|instant|order|ordre)/.test(s)) return 'Achat';
    return null;
  }
  function readCrypto(text, opts) {
    const o = opts || {};
    const delim = o.delim || detectDelim(text);
    const rows = parseCSV(text, delim);
    const h = findHeader(rows);
    const header = h >= 0 ? rows[h] : null;
    const data = rows.slice(h + 1).filter((r) => r.length > 1);
    const cols = Math.max(header ? header.length : 0, ...data.slice(0, 50).map((r) => r.length));
    const P = Array.from({ length: cols }, (_, j) => profile(data.slice(0, 300), j));
    const hs = Array.from({ length: cols }, (_, j) => strip(header ? header[j] : ''));
    const taken = new Set();
    const pick = (test, score) => { let b = -1, bs = -Infinity; for (let j = 0; j < cols; j++) if (!taken.has(j) && test(j)) { const sc = score(j); if (sc > bs) { bs = sc; b = j; } } if (b >= 0) taken.add(b); return b; };
    const map = {};
    map.date = pick((j) => P[j].dateRatio > 0.6, (j) => P[j].dateRatio + (has(hs[j], ['date']) ? 1 : 0) - j * 0.01);
    map.type = pick((j) => P[j].textLen > 1 && data.filter((r) => cryptoKind(r[j])).length / Math.max(1, data.length) > 0.6, (j) => (has(hs[j], CH.type) ? 2 : 0) - j * 0.01);
    map.fee = pick((j) => has(hs[j], CH.fee) && P[j].numRatio > 0.5, (j) => (/eur|€/.test(hs[j]) ? 1 : 0) - j * 0.01);
    map.price = pick((j) => has(hs[j], CH.price) && P[j].numRatio > 0.5, (j) => -j);
    // Quantité de crypto : titre (btc, quantité, sats) ou petits nombres à beaucoup de décimales
    const smallMany = (j) => data.filter((r) => { const v = String(r[j] || ''); const n = parseAmount(v, P[j].dec); return n != null && Math.abs(n) < 5 && /[.,]\d{5,}/.test(v); }).length / Math.max(1, data.length);
    map.qty = pick((j) => P[j].numRatio > 0.6 && (has(hs[j], CH.qty) && !/eur|€/.test(hs[j]) || smallMany(j) > 0.6), (j) => (has(hs[j], CH.qty) ? 2 : 0) + smallMany(j) - j * 0.01);
    map.eur = pick((j) => P[j].numRatio > 0.6 && !has(hs[j], ['solde', 'balance']) && (has(hs[j], CH.eur) || !header), (j) => (/eur|€|fiat/.test(hs[j]) ? 3 : 0) + (has(hs[j], CH.eur) ? 1 : 0) + P[j].decRatio - j * 0.01);
    map.asset = pick((j) => has(hs[j], CH.asset) && P[j].numRatio < 0.2 && P[j].distinct <= 10, (j) => -j);
    map.state = pick((j) => has(hs[j], CH.state), (j) => -j);
    Object.assign(map, o.map || {});
    const sats = map.qty >= 0 && /sat/.test(hs[map.qty]);
    const dateOrd = dateOrder(data.map((r) => r[map.date]));
    const out = []; let skipped = 0;
    data.forEach((r) => {
      const date = map.date >= 0 ? parseDate(r[map.date], dateOrd) : null;
      if (!date) { skipped++; return; }
      if (map.state >= 0 && SKIP_STATE.test(strip(r[map.state]))) { skipped++; return; }
      let q = map.qty >= 0 ? parseAmount(r[map.qty], P[map.qty].dec) : null; if (q != null && sats) q = q / 1e8;
      let eur = map.eur >= 0 ? parseAmount(r[map.eur], P[map.eur].dec) : null;
      const price = map.price >= 0 ? parseAmount(r[map.price], P[map.price].dec) : null;
      const fee = map.fee >= 0 ? Math.abs(parseAmount(r[map.fee], P[map.fee].dec) || 0) : 0;
      if (eur == null && q != null && price != null) eur = Math.abs(q) * price;
      let kind = map.type >= 0 ? cryptoKind(r[map.type]) : null;
      if (!kind) kind = (q != null && q < 0) || (eur != null && eur > 0 && q != null && q < 0) ? 'Vente' : 'Achat';
      if (q == null && eur == null) { skipped++; return; }
      out.push({ date, kind, q: q == null ? null : Math.abs(q), eur: eur == null ? null : Math.round(Math.abs(eur) * 100) / 100, fee: Math.round(fee * 100) / 100,
        asset: map.asset >= 0 ? String(r[map.asset] || '').trim() : '', raw: map.type >= 0 ? String(r[map.type] || '') : '' });
    });
    return { rows: out, skipped, delim, headerRow: h, header, map, columns: header || (data[0] || []).map((_, j) => 'Colonne ' + (j + 1)) };
  }
  // Fichier crypto plutôt que bancaire ?
  function looksCrypto(text) {
    const head = strip(String(text).slice(0, 3000));
    return /(btc|bitcoin|satoshi|\bsats\b|crypto|bitstack|quantite|quantity|ethereum|\beth\b|coinbase|binance|kraken)/.test(head);
  }

  const api = { decode, parseCSV, detectDelim, parseAmount, parseDate, dateOrder, findHeader, mapBank, readBank, readCrypto, cryptoKind, looksCrypto };
  root.CsvImp = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
