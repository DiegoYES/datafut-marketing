// render-reel-cover.js
// Genera la miniatura/portada 1080x1920 del reel a partir del parlay-data.json
// del paquete renderizado. Uso:
//   node scripts/render-reel-cover.js --dir renders/<paquete> [--out cover.png]
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { killStaleAutomationChrome } = require('./lib/chrome-hygiene');

const projectDir = path.resolve(__dirname, '..');
function optionValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function americanToDecimal(am) {
  const n = parseInt(String(am).replace(/[+\s]/g, ''), 10);
  if (n >= 100) return (n / 100 + 1).toFixed(2);
  return (100 / Math.abs(n) + 1).toFixed(2);
}
function kickoffByCandidate(date) {
  const map = new Map();
  try {
    const disc = JSON.parse(fs.readFileSync(path.join(projectDir, 'pipeline-state', 'discovery-candidates.json'), 'utf8'));
    const cands = Array.isArray(disc) ? disc : disc.candidates || [];
    const cat = JSON.parse(fs.readFileSync(path.join(projectDir, 'pipeline-state', 'playdoit-catalog.json'), 'utf8'));
    const evByMatch = new Map((cat.matches || []).map((e) => [e.matchId, e]));
    for (const c of cands) {
      const ev = evByMatch.get(c.catalogMatchId);
      if (ev && ev.startTime) map.set(c.candidateId, String(ev.startTime).slice(11, 16));
    }
  } catch { /* sin horarios: la portada sale igual */ }
  return map;
}

(async () => {
  const dirArg = optionValue('--dir');
  if (!dirArg) throw new Error('Uso: node scripts/render-reel-cover.js --dir renders/<paquete> [--out cover.png]');
  const dir = path.resolve(projectDir, dirArg);
  const outName = optionValue('--out') || 'cover.png';
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'parlay-data.json'), 'utf8'));
  const picks = data.picks || [];
  const n = picks.length;
  const kind = n === 2 ? 'DOBLE' : n === 3 ? 'TRIPLE' : `x${n}`;
  const kickoffs = kickoffByCandidate(data.date);
  const dec = americanToDecimal(data.combinedOdds);

  const cards = picks.map((p, i) => {
    const ko = kickoffs.get(p.candidateId);
    return `<div class="card">
      <div class="picknum">PICK ${i + 1}${ko ? ` · HOY ${esc(ko)}` : ''}</div>
      <div class="match">${esc(p.homeTeam)} vs ${esc(p.awayTeam)}</div>
      <div class="market">${esc(p.market)}</div>
      <div class="meta"><span class="pct">${esc(p.percentage)}%</span><span class="odds">${esc(p.individualOdds)}</span></div>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { width:1080px; height:1920px; background:#050811; color:#fff;
      font-family:'Segoe UI',Arial,sans-serif; display:flex; flex-direction:column;
      align-items:center; padding:120px 72px 100px; position:relative; overflow:hidden; }
    body::before { content:''; position:absolute; top:-300px; left:50%; transform:translateX(-50%);
      width:1100px; height:1100px; border-radius:50%;
      background:radial-gradient(circle, rgba(16,185,129,.28) 0%, rgba(16,185,129,0) 65%); }
    .badge { border:2px solid #10b981; color:#6ee7b7; font-size:34px; font-weight:700;
      letter-spacing:6px; padding:14px 34px; border-radius:999px; z-index:1; }
    .date { color:#cbd5e1; font-size:32px; margin-top:22px; letter-spacing:2px; z-index:1; }
    .kind { color:#fde047; font-size:64px; font-weight:900; letter-spacing:10px; margin-top:70px; z-index:1; }
    .momio { color:#fde047; font-size:250px; font-weight:900; line-height:1; z-index:1;
      text-shadow:0 0 60px rgba(253,224,71,.35); }
    .momio-sub { color:#cbd5e1; font-size:34px; margin-top:10px; z-index:1; }
    .cards { width:100%; margin-top:70px; display:flex; flex-direction:column; gap:28px; z-index:1; }
    .card { background:rgba(255,255,255,.06); border:1px solid rgba(16,185,129,.5);
      border-radius:28px; padding:34px 40px; }
    .picknum { color:#10b981; font-size:30px; font-weight:800; letter-spacing:3px; }
    .match { font-size:46px; font-weight:800; margin-top:8px; }
    .market { color:#fde047; font-size:38px; font-weight:700; margin-top:6px; }
    .meta { margin-top:10px; display:flex; gap:24px; align-items:baseline; }
    .pct { color:#6ee7b7; font-size:40px; font-weight:800; }
    .odds { color:#cbd5e1; font-size:34px; }
    .foot { margin-top:auto; text-align:center; z-index:1; }
    .site { font-size:40px; font-weight:800; letter-spacing:2px; }
    .disc { color:#cbd5e1; font-size:24px; margin-top:12px; }
  </style></head><body>
    <div class="badge">DATAFUT · PARLAY DE DATOS</div>
    <div class="date">${esc(data.date || '')}</div>
    <div class="kind">${kind}</div>
    <div class="momio">${esc(data.combinedOdds)}</div>
    <div class="momio-sub">Momio PlayDoIt · decimal ${dec}</div>
    <div class="cards">${cards}</div>
    <div class="foot">
      <div class="site">data-fut.com</div>
      <div class="disc">Estimaciones estadísticas · No garantizan resultados</div>
    </div>
  </body></html>`;

  killStaleAutomationChrome(['playwright'], 'cover');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const outPath = path.join(dir, outName);
    await page.screenshot({ path: outPath });
    console.log(`Portada lista: ${outPath}`);
  } finally {
    await browser.close().catch(() => {});
  }
})().catch((e) => { console.error(`ERROR: ${e.message}`); process.exitCode = 1; });
