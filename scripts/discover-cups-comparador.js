// discover-cups-comparador.js
// Sweep del comparador DataFut para las copas europeas (UCL/UEL/UECL) del dia:
// por cada fixture del catalogo observa las tarjetas article.pick-card
// (mercado, %, confianza, muestra, slipMarket) y guarda el reporte.
// Uso: node scripts/discover-cups-comparador.js --date YYYY-MM-DD
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const projectDir = path.resolve(__dirname, '..');

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

(async () => {
  const targetDate = optionValue('--date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate || '')) throw new Error('Uso: discover-cups-comparador.js --date YYYY-MM-DD');
  const obs = readJson(path.join(projectDir, 'captures', 'dom', `playdoit-catalog-observation-${targetDate}.json`));
  const cupFixtures = (obs.events || []).filter(e => /(conference|europa|champions)/i.test(e.league || ''));
  if (cupFixtures.length === 0) throw new Error('Sin fixtures de copas europeas en el catalogo.');
  console.log(`Fixtures de copa: ${cupFixtures.length} (${[...new Set(cupFixtures.map(f => f.league))].join(', ')})`);

  const teamsMap = readJson(path.join(projectDir, 'config', 'comparador-teams.json'));
  const aliasMap = (() => {
    try { return readJson(path.join(projectDir, 'config', 'team-aliases.json')).aliases || {}; } catch { return {}; }
  })();
  function variants(team) {
    const names = [norm(team)];
    for (const [canonical, list] of Object.entries(aliasMap)) {
      const group = [canonical, ...((Array.isArray(list) ? list : [list]).filter(Boolean))].map(norm);
      if (group.includes(norm(team))) names.push(...group);
    }
    return [...new Set(names)];
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      storageState: path.join(projectDir, 'datafut-marketing-session.json'),
      viewport: { width: 1600, height: 1200 }
    });
    const page = await ctx.newPage();

  const leagueNick = lg => /champions/i.test(lg) ? 'UEFA Champions League' : /conference/i.test(lg) ? 'UEFA Europa Conference League' : /europa/i.test(lg) ? 'UEFA Europa League' : '';

  const tokenEquals = (a, b) => a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b));

  function scoreTeam(obsTokens, mapTokens) {
    const real = mapTokens.filter(t => t.length > 1 && !/^(fc|fk|sk|sc|ac|as|cf|cd|bk|nk|hnk|aif|psg|if)$/.test(t));
    if (!real.length) return 0;
    let matched = 0;
    for (const mt of real) if (obsTokens.some(ot => tokenEquals(mt, ot))) matched++;
    return matched / real.length;
  }

  function resolveTeam(leagueName, team) {
    const obsTokens = variants(team)[0].split(' ').filter(Boolean);
    const aliased = variants(team).slice(1).map(v => v.split(' ').filter(Boolean));
    const order = [leagueNick(leagueName), ...Object.keys(teamsMap).filter(k => k !== leagueNick(leagueName))].filter(Boolean);
    let best = null;
    for (const lgKey of order) {
      const ref = teamsMap[lgKey];
      for (const t of ref.teams) {
        if (!t.v) continue;
        let s = scoreTeam(obsTokens, norm(t.t).split(' ').filter(Boolean));
        if (aliased.length) s = Math.max(s, ...aliased.map(al => scoreTeam(al, norm(t.t).split(' ').filter(Boolean))));
        if (s > 0.9 && (!best || (lgKey === leagueNick(leagueName) && best.leagueKey !== lgKey) || s > best.score)) {
          best = { v: t.v, t: t.t, leagueValue: ref.leagueValue, leagueKey: lgKey, score: s };
        }
      }
      if (best && best.leagueKey === lgKey) break;
    }
    return best;
  }

    const sweep = { observedAt: new Date().toISOString(), targetDate, fixtures: [] };
    for (const fx of cupFixtures) {
      const lgName = fx.league || '';
      const home = resolveTeam(lgName, fx.homeTeam);
      const away = resolveTeam(lgName, fx.awayTeam);
      if (!home || !away) { console.log(`SKIP (equipo no mapeado): ${fx.eventText}`); sweep.fixtures.push({ event: fx.eventText, league: lgName, status: 'SKIP_EQUIPO' }); continue; }

      const url = `https://data-fut.com/comparador.html?local=${home.v}&leagueLocal=${home.leagueValue}&seasonLocal=2026&scopeLocal=local&limitLocal=all&halfLocal=0&visitante=${away.v}&leagueVisitante=${away.leagueValue}&seasonVisitante=2026&scopeVisitante=visitante&limitVisitante=all&halfVisitante=0`;
      try {
        await page.goto('https://data-fut.com/comparador.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000);
        async function elegirLado(idx, opt) {
          const lp = page.locator('button.league-picker-button').nth(idx);
          await lp.click();
          await page.waitForTimeout(2200);
          const leagueHit = page.locator('.league-picker-list:visible [role="button"], .league-picker-list:visible button').filter({ hasText: opt.leagueText }).first();
          await leagueHit.click({ timeout: 20000 });
          await page.waitForTimeout(2200);
          const tp = page.locator('button.team-picker-button').nth(idx);
          await tp.click();
          await page.waitForTimeout(2200);
          const teamHit = page.locator('[class*="team-picker-list"]:visible [role="button"], [class*="team-picker-list"]:visible button').filter({ hasText: opt.teamText }).first();
          await teamHit.click({ timeout: 20000 });
          await page.waitForTimeout(2600);
        }
        await elegirLado(0, { leagueText: leagueNick(lgName), teamText: home.t });
        await elegirLado(1, { leagueText: leagueNick(lgName), teamText: away.t });
        await page.click('#btn-picks', { timeout: 15000, force: true });
        await page.waitForTimeout(6500);
        const sourceUrl = page.url();
        const TOP_WHITELIST = /^(m[áa]s de (?:\d+(?:[.,]\d+)?) (?:goles|goles del local|goles del visitante|c[oó]rners totales|c[oó]rners del local|c[oó]rners del visitante|tarjetas amarillas totales|tarjetas amarillas del local|tarjetas amarillas del visitante)|menos de (?:\d+(?:[.,]\d+)?) (?:goles|goles del local|goles del visitante|c[oó]rners totales|c[oó]rners del local|c[oó]rners del visitante|tarjetas amarillas totales|tarjetas amarillas del local|tarjetas amarillas del visitante))$/i;
        const PERIODS = [
          { half: '0', period: 'full_time' },
          { half: '1', period: 'first_half' },
          { half: '2', period: 'second_half' }
        ];
        const periodSnapshots = [];
        for (const P of PERIODS) {
          if (P.half !== '0') {
            await page.selectOption('#half-a', P.half, { timeout: 15000, force: true });
            await page.selectOption('#half-b', P.half, { timeout: 15000, force: true });
            await page.click('#btn-picks', { timeout: 15000, force: true });
            await page.waitForTimeout(6500);
          }
          const cards = await page.evaluate(() => Array.from(document.querySelectorAll('article.pick-card')).map(c => ({
            market: ((c.querySelector('.pick-market') || {}).innerText || '').trim(),
            pctText: ((c.querySelector('.pick-estimate') || {}).innerText || '').trim(),
            meta: (((c.querySelector('.pick-meta') || {}).innerText || '').replace(/\s+/g, ' ')).trim(),
            reason: (((c.querySelector('.pick-reason') || {}).innerText || '').replace(/\s+/g, ' ')).trim(),
            slipMarket: (c.querySelector('[data-slip-market]') || {}).getAttribute('data-slip-market') || ''
          })));
          const top = cards
            .filter(c => TOP_WHITELIST.test(c.market))
            .sort((a, b) => parseFloat(b.pctText) - parseFloat(a.pctText) || (parseFloat(a.pctText) - parseFloat(b.pctText)))
            .slice(0, 8);
          periodSnapshots.push({
            period: P.period, half: P.half, sourceUrl: page.url(),
            cards: cards.length,
            top: top.map(c => ({ market: c.market, pct: c.pctText, meta: c.meta, reason: c.reason, slipMarket: c.slipMarket }))
          });
          if (P.half !== '0') {
            await page.selectOption('#half-a', '0', { timeout: 15000, force: true });
            await page.selectOption('#half-b', '0', { timeout: 15000, force: true });
            await page.click('#btn-picks', { timeout: 15000, force: true });
            await page.waitForTimeout(3000);
          }
        }
        sweep.fixtures.push({
          eventText: fx.eventText, league: lgName, eventId: fx.eventId,
          eventUrl: fx.url, startTime: fx.startTime || '',
          sourceUrl, status: 'OK', periods: periodSnapshots,
          cards: Math.max(...periodSnapshots.map(p => p.cards), 0),
          top: periodSnapshots[0].top
        });
        console.log(`${(fx.eventText || '').slice(0, 30).padEnd(32)} ${periodSnapshots.map(p => `${p.period}:${p.cards}(${p.top.length})`).join(' ')}`);
      } catch (e) {
        sweep.fixtures.push({ eventText: fx.eventText, league: lgName, eventUrl: fx.url, status: 'ERROR', error: e.message });
        console.log(`ERROR ${fx.eventText}: ${e.message}`);
      }
      await page.waitForTimeout(900);
    }
    const outPath = path.join(projectDir, 'captures', 'dom', `datafut-comparador-sweep-${targetDate}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(sweep, null, 2)}\n`);
    console.log(`Sweep escrito: ${outPath}`);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(`ERROR: ${e.message}`); process.exitCode = 1; });

