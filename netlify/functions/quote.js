// Proxy de cours boursiers (Yahoo Finance) — exécuté côté serveur Netlify,
// donc pas de limite CORS et pas de clé API. Couvre Euronext Paris (ETF Amundi, PEA).
exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' };
  const s = (event.queryStringParameters && event.queryStringParameters.s) || '';
  if (!s) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'missing s' }) };
  const hosts = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
  for (const h of hosts) {
    try {
      const r = await fetch(h + '/v8/finance/chart/' + encodeURIComponent(s) + '?interval=1d&range=1d',
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InvestcoBot/1.0)' } });
      if (!r.ok) continue;
      const d = await r.json();
      const m = d && d.chart && d.chart.result && d.chart.result[0] && d.chart.result[0].meta;
      if (m && m.regularMarketPrice != null) {
        return { statusCode: 200, headers: cors, body: JSON.stringify({ price: m.regularMarketPrice, cur: m.currency || 'EUR', sym: s }) };
      }
    } catch (e) { /* essaie l'hôte suivant */ }
  }
  return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'not found', sym: s }) };
};
