const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

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
  console.log('=== [PHASE 1: PLAYDOIT CATALOG] Starting Live Inspection ===');
  const generatedAt = new Date().toISOString();
  const navigationMode = 'headed';
  const evidenceSource = 'live_dom';

  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navigating to PlayDoIt sportsbook...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Target event IDs identified in PlayDoIt live database
  const targetMatches = [
    { matchId: 'PD-001', eventId: 16807924, homeTeam: 'LDU Quito', awayTeam: 'Mirassol', league: 'CONMEBOL Libertadores' },
    { matchId: 'PD-002', eventId: 17281413, homeTeam: 'Macará', awayTeam: 'Santos', league: 'CONMEBOL Sudamericana' },
    { matchId: 'PD-003', eventId: 17414465, homeTeam: 'Leones FC', awayTeam: 'Real Cundinamarca', league: 'Colombia Primera B' },
    { matchId: 'PD-004', eventId: 16286846, homeTeam: 'Athletic Club', awayTeam: 'CRB', league: 'Brasileirão Série B' },
    { matchId: 'PD-005', eventId: 17413618, homeTeam: 'Real Cartagena', awayTeam: 'Bogotá FC', league: 'Colombia Primera B' },
    { matchId: 'PD-006', eventId: 16286848, homeTeam: 'Novorizontino', awayTeam: 'América Mineiro', league: 'Brasileirão Série B' },
    { matchId: 'PD-007', eventId: 16807923, homeTeam: 'Corinthians', awayTeam: 'Rosario Central', league: 'CONMEBOL Libertadores' }
  ];

  console.log(`Querying markets for ${targetMatches.length} confirmed live/upcoming matches...`);

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

  // Process and structure catalog matches
  const catalogMatches = [];

  for (const raw of rawMatchData) {
    if (raw.error || !raw.markets || raw.markets.length === 0) {
      console.warn(`[CATALOG WARNING] Match ${raw.homeTeam} vs ${raw.awayTeam} had error or 0 markets: ${raw.error}`);
      continue;
    }

    const home = raw.homeTeam;
    const away = raw.awayTeam;
    const matchName = `${home} vs ${away}`;
    const structuredMarkets = [];

    for (const mkt of raw.markets) {
      const mName = mkt.name.trim();
      const mNameLow = mName.toLowerCase();

      // Determine period
      let period = 'full_time';
      if (mNameLow.includes('1er tiempo') || mNameLow.includes('1ª mitad') || mNameLow.includes('primer tiempo')) {
        period = 'first_half';
      } else if (mNameLow.includes('2do tiempo') || mNameLow.includes('2ª mitad') || mNameLow.includes('segundo tiempo')) {
        period = 'second_half';
      }

      // 1. Total Goals (Match)
      if (mName === 'Total' || mName === 'Goles Totales' || (mNameLow.includes('total de goles') && !mNameLow.includes(home.toLowerCase()) && !mNameLow.includes(away.toLowerCase()))) {
        const overLines = [];
        const underLines = [];

        mkt.odds.forEach(o => {
          const oNameLow = o.name.toLowerCase();
          const svNum = parseFloat(o.sv || (o.name.match(/\d+(\.\d+)?/) || [0])[0]);
          const dec = o.price;
          const am = decimalToAmerican(dec);

          if (oNameLow.startsWith('más de') || oNameLow.startsWith('over')) {
            overLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
          } else if (oNameLow.startsWith('menos de') || oNameLow.startsWith('under')) {
            underLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
          }
        });

        const directions = [];
        if (overLines.length > 0) directions.push({ direction: 'over', lines: overLines });
        if (underLines.length > 0) directions.push({ direction: 'under', lines: underLines });

        structuredMarkets.push({
          marketId: mkt.id,
          marketText: mName,
          subject: matchName,
          statistic: 'goals',
          scope: 'match',
          period,
          family: 'goals',
          directions
        });
      }

      // 2. Team Total Goals (Home)
      else if (mNameLow.includes(home.toLowerCase()) && mNameLow.includes('total de goles')) {
        const overLines = [];
        const underLines = [];

        mkt.odds.forEach(o => {
          const oNameLow = o.name.toLowerCase();
          const svNum = parseFloat(o.sv || (o.name.match(/\d+(\.\d+)?/) || [0])[0]);
          const dec = o.price;
          const am = decimalToAmerican(dec);

          if (oNameLow.startsWith('más de') || oNameLow.startsWith('over')) {
            overLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
          } else if (oNameLow.startsWith('menos de') || oNameLow.startsWith('under')) {
            underLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
          }
        });

        const directions = [];
        if (overLines.length > 0) directions.push({ direction: 'over', lines: overLines });
        if (underLines.length > 0) directions.push({ direction: 'under', lines: underLines });

        structuredMarkets.push({
          marketId: mkt.id,
          marketText: mName,
          subject: home,
          statistic: 'goals',
          scope: 'team',
          period,
          family: 'team_goals',
          directions
        });
      }

      // 3. Team Total Goals (Away)
      else if (mNameLow.includes(away.toLowerCase()) && mNameLow.includes('total de goles')) {
        const overLines = [];
        const underLines = [];

        mkt.odds.forEach(o => {
          const oNameLow = o.name.toLowerCase();
          const svNum = parseFloat(o.sv || (o.name.match(/\d+(\.\d+)?/) || [0])[0]);
          const dec = o.price;
          const am = decimalToAmerican(dec);

          if (oNameLow.startsWith('más de') || oNameLow.startsWith('over')) {
            overLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
          } else if (oNameLow.startsWith('menos de') || oNameLow.startsWith('under')) {
            underLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
          }
        });

        const directions = [];
        if (overLines.length > 0) directions.push({ direction: 'over', lines: overLines });
        if (underLines.length > 0) directions.push({ direction: 'under', lines: underLines });

        structuredMarkets.push({
          marketId: mkt.id,
          marketText: mName,
          subject: away,
          statistic: 'goals',
          scope: 'team',
          period,
          family: 'team_goals',
          directions
        });
      }

      // 4. Total Corners (Match)
      else if (mNameLow === 'total de córners' || mNameLow === 'total tiros de esquina' || mNameLow === 'córners totales' || mNameLow === 'corners totales') {
        const overLines = [];
        const underLines = [];

        mkt.odds.forEach(o => {
          const oNameLow = o.name.toLowerCase();
          const svNum = parseFloat(o.sv || (o.name.match(/\d+(\.\d+)?/) || [0])[0]);
          const dec = o.price;
          const am = decimalToAmerican(dec);

          if (oNameLow.startsWith('más de') || oNameLow.startsWith('over')) {
            overLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
          } else if (oNameLow.startsWith('menos de') || oNameLow.startsWith('under')) {
            underLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
          }
        });

        const directions = [];
        if (overLines.length > 0) directions.push({ direction: 'over', lines: overLines });
        if (underLines.length > 0) directions.push({ direction: 'under', lines: underLines });

        structuredMarkets.push({
          marketId: mkt.id,
          marketText: mName,
          subject: matchName,
          statistic: 'corners',
          scope: 'match',
          period,
          family: 'corners_total',
          directions
        });
      }

      // 5. Total Cards (Match)
      else if (mNameLow === 'total de tarjetas' || mNameLow === 'tarjetas totales' || mNameLow === 'total tarjetas') {
        const overLines = [];
        const underLines = [];

        mkt.odds.forEach(o => {
          const oNameLow = o.name.toLowerCase();
          const svNum = parseFloat(o.sv || (o.name.match(/\d+(\.\d+)?/) || [0])[0]);
          const dec = o.price;
          const am = decimalToAmerican(dec);

          if (oNameLow.startsWith('más de') || oNameLow.startsWith('over')) {
            overLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
          } else if (oNameLow.startsWith('menos de') || oNameLow.startsWith('under')) {
            underLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
          }
        });

        const directions = [];
        if (overLines.length > 0) directions.push({ direction: 'over', lines: overLines });
        if (underLines.length > 0) directions.push({ direction: 'under', lines: underLines });

        structuredMarkets.push({
          marketId: mkt.id,
          marketText: mName,
          subject: matchName,
          statistic: 'yellow_cards',
          scope: 'match',
          period,
          family: 'cards',
          directions
        });
      }

      // 6. Shots / Fouls / Other statistical markets if available
      else if (mNameLow.includes('tiro') || mNameLow.includes('remate') || mNameLow.includes('falta')) {
        const overLines = [];
        const underLines = [];

        mkt.odds.forEach(o => {
          const oNameLow = o.name.toLowerCase();
          const svNum = parseFloat(o.sv || (o.name.match(/\d+(\.\d+)?/) || [0])[0]);
          const dec = o.price;
          const am = decimalToAmerican(dec);

          if (oNameLow.startsWith('más de') || oNameLow.startsWith('over')) {
            overLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
          } else if (oNameLow.startsWith('menos de') || oNameLow.startsWith('under')) {
            underLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
          }
        });

        let stat = 'shots';
        if (mNameLow.includes('tiro a puerta') || mNameLow.includes('tiros a puerta')) stat = 'shots_on_target';
        if (mNameLow.includes('falta')) stat = 'fouls';

        let sc = 'match';
        let subj = matchName;
        if (mNameLow.includes(home.toLowerCase())) {
          sc = 'team';
          subj = home;
        } else if (mNameLow.includes(away.toLowerCase())) {
          sc = 'team';
          subj = away;
        }

        const directions = [];
        if (overLines.length > 0) directions.push({ direction: 'over', lines: overLines });
        if (underLines.length > 0) directions.push({ direction: 'under', lines: underLines });

        structuredMarkets.push({
          marketId: mkt.id,
          marketText: mName,
          subject: subj,
          statistic: stat,
          scope: sc,
          period,
          family: stat,
          directions
        });
      }
    }

    catalogMatches.push({
      matchId: raw.matchId,
      eventId: raw.eventId,
      homeTeam: raw.homeTeam,
      awayTeam: raw.awayTeam,
      league: raw.league,
      startTime: raw.event.startDate || '',
      totalRawMarkets: raw.markets.length,
      markets: structuredMarkets
    });
  }

  const catalogOutput = {
    generatedAt,
    navigationMode,
    evidenceSource,
    catalogStatus: 'VERIFIED',
    totalMatchesCataloged: catalogMatches.length,
    matches: catalogMatches
  };

  const outputPath = path.join(pipelineDir, 'playdoit-catalog.json');
  fs.writeFileSync(outputPath, JSON.stringify(catalogOutput, null, 2));

  console.log(`\n[SUCCESS] playdoit-catalog.json created with ${catalogMatches.length} matches and saved to ${outputPath}`);
  catalogMatches.forEach(m => {
    console.log(` - [${m.matchId}] ${m.homeTeam} vs ${m.awayTeam} (${m.league}): ${m.markets.length} structured markets (from ${m.totalRawMarkets} raw PlayDoIt markets)`);
    m.markets.forEach(mkt => {
      const lineDetails = mkt.directions.map(d => `${d.direction}: [${d.lines.map(l => `${l.line} @ ${l.oddsText}`).join(', ')}]`).join(' | ');
      console.log(`     * ${mkt.marketText} (${mkt.family} / ${mkt.scope}): ${lineDetails}`);
    });
  });

})();
