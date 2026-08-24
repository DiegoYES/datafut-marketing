const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { classifyMarket } = require('./lib/playdoit-semantics');

const pipelineDir = path.join(__dirname, '..', 'pipeline-state');
if (!fs.existsSync(pipelineDir)) {
  fs.mkdirSync(pipelineDir, { recursive: true });
}

function decimalToAmerican(dec) {
  if (!dec || isNaN(dec) || dec <= 1) return '+100';
  if (dec >= 2.0) {
    return `+${Math.round((dec - 1) * 100)}`;
  } else {
    return `-${Math.round(100 / (dec - 1))}`;
  }
}

(async () => {
  console.log('=== [PHASE 1: PLAYDOIT CATALOG] Building API preview (not publishable) ===');
  const generatedAt = new Date().toISOString();
  const targetDate = '2026-08-24';
  const navigationMode = 'headless';
  const evidenceSource = 'live_api';

  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navigating to PlayDoIt sportsbook...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(4000);

  const targetMatches = [
    { matchId: 'PD-24-001', eventId: 17300607, homeTeam: 'Tigre', awayTeam: 'Central Córdoba', league: 'Argentina Liga Profesional', startTime: '2026-08-24T16:00:00-06:00' },
    { matchId: 'PD-24-002', eventId: 16325502, homeTeam: 'Athletic Club SJDR', awayTeam: 'Novorizontino', league: 'Brasileirão Série B', startTime: '2026-08-24T16:30:00-06:00' },
    { matchId: 'PD-24-003', eventId: 16325505, homeTeam: 'Sport Recife', awayTeam: 'América Mineiro', league: 'Brasileirão Série B', startTime: '2026-08-24T16:30:00-06:00' },
    { matchId: 'PD-24-004', eventId: 16333086, homeTeam: 'Botafogo', awayTeam: 'Athletico Paranaense', league: 'Brasileirão Série A', startTime: '2026-08-24T17:00:00-06:00' },
    { matchId: 'PD-24-005', eventId: 16335537, homeTeam: 'Everton', awayTeam: 'Universidad de Concepción', league: 'Chile Copa Chile', startTime: '2026-08-24T17:30:00-06:00' },
    { matchId: 'PD-24-006', eventId: 16337705, homeTeam: 'Libertad', awayTeam: 'Macará', league: 'Ecuador LigaPro', startTime: '2026-08-24T18:00:00-06:00' },
    { matchId: 'PD-24-007', eventId: 17300610, homeTeam: 'Lanús', awayTeam: 'Argentinos Juniors', league: 'Argentina Liga Profesional', startTime: '2026-08-24T18:15:00-06:00' },
    { matchId: 'PD-24-008', eventId: 17300611, homeTeam: 'Talleres', awayTeam: 'Rosario Central', league: 'Argentina Liga Profesional', startTime: '2026-08-24T18:15:00-06:00' },
    { matchId: 'PD-24-009', eventId: 17414572, homeTeam: 'Leones FC', awayTeam: 'Real Cartagena', league: 'Colombia Primera B', startTime: '2026-08-24T16:00:00-06:00' },
    { matchId: 'PD-24-010', eventId: 17443004, homeTeam: 'Orsomarso', awayTeam: 'Real Cundinamarca', league: 'Colombia Primera B', startTime: '2026-08-24T16:00:00-06:00' },
    { matchId: 'PD-24-011', eventId: 17467446, homeTeam: 'Patriotas', awayTeam: 'Atlético de Cali', league: 'Colombia Primera B', startTime: '2026-08-24T16:30:00-06:00' },
    { matchId: 'PD-24-012', eventId: 17453065, homeTeam: 'Internacional de Palmira', awayTeam: 'Barranquilla', league: 'Colombia Primera B', startTime: '2026-08-24T18:45:00-06:00' },
    { matchId: 'PD-24-013', eventId: 17412275, homeTeam: 'Ferro Carril Oeste', awayTeam: 'All Boys', league: 'Argentina Primera Nacional', startTime: '2026-08-24T17:00:00-06:00' }
  ];

  console.log(`Querying markets for ${targetMatches.length} confirmed 2026-08-24 matches...`);

  const rawMatchData = await page.evaluate(async (matches) => {
    const results = [];
    for (const m of matches) {
      try {
        const res = await fetch(`https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails?culture=es-ES&timezoneOffset=360&integration=playdoit2&eventId=${m.eventId}`);
        if (!res.ok) {
          results.push({ ...m, error: `HTTP ${res.status}` });
          continue;
        }
        const json = await res.json();
        const oddsMap = new Map();
        (json.odds || []).forEach(o => oddsMap.set(o.id, o));

        const markets = (json.markets || []).map(mkt => {
          const allOddIds = [];
          if (mkt.desktopOddIds) {
            mkt.desktopOddIds.forEach(col => col.forEach(oid => allOddIds.push(oid)));
          }
          const odds = allOddIds.map(oid => oddsMap.get(oid)).filter(Boolean);
          return {
            id: mkt.id,
            name: mkt.name,
            shortName: mkt.shortName,
            sv: mkt.sv,
            typeId: mkt.typeId,
            odds: odds.map(o => ({
              id: o.id,
              name: o.name,
              price: o.price,
              sv: o.sv,
              typeId: o.typeId
            }))
          };
        });

        results.push({
          ...m,
          event: json.event || {},
          markets
        });
      } catch (err) {
        results.push({ ...m, error: err.message });
      }
    }
    return results;
  }, targetMatches);

  await browser.close();

  const catalogMatches = [];
  let totalMarketCount = 0;

  for (const raw of rawMatchData) {
    if (raw.error || !raw.markets || raw.markets.length === 0) {
      console.warn(`[CATALOG WARNING] Match ${raw.homeTeam} vs ${raw.awayTeam} had error or 0 markets: ${raw.error}`);
      continue;
    }

    const home = raw.homeTeam;
    const away = raw.awayTeam;
    const matchName = `${home} vs ${away}`;
    const structuredMarkets = [];
    const seenMarketKeys = new Set();

    for (const mkt of raw.markets) {
      const mName = mkt.name.trim();
      const semantics = classifyMarket(mName, home, away);
      if (!semantics.valid) continue;

      const overLines = [];
      const underLines = [];

      mkt.odds.forEach(o => {
        const oNameLow = o.name.toLowerCase();
        const svNum = parseFloat(o.sv || (o.name.match(/\d+(\.\d+)?/) || [NaN])[0]);
        if (!Number.isFinite(svNum)) return;
        const dec = o.price;
        const am = decimalToAmerican(dec);

        if (oNameLow.startsWith('más de') || oNameLow.startsWith('over') || oNameLow.startsWith('mas de')) {
          overLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: am, rawSelection: o.name, oddId: o.id });
        } else if (oNameLow.startsWith('menos de') || oNameLow.startsWith('under')) {
          underLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: am, rawSelection: o.name, oddId: o.id });
        }
      });

      const directions = [];
      if (overLines.length > 0) directions.push({ direction: 'over', lines: overLines });
      if (underLines.length > 0) directions.push({ direction: 'under', lines: underLines });

      if (directions.length > 0) {
        const marketKey = [mkt.id, semantics.subject, semantics.statistic, semantics.scope, semantics.period].join('|');
        if (seenMarketKeys.has(marketKey)) continue;
        seenMarketKeys.add(marketKey);
        structuredMarkets.push({
          marketId: mkt.id,
          marketText: mName,
          subject: semantics.subject,
          statistic: semantics.statistic,
          scope: semantics.scope,
          period: semantics.period,
          family: semantics.statistic,
          directions
        });
      }
    }

    totalMarketCount += structuredMarkets.length;
    catalogMatches.push({
      matchId: raw.matchId,
      eventId: raw.eventId,
      homeTeam: raw.homeTeam,
      awayTeam: raw.awayTeam,
      match: matchName,
      league: raw.league,
      startTime: raw.startTime,
      eventUrl: `https://www.playdoit.mx/#page=event&eventId=${raw.eventId}&sportId=66`,
      marketCoverage: 'PARTIAL',
      totalRawMarkets: raw.markets.length,
      markets: structuredMarkets
    });
  }

  const catalogOutput = {
    generatedAt,
    targetDate,
    targetWindow: 'highlighted football events after 15:00 CDMX',
    targetTimezone: 'America/Mexico_City',
    navigationMode,
    evidenceSource,
    catalogStatus: 'NOT_VERIFIED',
    marketCoverage: 'PARTIAL',
    totalMatchesCataloged: catalogMatches.length,
    totalStructuredMarkets: totalMarketCount,
    integrityNotice: 'Vista previa obtenida de la API de Altenar dentro del navegador. No constituye evidencia DOM y Discovery debe detenerse.',
    scopeNote: 'La semantica se deriva del marketText literal; mercados ambiguos se descartan.',
    matches: catalogMatches
  };

  const outputPath = path.join(pipelineDir, 'playdoit-catalog.json');
  fs.writeFileSync(outputPath, JSON.stringify(catalogOutput, null, 2));

  console.log(`\n[NOT VERIFIED] API preview saved with ${catalogMatches.length} matches and ${totalMarketCount} unique markets. DOM capture is still required: ${outputPath}`);
})();
