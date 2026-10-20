// Test du parcours de mise à jour avec un vrai service worker (serveur local http://127.0.0.1).
// Usage : node update.test.js <dossier_appli_v16> <dossier_appli_actuelle> <dossier_temporaire_servi>
// Rejoue : v16 installée → déploiement de la version actuelle → future version (+0.1 dans version.js).
const { chromium } = (()=>{try{return require('playwright');}catch(e){return require('/opt/npm-tools/node_modules/playwright');}})();
const fs = require('fs'), path = require('path'), { spawn, execSync } = require('child_process');
const [V16, V161, SERVE] = process.argv.slice(2);
const PORT = 20000 + Math.floor(Math.random() * 20000), URL = `http://127.0.0.1:${PORT}/index.html`;
const out = [];
const log = (t, ok, d) => { out.push({ t, ok }); console.log((ok ? 'OK  ' : 'BUG ') + t + (d ? '  →  ' + JSON.stringify(d) : '')); };
// Déploie un dossier ; la v16 de référence ne contient que ses fichiers modifiés, le reste (polices, icônes) vient de l'appli actuelle
const deploy = (src) => { execSync(`rm -rf "${SERVE}" && mkdir -p "${SERVE}" && cp -r "${V161}/." "${SERVE}/" && cp -r "${src}/." "${SERVE}/"`);
  if (src === V16) fs.rmSync(path.join(SERVE, 'version.js'), { force: true }); };
const CUR = (fs.readFileSync(path.join(V161, 'version.js'), 'utf8').match(/APP_VERSION = '([^']+)'/) || [])[1];
const NEXT = String(Math.round((parseFloat(CUR) + 0.1) * 10) / 10);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  deploy(V16);
  const srv = spawn('python3', ['-I', '-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', SERVE], { stdio: 'ignore' });
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  process.on('unhandledRejection', (e) => { console.log('BUG Test interrompu : ' + String(e).split('\n')[0]); process.exit(1); });
  await sleep(800);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.route(/cdnjs|googleapis|gstatic|coingecko|yahoo/, r => r.request().url().includes('chart.umd')
    ? r.fulfill({ body: 'window.Chart=function(){return{destroy(){},update(){},data:{datasets:[]},options:{}}};', contentType: 'text/javascript' })
    : r.fulfill({ status: 503, body: '' }));
  let page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const controlled = async () => {
    for (let i = 0; i < 50; i++) { const ok = await page.evaluate(() => !!navigator.serviceWorker.controller).catch(() => false); if (ok) break; await sleep(200); }
    await sleep(1500); await page.waitForLoadState('load'); await page.waitForFunction(() => typeof DB !== 'undefined'); return true; };

  // --- 1. Utilisateur en v16 avec des données (un projet Bricks pointé en v16)
  await page.goto(URL); await controlled();
  await page.evaluate(() => {
    DB.crowd = [{ name: 'Mon projet', plat: 'Bricks', amt: 500, rate: 0.10, sub: '2025-09-08', dur: 24, day: 8, st: 'En cours', paid: ['2025-09', '2025-10'] }];
    save();
  });
  await page.reload(); await controlled();
  log('Départ : v16 installée et contrôlée par son service worker', await page.evaluate(() => typeof APP_V === 'undefined'));

  // --- 2. Cas réel : l'appli v16 est ouverte dans DEUX fenêtres (appli installée + onglet Chrome),
  //        puis la nouvelle version est déployée. Elle doit remplacer la v16 d'elle-même, sans rien fermer.
  const tab2 = await ctx.newPage(); await tab2.goto(URL); await sleep(1000);
  deploy(V161);
  await page.reload().catch(() => {});            // l'utilisateur rouvre / rafraîchit l'appli une fois
  const switched = async (p) => { for (let i = 0; i < 60; i++) { const v = await p.evaluate(() => typeof APP_V !== 'undefined' ? APP_V : null).catch(() => null); if (v) return v; await sleep(250); } return null; };
  const v1 = await switched(page), v2 = await switched(tab2);
  log('v16 → version actuelle sans rien fermer, dans les deux fenêtres', v1 === CUR && v2 === CUR, { fenêtre1: v1, fenêtre2: v2 });
  const errV16 = errors.splice(0); console.log('INFO erreurs pendant la phase v16 (ancien code) : ' + errV16.length);
  await tab2.close(); await controlled(); errors.splice(0);
  const after = await page.evaluate(() => ({ v: typeof APP_V !== 'undefined' ? APP_V : null, paid: DB.crowd[0].paid, schema: DB.meta.schema, backups: listBackups().map(b => b.reason) }));
  log('L\'appli tourne dans la version actuelle', after.v === CUR, after);
  log('Données conservées et migrées (cases Bricks 10/25, 11/25)', after.paid.join() === '2025-10,2025-11' && after.schema === 2, after);
  log('Sauvegarde de sécurité faite avant la migration', after.backups.some(r => r.startsWith('Avant migration')), after.backups);
  const news = await page.evaluate((v) => !!document.querySelector('#sheet') && document.querySelector('#sheet').textContent.includes('Nouveautés de la version ' + v), CUR);
  log('« Nouveautés » de la version actuelle s\'affiche une fois', news);
  const caches1 = await page.evaluate(async () => await caches.keys());
  log('Ancien cache v16 supprimé', !caches1.includes('investco-v16') && caches1.includes('investco-' + CUR), caches1);

  // --- 3. Cours : la fonction Netlify n'est jamais mise en cache
  await page.evaluate(async () => { await fetch('/.netlify/functions/quote?s=CW8.PA').catch(() => {}); });
  const cachedQuote = await page.evaluate(async () => { const c = await caches.open('investco-' + APP_V); return (await c.keys()).some(r => r.url.includes('/.netlify/functions/')); });
  log('Les cours (fonction Netlify) ne sont pas figés dans le cache', !cachedQuote);

  // --- 4. Version suivante : on ne modifie QUE version.js
  const vfile = path.join(SERVE, 'version.js');
  fs.writeFileSync(vfile, fs.readFileSync(vfile, 'utf8').replace(`APP_VERSION = '${CUR}'`, `APP_VERSION = '${NEXT}'`));
  await page.evaluate(() => checkUpdate(true)); await sleep(2500);
  const st2 = await page.evaluate(() => ({ bar: document.querySelector('#updbar').className, waiting: !!(swReg && swReg.waiting) }));
  log('Version suivante : changer uniquement version.js suffit à déclencher la mise à jour', st2.waiting && st2.bar.includes('on'), st2);
  await page.click('#updbar'); await sleep(3000); await controlled();
  const after2 = await page.evaluate(async () => ({ v: APP_V, keys: await caches.keys(), name: DB.crowd[0].name, bak: listBackups().length }));
  log('Après le clic : version suivante, données intactes, ancien cache supprimé', after2.v === NEXT && after2.name === 'Mon projet' && !after2.keys.includes('investco-' + CUR), after2);

  // --- 5. Hors ligne : l'appli s'ouvre quand même
  await ctx.setOffline(true);
  await page.reload().catch(() => {}); await sleep(1500);
  const off = await page.evaluate(() => ({ v: typeof APP_V !== 'undefined' ? APP_V : null, n: DB.crowd.length })).catch(e => ({ err: String(e) }));
  log('Hors ligne : l\'appli s\'ouvre avec ses données', off.v === NEXT && off.n === 1, off);
  await ctx.setOffline(false);

  // --- 6. Restauration d'une sauvegarde
  page.once('dialog', d => d.accept());
  await page.evaluate(() => { DB.crowd[0].name = 'Modifié'; save(); });
  const idx = await page.evaluate(() => listBackups().findIndex(b => JSON.parse(b.data).crowd[0].name === 'Mon projet'));
  await page.evaluate(i => restoreBackup(i), idx); await sleep(2000);
  const rest = await page.evaluate(() => DB.crowd[0].name);
  log('Restauration d\'une sauvegarde de sécurité', rest === 'Mon projet', { nom: rest });

  log('Aucune erreur JavaScript dans les nouvelles versions (CDN injoignable dans ce test)', errors.length === 0, errors);
  await browser.close(); srv.kill();
  process.exitCode = out.every(o => o.ok) ? 0 : 1;
})();
