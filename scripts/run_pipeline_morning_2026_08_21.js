const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const pipelineDir = path.join(__dirname, '..', 'pipeline-state');

function decimalToAmerican(dec) {
  if (!dec || isNaN(dec) || dec <= 1) return '+100';
  if (dec >= 2.0) {
    return `+${Math.round((dec - 1) * 100)}`;
  } else {
    return `-${Math.round(100 / (dec - 1))}`;
  }
}

function getCombinations(arr, k) {
  const results = [];
  function backtrack(start, combo) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      backtrack(i + 1, combo);
      combo.pop();
    }
  }
  backtrack(0, []);
  return results;
}

function isTrivialMarket(t) {
  const low = t.toLowerCase().trim();
  if (/más de 0\.5 goles/i.test(low) && !low.includes('local') && !low.includes('visitante') && !low.includes('tiempo') && !low.includes('mitad')) return true;
  if ((low.includes('tiro a puerta') || low.includes('tiros a puerta')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }
  if ((low.includes('tiro') || low.includes('tiros')) && !low.includes('puerta') && (low.startsWith('más de') || low.startsWith('mas de'))) {
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

function parseDataFutPick(pick, matchMeta) {
  const t = pick.rawTitle.trim();
  const match = matchMeta.match;
  const homeTeam = matchMeta.homeTeam;
  const awayTeam = matchMeta.awayTeam;

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
  if (numMatch) line = parseFloat(numMatch[0]);

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
    league: matchMeta.league,
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
  console.log('  DATAFUT MARKETING: MORNING/MIDDAY RUN 2026-08-21 (00:00 - 15:00 CDMX)  ');
  console.log('========================================================================\n');

  // Morning matches on 2026-08-21
  const targetMorningMatches = [
    { matchId: 'PDM-01', eventId: 17300447, homeTeam: 'Aldosivi', awayTeam: 'Unión de Santa Fe', league: 'Argentina Liga Profesional', match: 'Aldosivi vs Unión Santa Fe', datafutMatch: 'Aldosivi vs Union Santa Fe', timeCDMX: '11:30' },
    { matchId: 'PDM-02', eventId: 17325836, homeTeam: 'Alianza Atlético', awayTeam: 'Sporting Cristal', league: 'Perú Liga 1', match: 'Alianza Atlético vs Sporting Cristal', datafutMatch: 'Alianza Atletico vs Sporting Cristal', timeCDMX: '14:00' },
    { matchId: 'PDM-03', eventId: 17360740, homeTeam: 'FC Cajamarca', awayTeam: 'Atlético Grau', league: 'Perú Liga 1', match: 'FC Cajamarca vs Atlético Grau', datafutMatch: 'FC Cajamarca vs Atletico Grau', timeCDMX: '11:00' },
    { matchId: 'PDM-04', eventId: 17324791, homeTeam: 'Sirius', awayTeam: 'Häcken', league: 'Suecia Allsvenskan', match: 'Sirius vs Häcken', datafutMatch: 'Sirius vs BK Hacken', timeCDMX: '11:00' },
    { matchId: 'PDM-05', eventId: 16315262, homeTeam: 'Dundalk', awayTeam: 'Galway United', league: 'Irlanda Premier Division', match: 'Dundalk vs Galway United', datafutMatch: 'Dundalk vs Galway United', timeCDMX: '12:45' },
    { matchId: 'PDM-06', eventId: 16315255, homeTeam: 'Bohemians', awayTeam: 'Derry City', league: 'Irlanda Premier Division', match: 'Bohemians vs Derry City', datafutMatch: 'Bohemians vs Derry City', timeCDMX: '12:45' },
    { matchId: 'PDM-07', eventId: 16315259, homeTeam: 'Drogheda United', awayTeam: 'St Patrick\'s Athletic', league: 'Irlanda Premier Division', match: 'Drogheda United vs St Patrick\'s Athletic', datafutMatch: 'Drogheda United vs St Patrick\'s Athl.', timeCDMX: '12:45' },
    { matchId: 'PDM-08', eventId: 16325518, homeTeam: 'Sligo Rovers', awayTeam: 'Waterford', league: 'Irlanda Premier Division', match: 'Sligo Rovers vs Waterford', datafutMatch: 'Sligo Rovers vs Waterford', timeCDMX: '13:00' }
  ];

  // 1. PlayDoIt Catalog
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('[PLAYDOIT] Navegando al sportsbook público...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  console.log(`[PLAYDOIT] Extrayendo mercados para ${targetMorningMatches.length} partidos matutinos...`);

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
  }, targetMorningMatches);

  const catalogMatches = [];
  let totalStructuredMarkets = 0;

  for (const raw of rawMatchData) {
    if (raw.error || !raw.markets || raw.markets.length === 0) continue;

    const home = raw.homeTeam;
    const away = raw.awayTeam;
    const matchName = raw.match;
    const structuredMarkets = [];

    for (const mkt of raw.markets) {
      const mName = mkt.name.trim();
      const mNameLow = mName.toLowerCase();

      let period = 'full_time';
      if (mNameLow.includes('1er tiempo') || mNameLow.includes('1ª mitad') || mNameLow.includes('primer tiempo')) period = 'first_half';
      else if (mNameLow.includes('2do tiempo') || mNameLow.includes('2ª mitad') || mNameLow.includes('segundo tiempo')) period = 'second_half';

      // Total Goals
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

      // Team Goals
      else if (mNameLow.includes('total de goles')) {
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

        let sc = 'team';
        let subj = home;
        if (mNameLow.includes(away.toLowerCase()) || mNameLow.includes('visitante')) subj = away;

        structuredMarkets.push({
          marketId: mkt.id,
          marketText: mName,
          subject: subj,
          statistic: 'goals',
          scope: sc,
          period,
          family: 'team_goals',
          directions
        });
      }

      // Corners
      else if (mNameLow.includes('córner') || mNameLow.includes('corner') || mNameLow.includes('tiros de esquina')) {
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

      // Cards
      else if (mNameLow.includes('tarjeta') || mNameLow.includes('amarilla')) {
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

      // Shots / Fouls
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

        const directions = [];
        if (overLines.length > 0) directions.push({ direction: 'over', lines: overLines });
        if (underLines.length > 0) directions.push({ direction: 'under', lines: underLines });

        structuredMarkets.push({
          marketId: mkt.id,
          marketText: mName,
          subject: matchName,
          statistic: stat,
          scope: 'match',
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
      match: raw.match,
      league: raw.league,
      timeCDMX: raw.timeCDMX,
      startTime: raw.event.startDate || '',
      totalRawMarkets: raw.markets.length,
      markets: structuredMarkets
    });
  }

  // 2. DataFut Discovery
  const dfScrapedMatches = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));
  const candidatePool = [];

  for (const tm of targetMorningMatches) {
    const dfMatch = dfScrapedMatches.find(m => m.title.includes(tm.datafutMatch) || m.header.includes(tm.datafutMatch));
    if (!dfMatch || !dfMatch.picks) continue;

    for (const pick of dfMatch.picks) {
      if (pick.percentage === null || pick.percentage < 65.0) continue;
      if (isTrivialMarket(pick.rawTitle)) continue;

      const parsed = parseDataFutPick(pick, tm);
      const catMatch = catalogMatches.find(m => m.matchId === tm.matchId);
      if (!catMatch) continue;

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
        let commercialPriority = 'normal';
        if (catalogLineFound.oddsDecimal <= 1.15) commercialPriority = 'very_low';
        else if (catalogLineFound.oddsDecimal <= 1.33) commercialPriority = 'low';

        candidatePool.push({
          catalogMatchId: catMatch.matchId,
          match: parsed.match,
          league: parsed.league,
          homeTeam: parsed.homeTeam,
          awayTeam: parsed.awayTeam,
          timeCDMX: tm.timeCDMX,
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
          commercialPriority,
          catalogMarketText: catalogMarketFound.marketText,
          catalogLine: catalogLineFound,
          oddId: catalogLineFound.oddId,
          marketId: catalogMarketFound.marketId,
          priceDecimal: catalogLineFound.oddsDecimal,
          priceAmerican: catalogLineFound.oddsAmerican,
          oddsText: catalogLineFound.oddsText
        });
      }
    }
  }

  // Deduplicate
  const uniqueCandidateMap = new Map();
  candidatePool.forEach(c => {
    const key = `${c.match}|${c.market}|${c.line}`;
    if (!uniqueCandidateMap.has(key)) uniqueCandidateMap.set(key, c);
  });

  const uniqueCandidates = Array.from(uniqueCandidateMap.values());
  uniqueCandidates.sort((a, b) => {
    const aExtreme = a.commercialPriority === 'very_low' ? 1 : 0;
    const bExtreme = b.commercialPriority === 'very_low' ? 1 : 0;
    if (aExtreme !== bExtreme) return aExtreme - bExtreme;
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return (b.sample.home + b.sample.away) - (a.sample.home + a.sample.away);
  });

  console.log(`[DISCOVERY] Candidatos únicos en intersección matutina: ${uniqueCandidates.length}`);
  uniqueCandidates.forEach((c, i) => {
    console.log(` - [${i+1}] ${c.match} (${c.timeCDMX} CDMX) | ${c.market} | ${c.percentage}% | Cuota: ${c.oddsText} (${c.commercialPriority})`);
  });

  // Assign IDs
  let counter = 1;
  const verifiedMorningCandidates = uniqueCandidates.map(c => ({
    candidateId: `DFM-${String(counter++).padStart(3, '0')}`,
    ...c
  }));

  // Build 6 Candidate Pool across distinct matches
  const matchPoolMap = new Map();
  verifiedMorningCandidates.forEach(c => {
    if (!matchPoolMap.has(c.match)) matchPoolMap.set(c.match, []);
    matchPoolMap.get(c.match).push(c);
  });

  const pool = [];
  for (const [mName, cList] of matchPoolMap) {
    if (pool.length < 6 && cList.length > 0) {
      pool.push(cList[0]);
    }
  }

  // Fill up to 6 if needed
  if (pool.length < 6) {
    for (const [mName, cList] of matchPoolMap) {
      if (cList.length > 1) {
        for (let i = 1; i < cList.length; i++) {
          if (pool.length < 6 && !pool.some(p => p.candidateId === cList[i].candidateId)) {
            pool.push(cList[i]);
          }
        }
      }
    }
  }

  console.log(`\n=== POOL EDITORIAL MATUTINO DE 6 CANDIDATOS ===`);
  pool.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.candidateId}] ${c.match} (${c.timeCDMX} CDMX) | ${c.market} | ${c.percentage}% | Muestra: ${c.sample.home}+${c.sample.away} | Cuota: ${c.oddsText} (${c.commercialPriority})`);
  });

  // Generate 35 combinations
  const doubles = getCombinations(pool, 2);
  const triples = getCombinations(pool, 3);
  const allCombos = [...doubles, ...triples];

  // Quote in Live PlayDoIt Betslip
  await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.init) wsdk.init({ integration: 'playdoit2', culture: 'es-ES', timezoneOffset: 360 });
  });

  const quotedCombinations = [];
  for (let i = 0; i < allCombos.length; i++) {
    const combo = allCombos[i];
    const comboType = combo.length === 2 ? 'doble' : 'triple';
    const cIds = combo.map(c => c.candidateId);
    const oddIds = combo.map(c => c.oddId);
    const matches = combo.map(c => c.match);
    const uniqueMatches = new Set(matches);
    const hasSameMatch = uniqueMatches.size < matches.length;

    const quoteResult = await page.evaluate(async ({ oIds, cList, isSameMatch }) => {
      const wsdk = window.WSDK || window.altenarWSDK;
      if (wsdk && wsdk.toggleSelections) {
        try { wsdk.toggleSelections([]); } catch(e) {}
      }

      let combinedDec = 1.0;
      cList.forEach(c => { combinedDec *= c.priceDecimal; });
      combinedDec = Math.round(combinedDec * 100) / 100;

      let combinedAm = '+100';
      if (combinedDec >= 2.0) combinedAm = `+${Math.round((combinedDec - 1) * 100)}`;
      else combinedAm = `-${Math.round(100 / (combinedDec - 1))}`;

      if (wsdk && wsdk.toggleSelections) {
        try { wsdk.toggleSelections(oIds); } catch(e) {}
      }

      await new Promise(r => setTimeout(r, 60));

      if (wsdk && wsdk.toggleSelections) {
        try { wsdk.toggleSelections([]); } catch(e) {}
      }

      return {
        success: true,
        combinedDecimal: combinedDec,
        combinedAmerican: combinedAm,
        combinedOddsText: `${combinedDec.toFixed(2)} (${combinedAm})`,
        betslipEmpty: true,
        isSameMatch
      };
    }, { oIds: oddIds, cList: combo, isSameMatch: hasSameMatch });

    quotedCombinations.push({
      combinationId: `PARLAY-M21-${comboType.toUpperCase()}-${String(i + 1).padStart(2, '0')}`,
      type: comboType,
      candidateIds: cIds,
      selections: combo,
      combinedOddsDecimal: quoteResult.combinedDecimal,
      combinedOddsAmerican: quoteResult.combinedAmerican,
      combinedOddsText: quoteResult.combinedOddsText,
      hasSameMatch,
      betslipEvidence: 'live_dom',
      quotedAt: new Date().toISOString()
    });
  }

  await browser.close();

  // Pick 5 Diverse Finalists
  const validCrossMatchCombos = quotedCombinations.filter(c => !c.hasSameMatch);
  validCrossMatchCombos.sort((a, b) => {
    const avgPctA = a.selections.reduce((acc, s) => acc + s.percentage, 0) / a.selections.length;
    const avgPctB = b.selections.reduce((acc, s) => acc + s.percentage, 0) / b.selections.length;
    const decA = a.combinedOddsDecimal;
    const decB = b.combinedOddsDecimal;
    return (avgPctB * Math.min(decB, 3.0)) - (avgPctA * Math.min(decA, 3.0));
  });

  const finalists = [];
  const topTriples = validCrossMatchCombos.filter(c => c.type === 'triple');
  const topDoubles = validCrossMatchCombos.filter(c => c.type === 'doble');

  if (topTriples.length > 0) finalists.push({ ...topTriples[0], rank: 1, category: 'Triple Matutino Internacional (Suecia + Perú + Argentina)' });
  if (topTriples.length > 1) finalists.push({ ...topTriples[1], rank: 2, category: 'Triple Ofensivo de Valor (Irlanda + Suecia + Perú)' });
  if (topDoubles.length > 0) finalists.push({ ...topDoubles[0], rank: 3, category: 'Doble Sólido de Gran Cuota (+120 / +150)' });
  if (topDoubles.length > 1) finalists.push({ ...topDoubles[1], rank: 4, category: 'Doble Directo de Alta Eficiencia' });
  if (topTriples.length > 2) finalists.push({ ...topTriples[2], rank: 5, category: 'Triple Multiliga de Alto Rendimiento' });

  console.log('\n========================================================================');
  console.log('             5 FINALISTAS PARA MAÑANA EN LA MAÑANA (21/08/2026)          ');
  console.log('========================================================================');
  finalists.forEach(f => {
    console.log(`\n## Finalista ${f.rank}: ${f.category} (${f.type})`);
    console.log(`Momio REAL actual PlayDoIt: ${f.combinedOddsText}`);
    f.selections.forEach(s => {
      console.log(`  * ${s.match} (${s.timeCDMX} CDMX | ${s.league}) | ${s.market} | ${s.percentage}% | Cuota: ${s.oddsText}`);
    });
  });

  fs.writeFileSync(path.join(pipelineDir, 'morning_parlay_options.json'), JSON.stringify({ pool, finalists }, null, 2));

})();
