// Import au doigt : fichiers CSV chargés comme sur le téléphone (bouton « Fichier CSV »), banque et Bitstack.
const { openApp, chromium } = require('./harness');
const out = [];
const log = (t, ok, d) => { out.push(ok); console.log((ok ? 'OK  ' : 'BUG ') + t + (d !== undefined && !ok ? '  →  ' + JSON.stringify(d) : '')); };
const N = (s) => String(s || '').replace(/[  ]/g, ' ');
const latin1 = (s) => Buffer.from([...s].map((ch) => { const c = ch.charCodeAt(0); return c < 256 ? c : 0x3f; }));

const CA = 'Téléchargement du 22/10/2026\nCompte de Dépôt carte n° 123\n\nDate;Libellé;Débit euros;Crédit euros;\n14/10/2026;"PRLV SEPA FREE MOBILE\nECH/141026";19,99;;\n12/10/2026;VIREMENT SALAIRE OCTOBRE;;1 850,00;\n10/10/2026;CB CARREFOUR 09/10;82,40;;\n';
const BITSTACK = 'Date;Type;Montant (EUR);Quantité (BTC);Prix du BTC (EUR);Frais (EUR)\n14/10/2026 08:00;Achat récurrent;10,00;0,00016234;61 598,12;0,15\n13/10/2026 19:20;Arrondi;0,37;0,00000601;61 560,00;0,00\n10/10/2026;Parrainage;0,00;0,00002000;61 000,00;0\n09/10/2026;Retrait;0;0,00100000;;\n05/10/2026;Vente;150,00;0,00245000;61 224,49;1,50\n';

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await openApp(browser, { fixedNow: '2026-10-22T15:30:00+02:00' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.querySelector('#splash')?.remove(); closeSheet(); });
  const openImp = async () => { await page.locator('.nav a[data-v="add"]').click(); await page.waitForTimeout(100); await page.locator('#sheet button', { hasText: 'Importer un relevé' }).click(); await page.waitForTimeout(150); };
  const loadFile = async (name, buf) => { await page.setInputFiles('#imp_csv', { name, mimeType: 'text/csv', buffer: buf }); await page.waitForTimeout(400); };

  // ===== 1. Crédit Agricole, fichier en Windows-1252 avec lignes d'en-tête =====
  const cc0 = await page.evaluate(() => compteCourant().cap), ne0 = await page.evaluate(() => DB.expenses.length);
  await openImp(); await loadFile('CA20261022.csv', latin1(CA));
  const hint = N(await page.locator('#imp_body .hint').first().textContent());
  log('Crédit Agricole : format reconnu (2 lignes d\'en-tête ignorées, « ; », 3 opérations)', /2 lignes d'en-tête ignorées/.test(hint) && /3 opérations/.test(hint), hint);
  const rev = N(await page.locator('#imp_review').textContent());
  log('… libellé sur deux lignes et accents lus, sens correct (−19,99 / +1 850 / −82,40)', rev.includes('PRLV SEPA FREE MOBILE ECH/141026') && rev.includes('−20 €') && rev.includes('+1 850 €') && rev.includes('−82 €'), rev.slice(0, 300));
  await page.locator('#imp_body button', { hasText: 'Importer' }).last().click(); await page.waitForTimeout(300);
  const r1 = await page.evaluate(() => ({ exp: DB.expenses.slice(-2).map(e => [e.label, e.amt, e.cat]), cc: compteCourant().cap, sal: DB.movements.filter(m => m.n === 'import' && m.t === 'Dépôt').map(m => m.m), toast: document.querySelector('#toast').textContent }));
  log('Import : 2 dépenses (Carrefour en Courses), salaire en revenu, compte courant +1 747,61 €', r1.exp.length === 2 && r1.exp.some(e => e[0].includes('CARREFOUR') && e[2] === 'Courses') && JSON.stringify(r1.sal) === '[1850]' && Math.abs(r1.cc - cc0 - 1747.61) < 0.001, r1);
  await openImp(); await loadFile('CA20261022.csv', latin1(CA));
  await page.locator('#imp_body button', { hasText: 'Importer' }).last().click(); await page.waitForTimeout(300);
  const t2 = await page.evaluate(() => document.querySelector('#toast').textContent), ne2 = await page.evaluate(() => DB.expenses.length);
  log('Même fichier réimporté : 3 doublons ignorés, rien ajouté', /0 opération importée · 3 doublons ignorés/.test(t2) && ne2 === ne0 + 2, t2);

  // ===== 1b. Versements vers Bitstack dans le relevé bancaire : budget, catégorie « Investissement »
  const cc1 = await page.evaluate(() => compteCourant().cap);
  await openImp();
  await page.fill('#imp_txt', 'Date;Libellé;Montant\n15/10/2026;PRLV SEPA BITSTACK SAS;-10,00\n16/10/2026;VIR BITSTACK SAS VENTE;150,00\n17/10/2026;CB CARREFOUR;-20,00\n');
  await page.locator('#sheet button', { hasText: 'Analyser' }).click(); await page.waitForTimeout(200);
  const kd = await page.evaluate(() => impReview.map(r => [r.kind, r.cat || '']));
  log('Relevé bancaire : prélèvement Bitstack → Dépense « Investissement », virement reçu → Revenu', JSON.stringify(kd) === '[["Dépense","Investissement"],["Revenu",""],["Dépense","Courses"]]', kd);
  await page.locator('#imp_body button', { hasText: 'Importer' }).last().click(); await page.waitForTimeout(300);
  const bi = await page.evaluate(() => { nav('budget'); budMonth = 0; renderBudget(); return { cc: compteCourant().cap, txt: document.querySelector('#v-budget').textContent }; });
  log('Compte courant : −10 € −20 € +150 € ; budget « dont 10 € investis · … de dépenses courantes »', Math.abs(bi.cc - cc1 - 120) < 0.001 && /dont 10 € investis/.test(N(bi.txt)), { delta: bi.cc - cc1, extrait: (N(bi.txt).match(/dont.{0,60}/) || [])[0] });
  log('Catégorie « Investissement » visible dans « Prévu vs réel »', /Investissement\s*—\s*10 €/.test(N(bi.txt)), (N(bi.txt).match(/Investissement.{0,30}/) || [])[0]);
  const apo = await page.evaluate(() => { const a = consolidate().apports; DB.expenses = DB.expenses.filter(e => e.label !== 'PRLV SEPA BITSTACK SAS'); const b = consolidate().apports; return a - b; });
  log('Gain de l\'année : les 10 € envoyés vers Bitstack ne sont pas comptés comme une perte', Math.abs(apo + 10) < 0.001, apo);
  await page.evaluate(() => { nav('dash'); });

  // ===== 2. Fichier sans titres (LCL) collé dans la zone de texte =====
  await openImp();
  await page.fill('#imp_txt', '14/10/2026;-82,40;Carte;;CB LECLERC 13/10;0\n13/10/2026;-9,99;Prélèvement;;PRLV NETFLIX;0\n');
  await page.locator('#sheet button', { hasText: 'Analyser' }).click(); await page.waitForTimeout(200);
  const lcl = N(await page.locator('#imp_review').textContent());
  log('LCL sans titres : 2 opérations, libellés trouvés', /2 opérations/.test(lcl) && lcl.includes('CB LECLERC') && lcl.includes('PRLV NETFLIX'), lcl.slice(0, 200));
  // Correction manuelle d'une colonne : le libellé passe sur la colonne « Carte/Prélèvement »
  await page.locator('#imp_body select').nth(1).selectOption('2'); await page.waitForTimeout(150);
  const lcl2 = N(await page.locator('#imp_review').textContent());
  log('Changer la colonne « Libellé » met à jour l\'aperçu', lcl2.includes('Prélèvement') && !lcl2.includes('PRLV NETFLIX'), lcl2.slice(0, 200));
  await page.evaluate(() => closeSheet());

  // ===== 3. Bitstack =====
  const btc0 = await page.evaluate(() => { const a = DB.assets.find(x => x.name === 'Bitcoin'); const c = assetCalc(a); return { q: c.qty, inv: c.inv }; });
  await openImp(); await loadFile('bitstack_export.csv', Buffer.from(BITSTACK, 'utf8'));
  const bh = N(await page.locator('#imp_body .hint').first().textContent());
  log('Bitstack : reconnu comme export crypto, 5 opérations', /Export de plateforme crypto reconnu/.test(bh) && /5 opérations/.test(bh), bh);
  const kinds = await page.evaluate(() => impOps.map(o => o.kind));
  log('… types : Achat, Achat (arrondi), Gratuit (parrainage), Ignorer (retrait), Vente', JSON.stringify(kinds) === '["Achat","Achat","Gratuit","Ignorer","Vente"]', kinds);
  log('… actif cible proposé : Bitcoin', await page.inputValue('#op_asset') === 'Bitcoin');
  await page.locator('#imp_body button', { hasText: 'Importer' }).last().click(); await page.waitForTimeout(300);
  const b1 = await page.evaluate(() => { const a = DB.assets.find(x => x.name === 'Bitcoin'); const c = assetCalc(a); return { q: c.qty, inv: c.inv, toast: document.querySelector('#toast').textContent }; });
  // Quantité : +0,00016234 +0,00000601 +0,00002 −0,00245 ; retrait ignoré
  const dq = Math.round((b1.q - btc0.q) * 1e8) / 1e8;
  log('Import : quantité de BTC = achats + arrondi + parrainage − vente (−0,00226165)', dq === -0.00226165, { dq, toast: b1.toast });
  log('… « 4 opérations importées · 1 ignorée »', /4 opérations importées · 1 ignorée/.test(b1.toast), b1.toast);
  const mv = await page.evaluate(() => DB.movements.filter(m => m.p === 'Bitcoin' && String(m.n).startsWith('import')).map(m => [m.t, m.q, m.m, m.f]));
  log('… achat 10 € frais inclus → coût 9,85 € + 0,15 € de frais ; parrainage à coût nul', JSON.stringify(mv[0]) === '["Achat",0.00016234,9.85,0.15]' && JSON.stringify(mv[2]) === '["Achat",0.00002,0,0]', mv);
  await openImp(); await loadFile('bitstack_export.csv', Buffer.from(BITSTACK, 'utf8'));
  await page.locator('#imp_body button', { hasText: 'Importer' }).last().click(); await page.waitForTimeout(300);
  log('Bitstack réimporté : 4 doublons ignorés', /0 opération importée · 4 doublons ignorés/.test(await page.evaluate(() => document.querySelector('#toast').textContent)));

  // ===== 4. Base vierge sans actif crypto : « Bitcoin » créé à l'import =====
  await page.evaluate(() => { DB.assets = DB.assets.filter(a => a.type !== 'Crypto'); DB.movements = DB.movements.filter(m => !['Bitcoin', 'Ethereum'].includes(m.p)); save(); });
  await openImp(); await loadFile('bitstack.csv', Buffer.from(BITSTACK, 'utf8'));
  log('Sans actif crypto : « + Créer Bitcoin » proposé', await page.inputValue('#op_asset') === '__new');
  await page.locator('#imp_body button', { hasText: 'Importer' }).last().click(); await page.waitForTimeout(300);
  const nb = await page.evaluate(() => { const a = DB.assets.find(x => x.name === 'Bitcoin'); return a ? { type: a.type, env: a.env, n: DB.movements.filter(m => m.p === 'Bitcoin').length } : null; });
  log('… actif Bitcoin (Crypto, Bitstack) créé avec ses 4 opérations', nb && nb.type === 'Crypto' && nb.env === 'Bitstack' && nb.n === 4, nb);

  log('Aucune erreur JavaScript', errors.length === 0, errors);
  await browser.close();
  process.exitCode = out.every(Boolean) ? 0 : 1;
})();
