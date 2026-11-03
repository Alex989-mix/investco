/* Invest.co — registre des modules (v24), sans interface, testé dans tests/modules.test.js.
   Un module apporte des onglets, des entrées dans « Ajouter » et des données ; le socle (accueil,
   patrimoine net, compte courant, objectifs, sauvegardes, verrouillage) est toujours présent.
   Règles :
   - désactiver un module MASQUE ses écrans, il ne supprime jamais ses données ;
   - le patrimoine net et le récap fiscal se calculent toujours sur TOUTES les données ;
   - un identifiant de module est stable : on ne le renomme jamais (il est enregistré dans les réglages). */
(function (root) {
  'use strict';
  // nav : entrée de la barre du bas (null = pas d'onglet propre) ; place : sous-onglet de Placements ;
  // add : entrées de « Ajouter » (fn = fonction de l'appli ouverte au toucher) ; data : clés de DB qui lui appartiennent
  const MODULES = [
    { id: 'savings', label: 'Épargne réglementée', desc: 'Livrets A, LDDS, LEP, PEL, assurance-vie', icon: 'bank', tier: 'base', requires: [],
      place: { tab: 'epargne', label: 'Épargne', order: 20 }, add: [], data: ['savings'] },
    { id: 'stocks', label: 'Bourse', desc: 'PEA, compte-titres, ETF, actions, dividendes', icon: 'chart', tier: 'base', requires: [],
      place: { tab: 'bourse', label: 'Bourse', order: 10 },
      add: [{ id: 'mov', label: 'Opération', sub: 'achat, vente, dépôt, retrait, transfert', icon: 'chart', fn: 'editMov', order: 10 }], data: ['assets', 'pea'] },
    { id: 'crypto', label: 'Crypto', desc: 'Cours en direct, plus-values (formulaire 2086)', icon: 'bolt', tier: 'plus', requires: ['stocks'],
      place: null, add: [], data: [] }, // affiché dans l'onglet Bourse (enveloppe Crypto)
    { id: 'realty', label: 'Immobilier et crédits', desc: 'Résidence, locatif nu ou LMNP, emprunts', icon: 'home', tier: 'plus', requires: [],
      place: { tab: 'immo', label: 'Immobilier', order: 30 },
      add: [{ id: 'property', label: 'Bien immobilier', icon: 'home', fn: 'editProperty', order: 30 }, { id: 'loan', label: 'Crédit', icon: 'bank', fn: 'editLoan', order: 40 }],
      data: ['properties', 'loans'] },
    { id: 'crowd', label: 'Crowdfunding', desc: 'Bricks et plateformes de prêt, échéancier', icon: 'build', tier: 'plus', requires: ['savings'],
      place: { tab: 'crowd', label: 'Crowdfunding', order: 40 },
      add: [{ id: 'crowd', label: 'Projet Bricks / crowdfunding', icon: 'build', fn: 'editCrowd', order: 20 }], data: ['crowd'] },
    { id: 'budget', label: 'Budget', desc: 'Catégories, prévu et réel, dépenses récurrentes', icon: 'wallet', tier: 'base', requires: [],
      nav: { v: 'budget', label: 'Budget', order: 30 },
      add: [{ id: 'expense', label: 'Dépense du compte courant', icon: 'receipt', fn: 'editExpense', order: 50 }, { id: 'recurring', label: 'Dépense récurrente', icon: 'repeat', fn: 'editRecurring', order: 70 }],
      data: ['expenses', 'recurring'] },
    { id: 'resale', label: 'Achat-revente', desc: 'Marge, micro-BIC, seuils DAC7', icon: 'bag', tier: 'plus', requires: [],
      nav: { v: 'revente', label: 'Revente', order: 40 },
      add: [{ id: 'resale', label: 'Article d\'achat-revente', icon: 'bag', fn: 'editResale', order: 60 }], data: ['resale'] },
    { id: 'analyse', label: 'Analyse et fiscalité', desc: 'Évolution, répartition, performance, récap fiscal', icon: 'pie', tier: 'plus', requires: [],
      add: [], data: [] },
    { id: 'import', label: 'Import de relevés', desc: 'CSV ou PDF de banque, de livret, de plateforme crypto', icon: 'upload', tier: 'base', requires: [],
      add: [{ id: 'import', label: 'Importer un relevé', sub: 'CSV ou PDF', icon: 'upload', fn: 'openImport', order: 80 }], data: [] },
  ];
  const byId = (id) => MODULES.find((m) => m.id === id) || null;
  const ids = () => MODULES.map((m) => m.id);

  // Contrôle du registre : identifiants uniques, dépendances connues et sans cycle, onglets uniques
  function validate(list = MODULES) {
    const errors = [], seen = new Set(), tabs = new Set(), known = new Set(list.map((m) => m.id));
    list.forEach((m) => {
      if (!/^[a-z]+$/.test(m.id)) errors.push('identifiant invalide : ' + m.id);
      if (seen.has(m.id)) errors.push('identifiant en double : ' + m.id); seen.add(m.id);
      (m.requires || []).forEach((r) => { if (!known.has(r)) errors.push(m.id + ' dépend d\'un module inconnu : ' + r); });
      const t = m.place && m.place.tab; if (t) { if (tabs.has(t)) errors.push('onglet en double : ' + t); tabs.add(t); }
    });
    const visit = (id, path) => { if (path.includes(id)) { errors.push('dépendance circulaire : ' + path.concat(id).join(' → ')); return; }
      const m = list.find((x) => x.id === id); (m && m.requires || []).forEach((r) => visit(r, path.concat(id))); };
    list.forEach((m) => visit(m.id, []));
    return errors;
  }
  // Un module est-il utilisé ? (au moins une ligne dans l'une de ses données)
  function hasData(db, id) { const m = byId(id); return !!m && m.data.some((k) => Array.isArray(db && db[k]) && db[k].length > 0); }
  // Réglages par défaut : tous les modules d'aujourd'hui sont actifs (rien ne change pour un utilisateur existant)
  function defaults() { const o = {}; MODULES.forEach((m, i) => { o[m.id] = { on: true, order: m.place ? m.place.order : (i + 1) * 10 }; }); return o; }
  // Réglages complétés : un module apparu dans une version récente reçoit sa valeur par défaut, sans toucher aux choix existants
  function normalize(settings) {
    const cur = (settings && typeof settings === 'object') ? settings : {}, d = defaults(), out = {};
    Object.keys(cur).forEach((k) => { out[k] = Object.assign({}, cur[k]); }); // un module inconnu est conservé tel quel (version plus récente)
    Object.keys(d).forEach((k) => { if (!out[k] || typeof out[k].on !== 'boolean') out[k] = Object.assign({}, d[k], out[k] && typeof out[k].order === 'number' ? { order: out[k].order } : {}); });
    return out;
  }
  // Actif = coché ET ses dépendances actives
  function isOn(settings, id, _path = []) {
    const m = byId(id); if (!m) return false; const s = normalize(settings)[id];
    if (!s.on) return false; if (_path.includes(id)) return false;
    return (m.requires || []).every((r) => isOn(settings, r, _path.concat(id)));
  }
  const active = (settings) => MODULES.filter((m) => isOn(settings, m.id));
  // Activer un module active aussi ses dépendances ; désactiver un module désactive ceux qui en dépendent
  function setOn(settings, id, on) {
    const s = normalize(settings); if (!byId(id)) return s;
    const turnOn = (x) => { s[x].on = true; (byId(x).requires || []).forEach(turnOn); };
    const turnOff = (x) => { s[x].on = false; MODULES.filter((m) => (m.requires || []).includes(x)).forEach((m) => { if (s[m.id].on) turnOff(m.id); }); };
    if (on) turnOn(id); else turnOff(id);
    return s;
  }
  // Ce que l'interface affiche, construit depuis les modules actifs
  function placeTabs(settings) { const s = normalize(settings);
    return active(settings).filter((m) => m.place).map((m) => ({ tab: m.place.tab, label: m.place.label, module: m.id, order: s[m.id].order }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)); }
  function addEntries(settings) {
    return active(settings).flatMap((m) => m.add.map((a) => Object.assign({ module: m.id }, a))).sort((a, b) => a.order - b.order); }
  // Barre du bas : Accueil, Placements (si au moins un sous-onglet), modules à onglet propre, Ajouter
  function navEntries(settings) {
    const out = [{ v: 'dash', label: 'Accueil' }];
    if (placeTabs(settings).length) out.push({ v: 'placements', label: 'Placements' });
    active(settings).filter((m) => m.nav).sort((a, b) => a.nav.order - b.nav.order).forEach((m) => out.push({ v: m.nav.v, label: m.nav.label, module: m.id }));
    out.push({ v: 'add', label: 'Ajouter' });
    return out;
  }
  const api = { MODULES, byId, ids, validate, hasData, defaults, normalize, isOn, active, setOn, placeTabs, addEntries, navEntries };
  root.Mods = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
