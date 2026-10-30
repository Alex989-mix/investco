// Proxy de cours boursiers (Yahoo Finance) — exécuté côté serveur Netlify,
// donc pas de limite CORS et pas de clé API. Couvre Euronext Paris (ETF Amundi, PEA).
//   ?s=CW8.PA            → dernier cours + clôture de la veille
//   ?s=CW8.PA&d=AAAA-MM-JJ → dernier cours de clôture STRICTEMENT avant cette date (ex. 31/12 pour d = 1er janvier)
exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' };
  const q = event.queryStringParameters || {};
  const s = q.s || '', d = /^\d{4}-\d{2}-\d{2}$/.test(q.d || '') ? q.d : null;
  if (!s) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'missing s' }) };
  const hosts = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
  for (const h of hosts) {
    try {
      let url = h + '/v8/finance/chart/' + encodeURIComponent(s) + '?interval=1d&range=1d';
      if (d) { const t = Math.floor(Date.parse(d + 'T00:00:00Z') / 1000); url = h + '/v8/finance/chart/' + encodeURIComponent(s) + '?interval=1d&period1=' + (t - 12 * 86400) + '&period2=' + t; }
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InvestcoBot/1.0)' } });
      if (!r.ok) continue;
      const j = await r.json();
      const res = j && j.chart && j.chart.result && j.chart.result[0], m = res && res.meta;
      if (!m) continue;
      if (d) {
        const ts = res.timestamp || [], cl = (res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close) || [];
        let px = null, at = null;
        for (let i = 0; i < ts.length; i++) if (cl[i] != null && ts[i] < Date.parse(d + 'T00:00:00Z') / 1000) { px = cl[i]; at = ts[i]; }
        if (px != null) return { statusCode: 200, headers: Object.assign({}, cors, { 'Cache-Control': 'public, max-age=86400' }), body: JSON.stringify({ price: px, at, cur: m.currency || 'EUR', sym: s }) };
        continue;
      }
      if (m.regularMarketPrice != null) {
        return { statusCode: 200, headers: cors, body: JSON.stringify({ price: m.regularMarketPrice, prev: m.chartPreviousClose != null ? m.chartPreviousClose : (m.previousClose != null ? m.previousClose : null), t: m.regularMarketTime || null, cur: m.currency || 'EUR', sym: s }) };
      }
    } catch (e) { /* essaie l'hôte suivant */ }
  }
  return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'not found', sym: s }) };
};
