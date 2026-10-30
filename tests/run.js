// Lance tous les tests sur le dossier app/ : node tests/run.js
// À exécuter avant chaque publication ; un seul « BUG » = on ne publie pas.
const { execFileSync } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '..'), APP = path.join(ROOT, 'app');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'investco-'));
const env = { ...process.env, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' };
let failed = 0;
for (const [name, args] of [
  ['Calculs (finance.js)', [path.join(__dirname, 'finance.test.js')]],
  ['Lecture CSV (csvimport.js)', [path.join(__dirname, 'csvimport.test.js')]],
  ['Bricks', [path.join(__dirname, 'bricks.test.js'), APP]],
  ['Autres modules', [path.join(__dirname, 'others.test.js'), APP]],
  ['Parcours utilisateur', [path.join(__dirname, 'ui.test.js'), APP]],
  ['Nouveautés v17', [path.join(__dirname, 'v17.test.js'), APP]],
  ['Nouveautés v18', [path.join(__dirname, 'v18.test.js'), APP]],
  ['Nouveautés v19 (direct, sécurité)', [path.join(__dirname, 'v19.test.js'), APP]],
  ['Nouveautés v20 (épargne, portefeuille, aide)', [path.join(__dirname, 'v20.test.js'), APP]],
  ['Nouveautés v21 (fiabilité, accueil, fiches, Bricks)', [path.join(__dirname, 'v21.test.js'), APP]],
  ['Import de relevés', [path.join(__dirname, 'import.test.js'), APP]],
  ['Mises à jour', [path.join(__dirname, 'update.test.js'), path.join(__dirname, 'fixtures', 'v16'), APP, path.join(tmp, 'serve')]],
]) {
  console.log('\n=== ' + name);
  try { process.stdout.write(execFileSync('node', args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(l => /^(OK|BUG|INFO)/.test(l)).join('\n') + '\n'); }
  catch (e) { failed++; process.stdout.write(String(e.stdout || '').split('\n').filter(l => /^(OK|BUG|INFO)/.test(l)).join('\n') + '\n'); }
}
console.log(failed ? `\n✗ ${failed} série(s) en échec : ne pas publier.` : '\n✓ Tous les tests passent.');
process.exitCode = failed ? 1 : 0;
