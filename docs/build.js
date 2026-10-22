// Génère la documentation d'une version :
//   docs/dist/Invest.co - Notes de version <v>.pdf
//   docs/dist/Invest.co - Guide utilisateur v<v>.pdf
// Usage : node docs/build.js          (captures d'écran + PDF)
//         node docs/build.js --no-shots (réutilise les captures existantes)
// Prérequis (une fois) : npm install --prefix docs   (Chart.js, pour de vrais graphiques sur les captures)
const fs = require('fs'), path = require('path');
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const ROOT = path.resolve(__dirname, '..'), APP = path.join(ROOT, 'app'), DOCS = __dirname, DIST = path.join(DOCS, 'dist'), IMG = path.join(DOCS, 'guide', 'img');
const CL = JSON.parse(fs.readFileSync(path.join(DOCS, 'changelog.json'), 'utf8')).versions;
const appVersion = (fs.readFileSync(path.join(APP, 'version.js'), 'utf8').match(/APP_VERSION = '([^']+)'/) || [])[1];
const cur = CL[0];
if (cur.version !== appVersion) { console.error(`✗ docs/changelog.json (${cur.version}) ne correspond pas à app/version.js (${appVersion}) : ajoutez la version en tête du changelog.`); process.exit(1); }
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const edition = (d) => { const [y, m] = d.split('-'); return MOIS[+m - 1] + ' ' + y; };
const dateFr = (d) => { const [y, m, j] = d.split('-'); return `${+j} ${MOIS[+m - 1]} ${y}`; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- 1. Captures de l'application (données d'exemple, date figée) ----------
async function shots(browser) {
  fs.mkdirSync(IMG, { recursive: true });
  const chart = [path.join(DOCS, 'node_modules/chart.js/dist/chart.umd.js')].find(fs.existsSync);
  if (!chart) console.warn('⚠ Chart.js absent (npm install --prefix docs) : les graphiques seront vides sur les captures.');
  const ctx = await browser.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'app.local') { const p = path.join(APP, u.pathname === '/' ? 'index.html' : u.pathname); return fs.existsSync(p) ? route.fulfill({ path: p }) : route.fulfill({ status: 404, body: '' }); }
    if (u.href.includes('chart.umd')) return chart ? route.fulfill({ path: chart, contentType: 'text/javascript' }) : route.fulfill({ body: 'window.Chart=function(){return{destroy(){},update(){},data:{datasets:[]},options:{}}};', contentType: 'text/javascript' });
    return route.fulfill({ status: 503, body: '' });
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(cur.date + 'T10:00:00+02:00'));
  await page.goto('https://app.local/index.html'); await page.waitForTimeout(1500);
  const shot = async (name, sel, clip) => { await page.waitForTimeout(500); await (sel ? page.locator(sel).first() : page).screenshot({ path: path.join(IMG, name + '.png'), ...(clip ? { clip } : {}) }); };
  const top = { x: 0, y: 0, width: 390, height: 760 };
  const BANK = 'Date;Libellé;Débit euros;Crédit euros;\n14/10/2026;PRLV SEPA FREE MOBILE;19,99;;\n12/10/2026;VIREMENT SALAIRE OCTOBRE;;1 850,00;\n10/10/2026;CB CARREFOUR 09/10;82,40;;\n08/10/2026;PRLV SEPA BITSTACK;25,00;;\n';
  const CRYPTO = 'Date;Type;Montant (EUR);Quantité (BTC);Prix du BTC (EUR);Frais (EUR)\n14/10/2026;Achat récurrent;10,00;0,00016234;61 598,12;0,15\n13/10/2026;Arrondi;0,37;0,00000601;61 560,00;0,00\n10/10/2026;Parrainage;0,00;0,00002000;61 000,00;0\n09/10/2026;Retrait;0;0,00100000;;\n';
  await shot('accueil', '#sheet');
  await page.evaluate(() => {
    closeSheet(); document.querySelector('#splash')?.remove();
    DB.settings.onboarded = true; DB.settings.lastBackup = ymd(today());
    DB.goals = [{ id: 'g1', name: 'Épargne de précaution', target: 25000, deadline: ymd(addMonths(today(), 12)), accounts: ['Livret A', 'LDDS'] }];
    DB.settings.catBudgets = { Courses: 300, Restau: 100, Loisirs: 80 };
    const m = ymKey(today());
    [['03', 'Carrefour', 82.4, 'Courses'], ['09', 'Lidl', 46.1, 'Courses'], ['15', 'Monoprix', 61.3, 'Courses'], ['11', 'Restaurant', 38, 'Restau'], ['18', 'Sushi', 74.5, 'Restau'],
      ['12', 'Cinéma', 24, 'Loisirs'], ['08', 'PRLV BITSTACK', 25, 'Investissement'], ['14', 'Pharmacie', 12.4, 'Santé']].forEach(([d, label, amt, cat]) => DB.expenses.push({ d: m + '-' + d, label, amt, cat }));
    save(); renderAll(); nav('dash');
  });
  await page.waitForTimeout(1200); await shot('tableau', null, top);
  await page.evaluate(() => { openSettings(); const l = [...document.querySelectorAll('#sheet label')].find((x) => x.textContent.includes('Ma situation fiscale')); l && l.scrollIntoView({ block: 'start' }); });
  await shot('reglages', '#sheet');
  await page.evaluate((t) => { closeSheet(); openImport(); document.querySelector('#imp_txt').value = t; impAnalyze(); document.querySelector('#imp_result').scrollIntoView({ block: 'start' }); }, BANK);
  await shot('import_banque', '#sheet');
  await page.evaluate((t) => { closeSheet(); openImport(); document.querySelector('#imp_txt').value = t; impAnalyze(); document.querySelector('#imp_result').scrollIntoView({ block: 'start' }); }, CRYPTO);
  await shot('import_bitstack', '#sheet');
  await page.evaluate(() => { closeSheet(); nav('placements'); setPlace('epargne'); }); await shot('epargne', '#v-placements');
  await page.evaluate(() => { nav('budget'); window.scrollTo(0, 0); }); await shot('budget', null, top);
  await page.evaluate(() => { nav('placements'); setPlace('immo'); const h = [...document.querySelectorAll('#place-body h2')].find((x) => x.textContent.includes('Crowdfunding')); if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 70); });
  await shot('bricks', null, top);
  await ctx.close();
}

// ---------- 2. Notes de version ----------
function notesHtml() {
  const TYPES = { new: ['Nouveau', '#F7931A'], improved: ['Amélioré', '#3D82AF'], fixed: ['Corrigé', '#3DD1A0'] };
  const prev = CL.slice(1, 13);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Invest.co — Notes de version ${cur.version}</title><style>
@font-face{font-family:'Inter';src:url('../app/Inter.woff2') format('woff2');font-weight:100 900}
@font-face{font-family:'Space Grotesk';src:url('../app/SpaceGrotesk.woff2') format('woff2');font-weight:300 700}
@page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0B1420;color:#E6EDF5;font-family:'Inter',sans-serif;font-size:10pt;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;overflow:hidden;page-break-after:always;padding:16mm 18mm 20mm;position:relative;background:radial-gradient(110mm 90mm at 100% 0%,rgba(247,147,26,.18),transparent 70%),#0B1420}
.logo{display:inline-flex;align-items:center;gap:9px;font:700 12pt 'Space Grotesk'}
.logo i{width:26px;height:26px;border-radius:50%;background:#091120;border:1px solid #28374a;display:inline-flex;align-items:center;justify-content:center}
.eyebrow{font-size:8pt;letter-spacing:.22em;text-transform:uppercase;color:#F7931A;font-weight:600;margin-top:10mm}
h1{font:700 34pt 'Space Grotesk';letter-spacing:-.02em;line-height:1;margin-top:3mm}
h1 span{color:#F7931A}
.title{font:600 15pt 'Space Grotesk';margin-top:4mm}
.date{color:#8DA0B5;margin-top:1.5mm}
h2{font:600 12pt 'Space Grotesk';margin:6mm 0 2.5mm;letter-spacing:-.01em}
.item{display:flex;gap:4mm;align-items:flex-start;background:#16202E;border:1px solid #1e2a3a;border-radius:12px;padding:2.8mm 4.5mm;margin-bottom:2mm;font-size:9.5pt;break-inside:avoid}
.tag{flex:none;font-size:7.5pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:.8mm 2.6mm;margin-top:.5mm;color:#0B1420}
.item p{color:#C9D5E2}
.box{border-radius:12px;padding:3.2mm 4.5mm;margin-top:2.5mm;font-size:9pt;color:#C9D5E2;break-inside:avoid}
.box b{color:#E6EDF5}
.b1{background:#2c1e10;border:1px solid rgba(247,147,26,.4)}.b2{background:#16202E;border:1px solid #28374a}
ol{margin:1.5mm 0 0 5mm}li{margin-bottom:1mm}
.hist{display:grid;grid-template-columns:16mm 1fr;gap:1.2mm 4mm;font-size:8.5pt;color:#8DA0B5}
.hist b{font-family:'Space Grotesk';color:#E6EDF5}
.foot{position:absolute;bottom:9mm;left:18mm;right:18mm;display:flex;justify-content:space-between;font-size:7.5pt;color:#63788A;border-top:1px solid #1e2a3a;padding-top:3mm}
</style></head><body><section class="page">
<span class="logo"><i><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F7931A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/></svg></i>Invest.co</span>
<div class="eyebrow">Notes de version</div>
<h1>Version <span>${esc(cur.version)}</span></h1>
<div class="title">${esc(cur.title)}</div><div class="date">Publiée le ${dateFr(cur.date)}</div>
<h2>Ce qui change</h2>
${cur.highlights.map((h) => `<div class="item"><span class="tag" style="background:${TYPES[h.type][1]}">${TYPES[h.type][0]}</span><p>${esc(h.text)}</p></div>`).join('')}
${cur.migration ? `<div class="box b2"><b>Vos données.</b> ${esc(cur.migration)}</div>` : ''}
<div class="foot"><span>Invest.co — Notes de version ${esc(cur.version)}</span><span>1 / 2</span></div>
</section><section class="page">
<span class="logo"><i><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F7931A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/></svg></i>Invest.co</span>
<h2 style="margin-top:10mm">Installer la mise à jour</h2>
<div class="box b1">La mise à jour est proposée automatiquement à l'ouverture de l'application.<ol><li>Touchez le bandeau orange <b>« Nouvelle version »</b>.</li><li>L'application redémarre et affiche l'écran <b>Nouveautés de la version ${esc(cur.version)}</b>.</li></ol>
<div style="margin-top:2mm">Une copie de sécurité de vos données est réalisée juste avant, et elle est restaurable dans <b>Réglages › Sauvegardes de sécurité</b>. Pour forcer la vérification : <b>Réglages › Vérifier les mises à jour</b>.</div></div>
<h2>Guide utilisateur</h2>
<div class="box b2">${cur.guide ? `Le guide utilisateur a été mis à jour pour cette version (<b>Guide utilisateur v${esc(cur.version)}</b>) :<ol>${(cur.guideChanges || []).map((g) => `<li>${esc(g)}</li>`).join('')}</ol>` : `Le guide utilisateur reste valable sans changement ; ses captures d'écran ont été actualisées pour la version ${esc(cur.version)}.`}</div>
${prev.length ? `<h2>Versions précédentes</h2><div class="hist">${prev.map((v) => `<b>${esc(v.version)}</b><span>${dateFr(v.date)} — ${esc(v.title)}</span>`).join('')}</div>` : ''}
<div class="foot"><span>Invest.co — Notes de version ${esc(cur.version)} · ${edition(cur.date)}</span><span>2 / 2</span></div>
</section></body></html>`;
}

// ---------- 3. PDF ----------
async function pdf(browser, htmlFile, out) {
  const page = await browser.newPage();
  await page.goto('file://' + htmlFile); await page.waitForTimeout(800);
  // contrôle : aucune page du guide ne déborde
  const over = await page.evaluate(() => [...document.querySelectorAll('.page')].map((s, i) => { const kids = [...s.children].filter((c) => !c.classList.contains('foot')); const b = Math.max(...kids.map((c) => c.getBoundingClientRect().bottom)); return b - s.getBoundingClientRect().top > s.getBoundingClientRect().height - 40 ? i + 1 : 0; }).filter(Boolean));
  await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.close();
  if (over.length) { console.error('✗ Contenu qui déborde, page(s) : ' + over.join(', ') + ' — ' + path.basename(out)); process.exitCode = 1; }
}

(async () => {
  const browser = await chromium.launch();
  if (!process.argv.includes('--no-shots')) { await shots(browser); console.log('✓ Captures mises à jour'); }
  fs.mkdirSync(DIST, { recursive: true });
  fs.readdirSync(DIST).filter((f) => f.endsWith('.pdf')).forEach((f) => fs.unlinkSync(path.join(DIST, f))); // on ne garde que la dernière version
  const guideSrc = fs.readFileSync(path.join(DOCS, 'guide', 'guide.html'), 'utf8').replace(/\{\{VERSION\}\}/g, cur.version).replace(/\{\{EDITION\}\}/g, edition(cur.date));
  const guideTmp = path.join(DOCS, 'guide', '.build.html'); fs.writeFileSync(guideTmp, guideSrc);
  const notesTmp = path.join(DOCS, '.notes.html'); fs.writeFileSync(notesTmp, notesHtml());
  const g = path.join(DIST, `Invest.co - Guide utilisateur v${cur.version}.pdf`), n = path.join(DIST, `Invest.co - Notes de version ${cur.version}.pdf`);
  await pdf(browser, guideTmp, g); await pdf(browser, notesTmp, n);
  fs.unlinkSync(guideTmp); fs.unlinkSync(notesTmp);
  await browser.close();
  console.log('✓ ' + path.relative(ROOT, g) + '\n✓ ' + path.relative(ROOT, n));
})();
