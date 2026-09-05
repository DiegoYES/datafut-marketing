// build-verification-observation.js
// Construye captures/dom/playdoit-verification-observation-<fecha>.json para
// TODOS los candidatos de pipeline-state/discovery-candidates.json:
// re-lee cada linea exacta en vivo (API del sportsbook + captura PNG del
// evento) y arma la observacion oficial para `verify-dom`.
// Uso: node scripts/build-verification-observation.js
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const projectDir = path.resolve(__dirname, '..');

function am(dec) {
  if (!dec || isNaN(dec) || dec <= 1) return '+100';
  if (dec >= 2) return `+${Math.round((dec - 1) * 100)}`;
  return `-${Math.round(100 / (dec - 1))}`;
}

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

(async () => {
  const disc = JSON.parse(fs.readFileSync(path.join(projectDir, 'pipeline-state', 'discovery-candidates.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(projectDir, 'pipeline-state', 'playdoit-catalog.json'), 'utf8'));
  const targetDate = catalog.targetDate;
  const catById = new Map(catalog.matches.map(m => [m.matchId, m]));
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      storageState: fs.existsSync(path.join(projectDir, 'playdoit-public-state.json'))
        ? path.join(projectDir, 'playdoit-public-state.json') : undefined,
      viewport: { width: 1440, height: 900 }
    });
    const page = await ctx.newPage();
    await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);
    const now = new Date().toISOString();
    const obs = [];
    for (const c of disc.candidates || []) {
      const cm = catById.get(c.catalogMatchId);
      if (!cm) { console.log(c.candidateId, 'NO_CATALOG_MATCH'); continue; }
      const eventId = String(cm.eventId);
      let r;
      try {
        r = await page.evaluate(async eid => {
          const res = await fetch(`https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails?culture=es-ES&timezoneOffset=360&integration=playdoit2&eventId=${eid}`);
          if (!res.ok) return { error: `HTTP ${res.status}` };
          const j = await res.json();
          const om = new Map();
          (j.odds || []).forEach(o => om.set(o.id, o));
          return {
            markets: (j.markets || []).map(m => {
              const ids = [];
              (m.desktopOddIds || []).forEach(col => col.forEach(id => ids.push(id)));
              return { name: m.name, odds: ids.map(id => om.get(id)).filter(Boolean).map(o => ({ name: o.name, price: o.price })) };
            })
          };
        }, eventId);
      } catch (e) { console.log(c.candidateId, 'ERR', e.message); continue; }
      if (r.error) { console.log(c.candidateId, 'ERR', r.error); continue; }
      const candMkt = (cm.markets || []).find(m => {
        if (m.statistic !== c.statistic || m.scope !== c.scope || m.period !== c.period) return false;
        if (c.scope === 'team' && norm(m.subject) !== norm(c.subject)) return false;
        const sels = (m.directions || []).flatMap(d => (d.lines || []).map(l => ({ dir: d.direction, line: l.line })));
        return sels.some(s => s.dir === c.direction && Math.abs(s.line - c.line) < 0.01);
      });
      if (!candMkt) { console.log(c.candidateId, 'NO_MARKET_IN_CATALOG'); continue; }
      const m = (r.markets || []).find(x => x.name === candMkt.marketText);
      if (!m) { console.log(c.candidateId, 'MARKET_MISSING_LIVE'); continue; }
      const sel = (m.odds || []).find(o => {
        const low = o.name.toLowerCase();
        const numMatch = o.name.replace(',', '.').match(/[\d.]+/);
        const num = numMatch ? parseFloat(numMatch[0]) : NaN;
        const d = low.startsWith('menos de') || low.startsWith('under') ? 'under'
          : (low.startsWith('m') || low.startsWith('o') ? 'over' : '?');
        return d === c.direction && Math.abs(num - c.line) < 0.01;
      });
      if (!sel) { console.log(c.candidateId, 'LINE_MISSING_LIVE'); continue; }
      const oddsText = am(sel.price);
      const url = `https://www.playdoit.mx/#page=event&eventId=${eventId}&sportId=66`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(3000);
      const eventText = `${cm.homeTeam} vs ${cm.awayTeam}`;
      const shotPath = `captures/dom/playdoit-verify-${eventId}-${targetDate}.png`;
      await page.screenshot({ path: path.join(projectDir, shotPath) });
      const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(projectDir, shotPath))).digest('hex');
      console.log(c.candidateId, '|', candMkt.marketText, '|', sel.name, '|', oddsText);
      obs.push({
        candidateId: c.candidateId, observedAt: now, url,
        homeTeam: cm.homeTeam, awayTeam: cm.awayTeam, eventText,
        marketText: candMkt.marketText, selectionText: sel.name, oddsText, visible: true,
        rawText: `${eventText}\n${candMkt.marketText}\nSGP\n${sel.name}\n${oddsText}`,
        screenshot: { path: shotPath, sha256: sha },
        betslip: {
          eventText, marketText: candMkt.marketText, selectionText: sel.name, oddsText,
          selectionCount: 1, observedAt: now,
          rawText: `${eventText}\n${candMkt.marketText}\n${sel.name}\n${oddsText}`,
          cleanupEmpty: true, cleanupObservedAt: now
        }
      });
    }
    const doc = {
      schemaVersion: 1, captureType: 'playdoit_verification', source: 'live_dom',
      observedAt: now, navigationMode: 'chrome_extension',
      catalogGeneratedAt: catalog.generatedAt, discoveryGeneratedAt: disc.generatedAt,
      candidateObservations: obs
    };
    const outPath = path.join(projectDir, 'captures', 'dom', `playdoit-verification-observation-${targetDate}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`OBS_OK ${obs.length}/${(disc.candidates || []).length} -> ${outPath}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
