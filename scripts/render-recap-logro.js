// render-recap-logro.js
// Genera el grafico "SE LOGRO" para parlays acertados (estilo feed Instagram).
// FAIL-CLOSED: exige marcador FT por pick; sin resultados reales no se genera.
// Uso:
//   node scripts/render-recap-logro.js --data <recap.json> --out <png> [--w 1080 --h 1350]
// recap.json:
//   { "tier":"PREMIUM", "kind":"DOBLE", "momioAm":"+118", "dateLabel":"13-SEP",
//     "closeText":"13/09/26, 5:00 p.m.",
//     "picks":[ {"match":"A vs B","market":"...","decimal":"1.60",
//                 "score":"1 - 0 (FT)","dateTime":"13 sep 2026, 5:00 p.m."} ] }
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
  if (!Number.isFinite(n)) throw new Error(`Momio invalido: ${am}`);
  if (n >= 100) return (n / 100 + 1).toFixed(2);
  return (100 / Math.abs(n) + 1).toFixed(2);
}

(async () => {
  const dataArg = optionValue('--data');
  const outArg = optionValue('--out');
  if (!dataArg || !outArg) throw new Error('Uso: node scripts/render-recap-logro.js --data <recap.json> --out <png> [--w 1080 --h 1350]');
  const W = Number(optionValue('--w') || 1080);
  const H = Number(optionValue('--h') || 1350);
  const d = JSON.parse(fs.readFileSync(path.resolve(projectDir, dataArg), 'utf8'));

  // --- Puerta fail-closed: sin resultados reales no hay "SE LOGRO" ---
  const problems = [];
  if (!['PREMIUM', 'GRATIS'].includes(String(d.tier || '').toUpperCase())) problems.push('tier debe ser PREMIUM|GRATIS');
  const picks = Array.isArray(d.picks) ? d.picks : [];
  if (picks.length < 2) problems.push('se requieren 2+ picks');
  const expectKind = picks.length === 2 ? 'DOBLE' : picks.length === 3 ? 'TRIPLE' : null;
  if (!expectKind || String(d.kind || '').toUpperCase() !== expectKind) problems.push(`kind debe ser ${expectKind} para ${picks.length} picks`);
  picks.forEach((p, i) => {
    if (!p.match || !p.market) problems.push(`pick ${i + 1} sin match/market`);
    if (!p.score || !/\(FT\)/i.test(p.score)) problems.push(`pick ${i + 1} sin marcador FT real`);
    if (!p.decimal) problems.push(`pick ${i + 1} sin cuota decimal`);
  });
  if (!d.momioAm || !d.dateLabel) problems.push('falta momioAm/dateLabel');
  if (problems.length) throw new Error(`Recap bloqueado:\n- ${problems.join('\n- ')}`);

  const tier = d.tier.toUpperCase();
  const kind = d.kind.toUpperCase();
  const dec = americanToDecimal(d.momioAm);

  const rows = picks.map((p) => `<div class="row">
      <div class="rleft">
        <div class="rmatch">${esc(p.match)}</div>
        <div class="rmarket">${esc(p.market)}</div>
        <div class="rmeta">${esc(p.dateTime || '')} · Marcador: ${esc(p.score)}</div>
      </div>
      <div class="rright">
        <div class="rdec">${esc(p.decimal)}</div>
        <div class="ok">✓ ACERTADO</div>
      </div>
    </div>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { width:${W}px; min-height:${H}px; background:#04120c; color:#fff;
      font-family:'Segoe UI',Arial,sans-serif; position:relative; overflow:hidden;
      display:flex; flex-direction:column; align-items:center; padding:44px 48px 30px; }
    body::before { content:''; position:absolute; inset:0;
      background:
        radial-gradient(700px 380px at 12% 6%, rgba(16,185,129,.30), rgba(16,185,129,0) 70%),
        radial-gradient(800px 460px at 88% 22%, rgba(16,185,129,.22), rgba(16,185,129,0) 70%),
        radial-gradient(1000px 700px at 50% 108%, rgba(16,185,129,.25), rgba(16,185,129,0) 70%),
        linear-gradient(180deg, #03130c 0%, #04170e 45%, #020b07 100%); }
    .top { width:100%; display:flex; justify-content:space-between; align-items:flex-start; z-index:1; }
    .logo { display:flex; align-items:center; gap:14px; }
    .df { background:#10b981; color:#04120c; font-weight:900; font-size:54px; padding:2px 16px; border-radius:12px; }
    .lname { font-size:52px; font-weight:900; } .lname b { color:#10b981; }
    .slogan { font-size:24px; color:#e2e8f0; } .slogan b { color:#10b981; }
    .tag { text-align:right; color:#e2e8f0; font-size:22px; letter-spacing:2px; }
    .tag i { display:block; width:64px; height:8px; background:#10b981; margin-top:8px; margin-left:auto; }
    .hero { z-index:1; margin-top:26px; width:100%; text-align:center; transform:rotate(-3deg); }
    .band1 { display:inline-block; background:#10b981; color:#04120c; font-weight:900;
      font-size:64px; padding:8px 40px; letter-spacing:1px;
      clip-path:polygon(2% 12%, 98% 0%, 100% 82%, 1% 100%); }
    .big { font-weight:900; font-size:128px; letter-spacing:2px; line-height:1.02;
      text-shadow:0 4px 0 rgba(16,185,129,.35); }
    .big .chk { display:inline-block; border:10px solid #10b981; border-radius:50%;
      width:120px; height:120px; line-height:104px; font-size:72px; color:#10b981;
      vertical-align:middle; margin-left:10px; }
    .band2 { display:inline-block; background:#10b981; color:#04120c; font-weight:900;
      font-size:40px; padding:6px 34px; margin-top:6px;
      clip-path:polygon(1% 8%, 99% 0%, 98% 90%, 0% 100%); }
    .stats { z-index:1; width:100%; margin-top:24px; border:2px solid #10b981; border-radius:22px;
      display:flex; align-items:center; justify-content:space-around; padding:18px 10px;
      background:rgba(4,20,12,.72); }
    .stat { text-align:center; } .stat .v { color:#10b981; font-size:44px; font-weight:900; }
    .stat .l { color:#cbd5e1; font-size:20px; letter-spacing:2px; }
    .sep { width:2px; align-self:stretch; background:rgba(16,185,129,.5); }
    .sheet { z-index:1; width:100%; margin-top:22px; border:2px solid #10b981; border-radius:26px;
      background:rgba(3,14,9,.82); padding:26px 30px; }
    .shead { display:flex; justify-content:space-between; align-items:center; }
    .stitle { font-size:30px; font-weight:800; }
    .badges { display:flex; gap:10px; }
    .bd { font-size:20px; font-weight:800; padding:6px 14px; border-radius:999px; }
    .b1 { background:rgba(253,224,71,.15); color:#fde047; border:1px solid #fde047; }
    .b2 { background:rgba(56,189,248,.15); color:#38bdf8; border:1px solid #38bdf8; }
    .b3 { background:rgba(16,185,129,.15); color:#10b981; border:1px solid #10b981; }
    .close { color:#cbd5e1; font-size:22px; margin-top:14px; }
    .ptitle { font-size:32px; font-weight:800; margin-top:2px; }
    .row { display:flex; justify-content:space-between; gap:18px; margin-top:14px;
      background:rgba(16,185,129,.08); border-left:6px solid #10b981; border-radius:14px; padding:16px 20px; }
    .rmatch { font-size:28px; font-weight:800; } .rmarket { font-size:25px; color:#e2e8f0; }
    .rmeta { font-size:21px; color:#94a3b8; margin-top:4px; }
    .rright { text-align:right; min-width:170px; } .rdec { color:#10b981; font-size:34px; font-weight:800; }
    .ok { display:inline-block; margin-top:6px; font-size:21px; font-weight:800; color:#10b981;
      border:2px solid #10b981; border-radius:999px; padding:4px 14px; }
    .total { display:flex; justify-content:space-between; align-items:baseline; margin-top:16px; }
    .total .t { color:#10b981; font-size:24px; letter-spacing:2px; }
    .total .m { color:#10b981; font-size:40px; font-weight:900; }
    .props { z-index:1; width:100%; display:flex; margin-top:20px; }
    .prop { flex:1; text-align:center; padding:0 14px; }
    .prop + .prop { border-left:2px solid rgba(16,185,129,.4); }
    .prop .t { color:#10b981; font-size:23px; font-weight:800; }
    .prop .s { color:#e2e8f0; font-size:20px; }
    .cfoot { z-index:1; width:100%; margin-top:18px; border:2px solid rgba(16,185,129,.6);
      border-radius:22px; display:flex; padding:16px 26px; align-items:center;
      background:rgba(3,14,9,.82); }
    .soc { flex:1; font-size:22px; } .soc b { color:#10b981; }
    .web { flex:1; text-align:right; } .web .w { font-size:22px; letter-spacing:2px; }
    .web .d { color:#10b981; font-size:36px; font-weight:900; }
    .disc { z-index:1; margin-top:12px; color:#94a3b8; font-size:17px; text-align:center; }
  </style></head><body>
    <div class="top">
      <div class="logo"><div class="df">DF</div>
        <div><div class="lname">Data<b>-Fut</b></div>
        <div class="slogan">Compara. Analiza. <b>Decide mejor.</b></div></div>
      </div>
      <div class="tag">DATOS QUE<br>GENERAN<br>OPORTUNIDADES<i></i></div>
    </div>
    <div class="hero">
      <div class="band1">EL PICK ${tier}</div><br>
      <div class="big">SE LOGRÓ <span class="chk">✓</span></div><br>
      <div class="band2">PARLAY ${kind} ${esc(d.momioAm)} · ${esc(d.dateLabel)}</div>
    </div>
    <div class="stats">
      <div class="stat"><div class="v">◉ ${picks.length} PICKS</div></div><div class="sep"></div>
      <div class="stat"><div class="v">▤ ${picks.length} ACIERTOS</div></div><div class="sep"></div>
      <div class="stat"><div class="l">CUOTA TOTAL</div><div class="v">${esc(d.momioAm)}</div></div><div class="sep"></div>
      <div class="stat"><div class="l">CUOTA DECIMAL</div><div class="v">${dec}</div></div>
    </div>
    <div class="sheet">
      <div class="shead"><div class="stitle">🗓 Selección de Data-Fut</div>
        <div class="badges"><span class="bd b1">★ DESTACADA</span><span class="bd b2">${tier}</span><span class="bd b3">✓ ACERTADA</span></div>
      </div>
      <div class="close">CIERRA: ${esc(d.closeText || '')}</div>
      <div class="ptitle">Parlay ${kind.charAt(0) + kind.slice(1).toLowerCase()} ${esc(d.momioAm)}</div>
      ${rows}
      <div class="total"><div class="t">CUOTA TOTAL</div><div class="m">${dec} (${esc(d.momioAm)})</div></div>
    </div>
    <div class="props">
      <div class="prop"><div class="t">ANÁLISIS PROFUNDO</div><div class="s">Estadísticas, tendencias y contexto.</div></div>
      <div class="prop"><div class="t">PREDICCIONES CON VALOR</div><div class="s">Datos reales, no suposiciones.</div></div>
      <div class="prop"><div class="t">INFORMACIÓN CONFIABLE</div><div class="s">Transparencia y objetividad.</div></div>
    </div>
    <div class="cfoot">
      <div class="soc"><b>SÍGUENOS EN REDES SOCIALES</b><br>para no perderte las selecciones que compartimos.</div>
      <div class="web"><div class="w">VISITA</div><div class="d">DATA-FUT.COM</div></div>
    </div>
    <div class="disc">Las estadísticas y predicciones son informativas y no garantizan resultados. Juega responsablemente.</div>
  </body></html>`;

  killStaleAutomationChrome(['playwright'], 'recap');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const outPath = path.resolve(projectDir, outArg);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`Recap listo: ${outPath}`);
  } finally {
    await browser.close().catch(() => {});
  }
})().catch((e) => { console.error(`ERROR: ${e.message}`); process.exitCode = 1; });
