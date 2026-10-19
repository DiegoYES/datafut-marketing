// name-deliverables.js
// Genera copias con nombre editorial del video y portada:
//   reel.mp4   -> parlay-para-DD-MM-YYYY-Ham/pm.mp4
//   cover.png  -> parlay-para-DD-MM-YYYY-Ham/pm-portada.png
// La fecha-hora de resolucion se calcula con la MISMA regla editorial del
// titulo de boleta (kickoff del ULTIMO pick + 90 min, techo a la hora).
// Uso: node scripts/name-deliverables.js --dir renders/<paquete> [--rename]
const fs = require('node:fs');
const path = require('node:path');

const projectDir = path.resolve(__dirname, '..');

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function resolutionLabel(stateDir, picks) {
  const catalog = readJson(path.join(stateDir, 'playdoit-catalog.json'));
  const catByTeam = (catalog.matches || []).map(m => ({
    key: `${norm(m.homeTeam)}|${norm(m.awayTeam)}|${m.league || ''}`,
    start: m.startTime
  }));
  let last = null;
  for (const pick of picks || []) {
    const key = `${norm(pick.homeTeam)}|${norm(pick.awayTeam)}|${pick.league || ''}`;
    const hit = catByTeam.find(c => (c.key === key) || (norm(pick.homeTeam) === norm(pick.awayTeam) && false));
    if (!hit) return null;
    const st = new Date(hit.start);
    if (isNaN(st.getTime())) return null;
    if (!last || st > last) last = st;
  }
  if (!last) return null;
  const due = new Date(last.getTime() + 90 * 60 * 1000);
  if (due.getMinutes() > 0 || due.getSeconds() > 0 || due.getMilliseconds() > 0) due.setHours(due.getHours() + 1);
  due.setMinutes(0, 0, 0);
  return due;
}

(async () => {
  const dir = optionValue('--dir');
  const doRename = !!optionValue('--rename');
  const stampOverride = optionValue('--stamp');
  if (!dir || !fs.existsSync(dir)) throw new Error('Uso: name-deliverables.js --dir renders/<paquete> [--rename] [--stamp parlay-para-DD-MM-YYYY-Hham-ap]');
  const dataPath = path.join(dir, 'parlay-data.json');
  if (!fs.existsSync(dataPath)) throw new Error('paquete sin parlay-data.json');
  const data = readJson(dataPath);
  let stamp = stampOverride;
  if (!stamp) {
    const due = resolutionLabel(path.join(projectDir, 'pipeline-state'), data.picks);
    if (!due) throw new Error('No se resolvió kickoff del último pick: bloqueado (fail-closed; usa --stamp para históricos).');
    const ap = due.getHours() >= 12 ? 'pm' : 'am';
    const h12 = ((due.getHours() + 11) % 12) + 1;
    stamp = `parlay-para-${String(due.getDate()).padStart(2, '0')}-${String(due.getMonth() + 1).padStart(2, '0')}-${due.getFullYear()}-${h12}${ap}`;
  }

  const jobs = [
    ['reel.mp4', `${stamp}.mp4`],
    ['cover.png', `${stamp}-portada.png`]
  ];
  for (const [srcName, dstName] of jobs) {
    const src = path.join(dir, srcName);
    const dst = path.join(dir, dstName);
    if (!fs.existsSync(src)) { console.log(`  sin ${srcName}: omito`); continue; }
    if (fs.existsSync(dst)) { console.log(`  ya existe ${dstName}: no toco`); continue; }
    if (doRename) fs.renameSync(src, dst);
    else fs.copyFileSync(src, dst);
    console.log(`  ${srcName} -> ${dstName}${doRename ? ' (renombrado)' : ' (copia)'}`);
  }
  console.log(`Entregables nombrados: ${stamp}`);
})().catch(e => { console.error(`ERROR: ${e.message}`); process.exitCode = 1; });
