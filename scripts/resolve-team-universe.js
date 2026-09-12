// resolve-team-universe.js
// Resuelve equipos (DataFut) al universo REAL apostable de PlayDoIt.
// La API y el front nombran distinto; aqui se busca por EQUIPO (normalizado
// sin diacriticos) sobre el upcoming en vivo, y se devuelve el nombre de la
// competicion que PlayDoIt usa + eventId + horario CDMX.
// Uso:
//   node scripts/resolve-team-universe.js --teams "Boca,Cuiaba,Pumas"
//   node scripts/resolve-team-universe.js --teams "Boca" --date 2026-09-10
// Salida: captures/dom/playdoit-team-universe-<fecha>.json (evidencia live).
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const projectDir = path.resolve(__dirname, '..');

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function toMexicoCity(iso) {
  return new Date(new Date(iso).getTime() - 6 * 3600 * 1000);
}

(async () => {
  const teams = (optionValue('--teams') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (teams.length === 0) throw new Error('Uso: resolve-team-universe.js --teams "Boca,Cuiaba" [--date YYYY-MM-DD]');
  const dateFilter = optionValue('--date');
  if (dateFilter && !/^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) throw new Error('--date debe ser YYYY-MM-DD.');

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);
    const upcoming = await page.evaluate(async () => {
      const res = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetUpcoming?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66');
      const j = await res.json();
      const champs = {};
      (j.champs || []).forEach(c => { champs[c.id] = c.name; });
      return (j.events || []).map(e => ({ eventId: String(e.id), name: e.name, start: e.startDate, league: champs[e.champId] || '' }));
    });

    const today = new Date().toISOString().slice(0, 10);
    const out = { schemaVersion: 1, observedAt: new Date().toISOString(), source: 'live_api', teams: {} };
    for (const team of teams) {
      const needle = norm(team);
      const hits = upcoming
        .filter(e => norm(e.name).includes(needle))
        .filter(e => !dateFilter || toMexicoCity(e.start).toISOString().slice(0, 10) === dateFilter)
        .map(e => {
          const mx = toMexicoCity(e.start);
          return {
            eventId: e.eventId,
            name: e.name,
            league: e.league,
            startTime: `${mx.toISOString().slice(0, 10)}T${mx.toISOString().slice(11, 16)}:00-06:00`
          };
        });
      out.teams[team] = hits;
      console.log(`${team}: ${hits.length} partido(s) programado(s).`);
      hits.slice(0, 10).forEach(h => console.log(`  ${h.startTime.slice(0, 16)} | ${h.eventId} | ${h.name} | ${h.league}`));
    }
    const outPath = path.join(projectDir, 'captures', 'dom', `playdoit-team-universe-${dateFilter || today}.json`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`Universo escrito: ${outPath}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
