// Banc de test v16 : charge l'appli dans Chromium (fr-FR, Europe/Paris), sans réseau.
const { chromium } = (()=>{try{return require('playwright');}catch(e){return require('/opt/npm-tools/node_modules/playwright');}})();
const fs = require('fs'), path = require('path');
const SRC = process.argv[2];

// Stub Chart.js (CDN inaccessible ici) : objet neutre
const CHART_STUB = `window.Chart=function(){return{destroy(){},update(){},data:{datasets:[]},options:{}}};`;

async function openApp(browser, { seed, fixedNow } = {}) {
  const ctx = await browser.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'app.local') {
      const p = path.join(SRC, u.pathname === '/' ? 'index.html' : u.pathname);
      if (fs.existsSync(p)) return route.fulfill({ path: p });
      return route.fulfill({ status: 404, body: '' });
    }
    if (u.href.includes('chart.umd')) return route.fulfill({ body: CHART_STUB, contentType: 'text/javascript' });
    return route.fulfill({ status: 503, body: '' }); // pas de réseau
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  if (fixedNow) await page.clock.setFixedTime(new Date(fixedNow));
  if (seed) await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('investco_v1', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(seed));
  await page.goto('https://app.local/index.html');
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}
module.exports = { openApp, chromium, SRC };
