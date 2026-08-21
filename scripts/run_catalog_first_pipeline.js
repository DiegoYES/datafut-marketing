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

// Trivial market filter per skill definitions
function isTrivialMarket(t) {
  const low = t.toLowerCase().trim();
  
  if (/más de 0\.5 goles/i.test(low) && !low.includes('local') && !low.includes('visitante') && !low.includes('tiempo') && !low.includes('mitad')) {
    return true;
  }
  
  if ((low.includes('tiro a puerta') || low.includes('tiros a puerta') || low.includes('remate a portería') || low.includes('remate a puerta')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }

  if ((low.includes('tiro') || low.includes('tiros') || low.includes('remates')) && !low.includes('puerta') && !low.includes('portería') && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 2.5) return true;
  }

  if ((low.includes('tarjeta') || low.includes('amarilla')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 0.5) return true;
  }

  if ((low.includes('córner') || low.includes('corner') || low.includes('córners') || low.includes('corners') || low.includes('esquina')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }

  if (low.includes('falta') && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 2.5) return true;
  }

  return false;
}

// Semantic parser for DataFut picks
function parseDataFutPick(pick) {
  const t = pick.rawTitle.trim();
  const match = pick.match;
  const homeTeam = pick.homeTeam;
  const awayTeam = pick.awayTeam;

  let family = 'other';
  let subject = match;
  let statistic = 'unknown';
  let scope = 'match';
  let direction = 'over';
  let line = 0.5;
  let period = 'full_time';

  if (t.toLowerCase().includes('1er tiempo') || t.toLowerCase().includes('primer tiempo') || t.toLowerCase().includes('1ª mitad')) {
    period = 'first_half';
  } else if (t.toLowerCase().includes('2do tiempo') || t.toLowerCase().includes('segundo tiempo') || t.toLowerCase().includes('2ª mitad')) {
    period = 'second_half';
  }

  if (t.toLowerCase().startsWith('más de') || t.toLowerCase().startsWith('mas de') || t.toLowerCase().startsWith('over')) {
    direction = 'over';
  } else if (t.toLowerCase().startsWith('menos de') || t.toLowerCase().startsWith('under')) {
    direction = 'under';
  }

  const numMatch = t.match(/\d+(\.\d+)?/);
  if (numMatch) {
    line = parseFloat(numMatch[0]);
  }

  if (t.toLowerCase().includes('tiro a puerta') || t.toLowerCase().includes('tiros a puerta')) {
    statistic = 'shots_on_target';
    family = 'shots_on_target';
    if (t.toLowerCase().includes('del local') || t.toLowerCase().includes(homeTeam.toLowerCase())) {
      subject = homeTeam;
      scope = 'team';
    } else if (t.toLowerCase().includes('del visitante') || t.toLowerCase().includes(awayTeam.toLowerCase())) {
      subject = awayTeam;
      scope = 'team';
    } else {
      subject = match;
      scope = 'match';
    }
  } else if (t.toLowerCase().includes('tiro') || t.toLowerCase().includes('tiros')) {
    statistic = 'shots';
    family = 'shots';
    if (t.toLowerCase().includes('del local') || t.toLowerCase().includes(homeTeam.toLowerCase())) {
      subject = homeTeam;
      scope = 'team';
    } else if (t.toLowerCase().includes('del visitante') || t.toLowerCase().includes(awayTeam.toLowerCase())) {
      subject = awayTeam;
      scope = 'team';
    } else {
      subject = match;
      scope = 'match';
    }
  } else if (t.toLowerCase().includes('córner') || t.toLowerCase().includes('corner') || t.toLowerCase().includes('córners') || t.toLowerCase().includes('corners') || t.toLowerCase().includes('esquina')) {
    statistic = 'corners';
    if (t.toLowerCase().includes('del local') || t.toLowerCase().includes(homeTeam.toLowerCase())) {
      subject = homeTeam;
      scope = 'team';
      family = 'corners_team';
    } else if (t.toLowerCase().includes('del visitante') || t.toLowerCase().includes(awayTeam.toLowerCase())) {
      subject = awayTeam;
      scope = 'team';
      family = 'corners_team';
    } else {
      subject = match;
      scope = 'match';
      family = 'corners_total';
    }
  } else if (t.toLowerCase().includes('falta') || t.toLowerCase().includes('faltas')) {
    statistic = 'fouls';
    family = 'fouls';
    if (t.toLowerCase().includes('del local') || t.toLowerCase().includes(homeTeam.toLowerCase())) {
      subject = homeTeam;
      scope = 'team';
    } else if (t.toLowerCase().includes('del visitante') || t.toLowerCase().includes(awayTeam.toLowerCase())) {
      subject = awayTeam;
      scope = 'team';
    } else {
      subject = match;
      scope = 'match';
    }
  } else if (t.toLowerCase().includes('tarjeta') || t.toLowerCase().includes('tarjetas') || t.toLowerCase().includes('amarilla')) {
    statistic = 'yellow_cards';
    family = 'cards';
    if (t.toLowerCase().includes('del local') || t.toLowerCase().includes(homeTeam.toLowerCase())) {
      subject = homeTeam;
      scope = 'team';
    } else if (t.toLowerCase().includes('del visitante') || t.toLowerCase().includes(awayTeam.toLowerCase())) {
      subject = awayTeam;
      scope = 'team';
    } else {
      subject = match;
      scope = 'match';
    }
  } else if (t.toLowerCase().includes('local marca') || t.toLowerCase().includes('marca el local') || t.toLowerCase().includes('anota el local')) {
    statistic = 'goals';
    subject = homeTeam;
    scope = 'team';
    direction = 'over';
    line = 0.5;
    family = 'team_goals';
  } else if (t.toLowerCase().includes('visitante marca') || t.toLowerCase().includes('marca el visitante') || t.toLowerCase().includes('anota el visitante')) {
    statistic = 'goals';
    subject = awayTeam;
    scope = 'team';
    direction = 'over';
    line = 0.5;
    family = 'team_goals';
  } else if (t.toLowerCase().includes('gol') || t.toLowerCase().includes('goles')) {
    statistic = 'goals';
    family = 'goals';
    if (t.toLowerCase().includes('del local') || t.toLowerCase().includes('local más de') || t.toLowerCase().includes('local menos de')) {
      subject = homeTeam;
      scope = 'team';
      family = 'team_goals';
    } else if (t.toLowerCase().includes('del visitante') || t.toLowerCase().includes('visitante más de') || t.toLowerCase().includes('visitante menos de')) {
      subject = awayTeam;
      scope = 'team';
      family = 'team_goals';
    } else {
      subject = match;
      scope = 'match';
    }
  }

  let sampleHome = 10;
  let sampleAway = 10;
  const sampleMatch = pick.sampleLine ? pick.sampleLine.match(/muestra\s+(\d+)/i) : null;
  if (sampleMatch) {
    const val = parseInt(sampleMatch[1]);
    sampleHome = val;
    sampleAway = val;
  }

  return {
    match,
    league: pick.league,
    homeTeam,
    awayTeam,
    subject,
    statistic,
    scope,
    direction,
    line,
    period,
    market: pick.rawTitle,
    percentage: pick.percentage,
    sample: { home: sampleHome, away: sampleAway },
    evidence: pick.evidenceText && pick.evidenceText.length > 0 ? pick.evidenceText : [
      `Muestra DataFut: ${pick.sampleLine || 'Nativa'}`
    ],
    family,
    rawTitle: pick.rawTitle
  };
}

(async () => {
  console.log('========================================================================');
  console.log('  DATAFUT MARKETING: CATALOG-FIRST DISCOVERY, VERIFICATION & REFILL     ');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // FASE 1: PLAYDOIT CATALOG
  // -------------------------------------------------------------------------
  console.log('>>> FASE 1: EJECUTANDO PLAYDOIT-CATALOG (LIVE DOM)');
  const generatedAt = new Date().toISOString();
  const navigationMode = 'headed';
  // This pipeline uses live public API responses from inside a browser page.
  // Keep the provenance honest: it does not inspect rendered DOM markets.
  const evidenceSource = 'live_api';

  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('[PLAYDOIT] Navegando al sportsbook público de PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  const targetMatches = [
    { matchId: 'PD-001', eventId: 16807924, homeTeam: 'LDU Quito', awayTeam: 'Mirassol', league: 'CONMEBOL Libertadores' },
    { matchId: 'PD-002', eventId: 17281413, homeTeam: 'Macará', awayTeam: 'Santos', league: 'CONMEBOL Sudamericana' },
    { matchId: 'PD-003', eventId: 17414465, homeTeam: 'Leones FC', awayTeam: 'Real Cundinamarca', league: 'Colombia Primera B' },
    { matchId: 'PD-004', eventId: 16286846, homeTeam: 'Athletic Club', awayTeam: 'CRB', league: 'Brasileirão Série B' },
    { matchId: 'PD-005', eventId: 17413618, homeTeam: 'Real Cartagena', awayTeam: 'Bogotá FC', league: 'Colombia Primera B' },
    { matchId: 'PD-006', eventId: 16286848, homeTeam: 'Novorizontino', awayTeam: 'América Mineiro', league: 'Brasileirão Série B' },
    { matchId: 'PD-007', eventId: 16807923, homeTeam: 'Corinthians', awayTeam: 'Rosario Central', league: 'CONMEBOL Libertadores' }
  ];

  console.log(`[PLAYDOIT] Extrayendo mercados en vivo para ${targetMatches.length} partidos confirmados...`);

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

  // Process and structure catalog matches
  const catalogMatches = [];
  let totalStructuredMarkets = 0;

  for (const raw of rawMatchData) {
    if (raw.error || !raw.markets || raw.markets.length === 0) continue;

    const home = raw.homeTeam;
    const away = raw.awayTeam;
    const matchName = `${home} vs ${away}`;
    const structuredMarkets = [];

    for (const mkt of raw.markets) {
      const mName = mkt.name.trim();
      const mNameLow = mName.toLowerCase();

      let period = 'full_time';
      if (mNameLow.includes('1er tiempo') || mNameLow.includes('1ª mitad') || mNameLow.includes('primer tiempo')) {
        period = 'first_half';
      } else if (mNameLow.includes('2do tiempo') || mNameLow.includes('2ª mitad') || mNameLow.includes('segundo tiempo')) {
        period = 'second_half';
      }

      // Total Goals (Match)
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

      // Team Goals (Home)
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

      // Team Goals (Away)
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

      // Total Corners (Match)
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

      // Total Cards (Match)
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

      // Shots / Fouls / Statistics
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
        if (mNameLow.includes('tiro a puerta') || mNameLow.includes('tiros a puerta') || mNameLow.includes('remates a puerta')) stat = 'shots_on_target';
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

    totalStructuredMarkets += structuredMarkets.length;
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
    catalogStatus: 'OBSERVED_LIVE_API',
    totalMatchesCataloged: catalogMatches.length,
    totalStructuredMarkets,
    matches: catalogMatches
  };

  const catalogPath = path.join(pipelineDir, 'playdoit-catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalogOutput, null, 2));
  console.log(`[CATALOG] Catálogo comercial PlayDoIt guardado con ${catalogMatches.length} partidos y ${totalStructuredMarkets} mercados estructurados en ${catalogPath}`);

  // -------------------------------------------------------------------------
  // FASE 2: DATAFUT DISCOVERY (GUIADO POR CATÁLOGO)
  // -------------------------------------------------------------------------
  console.log('\n>>> FASE 2: EJECUTANDO DATAFUT-DISCOVERY (CATALOG-FIRST)');
  const allRawPicks = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_raw_datafut_picks.json'), 'utf8'));

  const catalogMatchMap = new Map();
  catalogMatches.forEach(m => {
    catalogMatchMap.set(`${m.homeTeam} vs ${m.awayTeam}`.toLowerCase(), m);
  });

  let statsDiscovery = {
    totalRawPicks: allRawPicks.length,
    discardedLessThan65: 0,
    discardedTrivial: 0,
    discardedNoMatchInCatalog: 0,
    discardedNoFamilyInCatalog: 0,
    discardedLineMismatchInCatalog: 0,
    totalIntersectionFound: 0
  };

  const candidatePool = [];

  for (const rawPick of allRawPicks) {
    if (rawPick.percentage === null || rawPick.percentage < 65.0) {
      statsDiscovery.discardedLessThan65++;
      continue;
    }

    if (isTrivialMarket(rawPick.rawTitle)) {
      statsDiscovery.discardedTrivial++;
      continue;
    }

    const parsed = parseDataFutPick(rawPick);
    const catMatch = catalogMatchMap.get(parsed.match.toLowerCase());
    if (!catMatch) {
      statsDiscovery.discardedNoMatchInCatalog++;
      continue;
    }

    let foundExactInCatalog = false;
    let catalogMarketFound = null;
    let catalogLineFound = null;

    for (const mkt of catMatch.markets) {
      if (mkt.statistic === parsed.statistic && mkt.scope === parsed.scope && mkt.period === parsed.period) {
        if (parsed.scope === 'team') {
          const pSubj = parsed.subject.toLowerCase();
          const mSubj = mkt.subject.toLowerCase();
          if (!pSubj.includes(mSubj) && !mSubj.includes(pSubj)) continue;
        }

        for (const dir of mkt.directions) {
          if (dir.direction === parsed.direction) {
            const exactLineObj = dir.lines.find(l => Math.abs(l.line - parsed.line) < 0.01);
            if (exactLineObj) {
              foundExactInCatalog = true;
              catalogMarketFound = mkt;
              catalogLineFound = exactLineObj;
              break;
            }
          }
        }
        if (foundExactInCatalog) break;
      }
    }

    if (foundExactInCatalog) {
      statsDiscovery.totalIntersectionFound++;
      // Priority classification
      let editorialPriority = 'high';
      let commercialPriority = 'normal';
      if (catalogLineFound.oddsDecimal <= 1.10) commercialPriority = 'very_low';
      else if (catalogLineFound.oddsDecimal <= 1.25) commercialPriority = 'low';

      candidatePool.push({
        catalogMatchId: catMatch.matchId,
        match: parsed.match,
        league: parsed.league,
        subject: parsed.subject,
        statistic: parsed.statistic,
        scope: parsed.scope,
        direction: parsed.direction,
        line: parsed.line,
        period: parsed.period,
        market: parsed.market,
        percentage: parsed.percentage,
        sample: parsed.sample,
        evidence: parsed.evidence,
        family: parsed.family,
        editorialPriority,
        commercialPriority,
        catalogMarketText: catalogMarketFound.marketText,
        catalogLine: catalogLineFound,
        rawTitle: parsed.rawTitle
      });
    } else {
      const familyExists = catMatch.markets.some(m => m.statistic === parsed.statistic);
      if (!familyExists) statsDiscovery.discardedNoFamilyInCatalog++;
      else statsDiscovery.discardedLineMismatchInCatalog++;
    }
  }

  // Deduplicate and rank candidates
  const uniqueCandidateMap = new Map();
  candidatePool.forEach(c => {
    const key = `${c.match}|${c.market}|${c.line}`;
    if (!uniqueCandidateMap.has(key)) {
      uniqueCandidateMap.set(key, c);
    }
  });

  const uniqueCandidates = Array.from(uniqueCandidateMap.values());
  // Sort: non-extreme odds first, then higher percentage, then larger sample
  uniqueCandidates.sort((a, b) => {
    const aExtreme = a.commercialPriority === 'very_low' ? 1 : 0;
    const bExtreme = b.commercialPriority === 'very_low' ? 1 : 0;
    if (aExtreme !== bExtreme) return aExtreme - bExtreme;
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return (b.sample.home + b.sample.away) - (a.sample.home + a.sample.away);
  });

  console.log(`[DISCOVERY] Candidatos únicos en intersección exacta: ${uniqueCandidates.length}`);

  // -------------------------------------------------------------------------
  // FASE 3 & 4: VERIFICATION & REPOSICIÓN
  // -------------------------------------------------------------------------
  console.log('\n>>> FASE 3 & 4: VERIFICACIÓN Y REPOSICIÓN MODULAR');

  let evaluatedSet = new Set();
  let verifiedResults = [];
  let candidateCounter = 1;
  let roundNum = 1;
  let allRoundsDiscovery = [];

  // Match Event Map for live verification
  const matchEventIdMap = {};
  catalogMatches.forEach(m => {
    matchEventIdMap[m.homeTeam + ' vs ' + m.awayTeam] = m.eventId;
  });

  async function verifyCandidateBatch(batch) {
    const results = await page.evaluate(async ({ batchToVerify, eventIdMap, currentRound }) => {
      const out = [];
      const cache = new Map();

      for (const c of batchToVerify) {
        const eventId = eventIdMap[c.match];
        if (!eventId) {
          out.push({
            candidateId: c.candidateId,
            round: currentRound,
            status: 'NOT_AVAILABLE',
            reason: 'NOT_AVAILABLE: Partido no encontrado en PlayDoIt.',
            requested: c,
            playdoit: null
          });
          continue;
        }

        if (!cache.has(eventId)) {
          try {
            const res = await fetch(`https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails?culture=es-ES&timezoneOffset=360&integration=playdoit2&eventId=${eventId}`);
            const data = await res.json();
            const oddsMap = new Map();
            (data.odds || []).forEach(o => oddsMap.set(o.id, o));
            const markets = (data.markets || []).map(m => {
              const allOddIds = [];
              if (m.desktopOddIds) m.desktopOddIds.forEach(col => col.forEach(oid => allOddIds.push(oid)));
              const odds = allOddIds.map(oid => oddsMap.get(oid)).filter(Boolean);
              return { ...m, odds };
            });
            cache.set(eventId, { event: data.event || {}, markets });
          } catch(e) {
            cache.set(eventId, { error: e.message, markets: [] });
          }
        }

        const evData = cache.get(eventId);
        if (evData.error || !evData.markets) {
          out.push({
            candidateId: c.candidateId,
            round: currentRound,
            status: 'NOT_VERIFIED',
            reason: `NOT_VERIFIED: Falló consulta de mercados en PlayDoIt (${evData.error})`,
            requested: c,
            playdoit: null
          });
          continue;
        }

        const allMarkets = evData.markets;
        let matched = false;
        let status = 'NOT_AVAILABLE';
        let reason = '';
        let playdoitData = null;

        // Verify exact match
        for (const mkt of allMarkets) {
          const mName = mkt.name.trim();
          const mNameLow = mName.toLowerCase();

          // Check period
          let period = 'full_time';
          if (mNameLow.includes('1er tiempo') || mNameLow.includes('1ª mitad') || mNameLow.includes('primer tiempo')) period = 'first_half';
          else if (mNameLow.includes('2do tiempo') || mNameLow.includes('2ª mitad') || mNameLow.includes('segundo tiempo')) period = 'second_half';

          if (period !== c.period) continue;

          // Check statistic & scope
          let matchesScopeAndStat = false;
          if (c.statistic === 'goals' && c.scope === 'match' && (mName === 'Total' || mName === 'Goles Totales' || (mNameLow.includes('total de goles') && !mNameLow.includes('corinthians') && !mNameLow.includes('rosario') && !mNameLow.includes('athletic') && !mNameLow.includes('crb') && !mNameLow.includes('novorizontino') && !mNameLow.includes('américa') && !mNameLow.includes('macará') && !mNameLow.includes('santos') && !mNameLow.includes('leones') && !mNameLow.includes('cundinamarca') && !mNameLow.includes('cartagena') && !mNameLow.includes('bogotá')))) {
            matchesScopeAndStat = true;
          } else if (c.statistic === 'goals' && c.scope === 'team' && mNameLow.includes(c.subject.toLowerCase()) && mNameLow.includes('total de goles')) {
            matchesScopeAndStat = true;
          } else if (c.statistic === 'corners' && c.scope === 'match' && (mNameLow === 'total de córners' || mNameLow === 'total tiros de esquina' || mNameLow === 'córners totales' || mNameLow === 'corners totales')) {
            matchesScopeAndStat = true;
          } else if (c.statistic === 'corners' && c.scope === 'team' && mNameLow.includes(c.subject.toLowerCase()) && (mNameLow.includes('tiros de esquina') || mNameLow.includes('córner'))) {
            matchesScopeAndStat = true;
          } else if ((c.statistic === 'yellow_cards' || c.statistic === 'cards') && (mNameLow === 'total de tarjetas' || mNameLow === 'tarjetas totales' || mNameLow === 'total tarjetas')) {
            matchesScopeAndStat = true;
          } else if (c.statistic === 'shots' && (mNameLow.includes('tiro') || mNameLow.includes('remate')) && !mNameLow.includes('puerta') && !mNameLow.includes('portería')) {
            if (c.scope === 'match' && !mNameLow.includes(c.subject.toLowerCase())) matchesScopeAndStat = true;
            else if (c.scope === 'team' && mNameLow.includes(c.subject.toLowerCase())) matchesScopeAndStat = true;
          } else if (c.statistic === 'shots_on_target' && (mNameLow.includes('tiro a puerta') || mNameLow.includes('remates a puerta') || mNameLow.includes('remate a portería'))) {
            if (c.scope === 'match' && !mNameLow.includes(c.subject.toLowerCase())) matchesScopeAndStat = true;
            else if (c.scope === 'team' && mNameLow.includes(c.subject.toLowerCase())) matchesScopeAndStat = true;
          } else if (c.statistic === 'fouls' && mNameLow.includes('falta')) {
            if (c.scope === 'match' && !mNameLow.includes(c.subject.toLowerCase())) matchesScopeAndStat = true;
            else if (c.scope === 'team' && mNameLow.includes(c.subject.toLowerCase())) matchesScopeAndStat = true;
          }

          if (!matchesScopeAndStat) continue;

          // Check line & direction
          const dirText = c.direction === 'over' ? 'más de' : 'menos de';
          const lineStr = String(c.line).replace('.', ',');

          const exactOdd = (mkt.odds || []).find(o => {
            const n = o.name.toLowerCase();
            const sv = parseFloat(o.sv || '0');
            return n.startsWith(dirText) && (sv === c.line || n.includes(lineStr) || n.includes(String(c.line)));
          });

          if (exactOdd) {
            matched = true;
            status = 'AVAILABLE_EXACT_API';
            let am = exactOdd.price >= 2.0 ? `+${Math.round((exactOdd.price - 1) * 100)}` : `-${Math.round(100 / (exactOdd.price - 1))}`;
            playdoitData = {
              matchText: evData.event.name || c.match,
              marketText: mkt.name,
              selectionText: exactOdd.name,
              oddsText: `${exactOdd.price.toFixed(2)} (${am})`,
              priceDecimal: exactOdd.price,
              priceAmerican: am,
              subject: c.subject,
              statistic: c.statistic,
              scope: c.scope,
              direction: c.direction,
              line: c.line,
              period: c.period,
              marketId: mkt.id,
              oddId: exactOdd.id
            };
            break;
          } else {
            status = 'LINE_MISMATCH';
            reason = `LINE_MISMATCH: Mercado ${mkt.name} presente pero sin línea ${c.line}.`;
          }
        }

        if (!matched && status !== 'LINE_MISMATCH') {
          status = 'MARKET_MISMATCH';
          reason = `MARKET_MISMATCH: Mercado para ${c.statistic} (${c.market}) no disponible en vivo.`;
        }

        out.push({
          candidateId: c.candidateId,
          round: currentRound,
          status,
          reason,
          verifiedAt: new Date().toISOString(),
          evidenceSource: 'live_api',
          requested: c,
          playdoit: playdoitData
        });
      }

      return out;
    }, { batchToVerify: batch, eventIdMap: matchEventIdMap, currentRound: roundNum });

    return results;
  }

  // --- EXECUTE ROUNDS ---
  let eligibleCandidates = [];
  const maxRounds = 4;

  while (eligibleCandidates.length < 6 && roundNum <= maxRounds) {
    console.log(`\n--- [ROUND ${roundNum}] Discovery & Verification ---`);
    const batchSize = roundNum === 1 ? 20 : 10;
    const currentBatch = [];

    for (const cand of uniqueCandidates) {
      const key = `${cand.match}|${cand.market}|${cand.line}`;
      if (!evaluatedSet.has(key) && currentBatch.length < batchSize) {
        evaluatedSet.add(key);
        const cId = `DF-${String(candidateCounter++).padStart(3, '0')}`;
        const item = { candidateId: cId, round: roundNum, ...cand };
        currentBatch.push(item);
        allRoundsDiscovery.push(item);
      }
    }

    console.log(`[ROUND ${roundNum}] Descubiertos ${currentBatch.length} candidatos nuevos para verificar.`);
    if (currentBatch.length === 0) {
      console.log(`[ROUND ${roundNum}] No hay más candidatos nuevos en el universo del catálogo.`);
      break;
    }

    const vResults = await verifyCandidateBatch(currentBatch);
    vResults.forEach(vr => {
      verifiedResults.push(vr);
      if (
        vr.status === 'AVAILABLE_EXACT' &&
        vr.evidenceSource === 'live_dom' &&
        vr.requested.percentage >= 65.0
      ) {
        eligibleCandidates.push(vr);
      }
    });

    console.log(`[ROUND ${roundNum}] Coincidencias API no publicables: ${vResults.filter(v => v.status === 'AVAILABLE_EXACT_API').length}.`);
    console.log(`[TOTAL ELEGIBLES ACUMULADOS]: ${eligibleCandidates.length} / 6 objetivo.`);

    if (eligibleCandidates.length >= 6) {
      console.log(`[SUCCESS] Objetivo de 6 candidatos elegibles alcanzado en la ronda ${roundNum}!`);
      break;
    }

    roundNum++;
  }

  await browser.close();

  // Save Discovery Candidates
  const discoveryOutput = {
    generatedAt: new Date().toISOString(),
    catalogGeneratedAt: generatedAt,
    minimumPercentage: 65.0,
    totalRoundsExecuted: roundNum,
    totalCandidatesDiscovered: allRoundsDiscovery.length,
    candidates: allRoundsDiscovery
  };
  fs.writeFileSync(path.join(pipelineDir, 'discovery-candidates.json'), JSON.stringify(discoveryOutput, null, 2));

  // Save Verified Candidates
  const verifiedOutput = {
    verifiedAt: new Date().toISOString(),
    navigationMode: 'headed',
    evidenceSource: 'live_api',
    publishable: false,
    integrityNotice: 'La coincidencia procede de API publica en vivo, no de observacion live_dom.',
    totalVerified: verifiedResults.length,
    totalAvailableExact: 0,
    totalAvailableExactApi: verifiedResults.filter(r => r.status === 'AVAILABLE_EXACT_API').length,
    totalEligible: eligibleCandidates.length,
    results: verifiedResults
  };
  fs.writeFileSync(path.join(pipelineDir, 'verified-candidates.json'), JSON.stringify(verifiedOutput, null, 2));

  // Summary counts for report
  const countExact = 0;
  const countExactApi = verifiedResults.filter(r => r.status === 'AVAILABLE_EXACT_API').length;
  const countLineMismatch = verifiedResults.filter(r => r.status === 'LINE_MISMATCH').length;
  const countScopeMismatch = verifiedResults.filter(r => r.status === 'SCOPE_MISMATCH').length;
  const countMarketMismatch = verifiedResults.filter(r => r.status === 'MARKET_MISMATCH').length;
  const countPeriodMismatch = verifiedResults.filter(r => r.status === 'PERIOD_MISMATCH').length;
  const countNotAvailable = verifiedResults.filter(r => r.status === 'NOT_AVAILABLE').length;
  const countNotVerified = verifiedResults.filter(r => r.status === 'NOT_VERIFIED').length;

  console.log('\n========================================================================');
  console.log('                          RESUMEN DE EJECUCIÓN                          ');
  console.log('========================================================================');
  console.log(`Partidos catalogados: ${catalogMatches.length}`);
  console.log(`Candidatos descubiertos: ${allRoundsDiscovery.length}`);
  console.log(`Candidatos verificados: ${verifiedResults.length}`);
  console.log(`AVAILABLE_EXACT: ${countExact}`);
  console.log(`AVAILABLE_EXACT_API (no publicable): ${countExactApi}`);
  console.log(`LINE_MISMATCH: ${countLineMismatch}`);
  console.log(`MARKET_MISMATCH: ${countMarketMismatch}`);
  console.log(`NOT_AVAILABLE: ${countNotAvailable}`);
  console.log(`NOT_VERIFIED: ${countNotVerified}`);
  console.log(`Eficiencia: ${(countExact / verifiedResults.length * 100).toFixed(1)}% (${countExact}/${verifiedResults.length})`);
  console.log('\nTop 6 Candidatos Elegibles:');
  eligibleCandidates.slice(0, 6).forEach((ec, idx) => {
    console.log(` ${idx+1}. [${ec.candidateId}] ${ec.requested.match} | ${ec.requested.market} | ${ec.requested.percentage}% | Cuota: ${ec.playdoit.oddsText} | Ronda ${ec.round} | ${ec.evidenceSource}`);
  });
})();
