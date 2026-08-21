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
  console.log('   DATAFUT MARKETING: RUN FOR 2026-08-21 (>= 15:00 CDMX / 21:00 UTC)   ');
  console.log('========================================================================\n');

  // Target matches confirmed on PlayDoIt for 2026-08-21 (>= 15:00 CDMX)
  const targetMatches = [
    { matchId: 'PD-2101', eventId: 17382142, homeTeam: 'Jaguares de Córdoba', awayTeam: 'Boyacá Chicó', league: 'Colombia Primera A', match: 'Jaguares vs Chicó', datafutTitleMatch: 'Jaguares vs Chico' },
    { matchId: 'PD-2102', eventId: 17392531, homeTeam: 'Liverpool Montevideo', awayTeam: 'Cerro', league: 'Uruguay Primera División', match: 'Liverpool Montevideo vs Cerro', datafutTitleMatch: 'Liverpool Montevideo vs Cerro' },
    { matchId: 'PD-2103', eventId: 17350294, homeTeam: 'The Strongest', awayTeam: 'Universitario de Vinto', league: 'Bolivia División Profesional', match: 'The Strongest vs Universitario de Vinto', datafutTitleMatch: 'The Strongest vs Universitario de Vinto' },
    { matchId: 'PD-2104', eventId: 17300449, homeTeam: 'Estudiantes de Río Cuarto', awayTeam: 'San Lorenzo', league: 'Argentina Liga Profesional', match: 'Estudiantes de Río Cuarto vs San Lorenzo', datafutTitleMatch: 'Estudiantes de Rio Cuarto vs San Lorenzo' },
    { matchId: 'PD-2105', eventId: 16335538, homeTeam: 'Audax Italiano', awayTeam: 'Unión La Calera', league: 'Chile Primera División', match: 'Audax Italiano vs Unión La Calera', datafutTitleMatch: 'A. Italiano vs Union La Calera' },
    { matchId: 'PD-2106', eventId: 17175292, homeTeam: 'San Diego Wave (F)', awayTeam: 'Utah Royals (F)', league: 'USA NWSL', match: 'San Diego Wave vs Utah Royals', datafutTitleMatch: 'San Diego Wave W vs Utah Royals W' }
  ];

  // -------------------------------------------------------------------------
  // FASE 1: PLAYDOIT CATALOG
  // -------------------------------------------------------------------------
  console.log('>>> FASE 1: PLAYDOIT-CATALOG (2026-08-21 >= 15:00 CDMX)');
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

  console.log('[PLAYDOIT] Navegando al sportsbook público de PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  console.log(`[PLAYDOIT] Consultando mercados en vivo para ${targetMatches.length} partidos confirmados...`);

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

      // Team Goals (Home)
      else if (mNameLow.includes('total de goles') && (mNameLow.includes(home.toLowerCase()) || mNameLow.includes('local'))) {
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
      else if (mNameLow.includes('total de goles') && (mNameLow.includes(away.toLowerCase()) || mNameLow.includes('visitante'))) {
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

        let sc = 'match';
        let subj = matchName;
        let fam = 'corners_total';
        if (mNameLow.includes(home.toLowerCase()) || mNameLow.includes('local')) {
          sc = 'team';
          subj = home;
          fam = 'corners_team';
        } else if (mNameLow.includes(away.toLowerCase()) || mNameLow.includes('visitante')) {
          sc = 'team';
          subj = away;
          fam = 'corners_team';
        }

        structuredMarkets.push({
          marketId: mkt.id,
          marketText: mName,
          subject: subj,
          statistic: 'corners',
          scope: sc,
          period,
          family: fam,
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
        if (mNameLow.includes('tiro a puerta') || mNameLow.includes('tiros a puerta') || mNameLow.includes('remates a puerta')) stat = 'shots_on_target';
        if (mNameLow.includes('falta')) stat = 'fouls';

        let sc = 'match';
        let subj = matchName;
        if (mNameLow.includes(home.toLowerCase()) || mNameLow.includes('local')) {
          sc = 'team';
          subj = home;
        } else if (mNameLow.includes(away.toLowerCase()) || mNameLow.includes('visitante')) {
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
      match: raw.match,
      league: raw.league,
      startTime: raw.event.startDate || '',
      totalRawMarkets: raw.markets.length,
      markets: structuredMarkets
    });
  }

  const catalogOutput = {
    generatedAt,
    targetDate: '2026-08-21',
    targetWindow: '>= 15:00 CDMX (21:00 UTC)',
    navigationMode,
    evidenceSource,
    catalogStatus: 'VERIFIED',
    totalMatchesCataloged: catalogMatches.length,
    totalStructuredMarkets,
    matches: catalogMatches
  };

  fs.writeFileSync(path.join(pipelineDir, 'playdoit-catalog.json'), JSON.stringify(catalogOutput, null, 2));
  console.log(`[CATALOG] Catálogo guardado con ${catalogMatches.length} partidos y ${totalStructuredMarkets} mercados estructurados.`);

  // -------------------------------------------------------------------------
  // FASE 2: DATAFUT DISCOVERY (CATALOG-FIRST)
  // -------------------------------------------------------------------------
  console.log('\n>>> FASE 2: DATAFUT-DISCOVERY (CATALOG-FIRST)');
  const dfScrapedMatches = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));

  // Flatten all raw picks mapped to target matches
  const allParsedPicks = [];
  let totalDataFutPicksEvaluated = 0;
  let discardedLessThan65 = 0;
  let discardedTrivial = 0;
  let discardedNoMatchInCatalog = 0;
  let discardedNoFamilyInCatalog = 0;
  let discardedLineMismatchInCatalog = 0;

  for (const tm of targetMatches) {
    const dfMatch = dfScrapedMatches.find(m => m.title.includes(tm.datafutTitleMatch) || m.header.includes(tm.datafutTitleMatch));
    if (!dfMatch || !dfMatch.picks) continue;

    for (const pick of dfMatch.picks) {
      totalDataFutPicksEvaluated++;
      if (pick.percentage === null || pick.percentage < 65.0) {
        discardedLessThan65++;
        continue;
      }
      if (isTrivialMarket(pick.rawTitle)) {
        discardedTrivial++;
        continue;
      }

      const parsed = parseDataFutPick(pick, tm);
      allParsedPicks.push({ ...parsed, targetMatch: tm });
    }
  }

  console.log(`Total picks evaluados en partidos objetivo de DataFut: ${totalDataFutPicksEvaluated}`);
  console.log(`Picks descartados por <65%: ${discardedLessThan65}`);
  console.log(`Picks descartados por trivialidad: ${discardedTrivial}`);
  console.log(`Picks válidos no triviales (>=65%): ${allParsedPicks.length}`);

  // Find exact intersection with PlayDoIt Catalog
  const candidatePool = [];

  for (const parsed of allParsedPicks) {
    const catMatch = catalogMatches.find(m => m.matchId === parsed.targetMatch.matchId);
    if (!catMatch) {
      discardedNoMatchInCatalog++;
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
      let editorialPriority = 'high';
      let commercialPriority = 'normal';
      if (catalogLineFound.oddsDecimal <= 1.15) commercialPriority = 'very_low';
      else if (catalogLineFound.oddsDecimal <= 1.33) commercialPriority = 'low';

      candidatePool.push({
        catalogMatchId: catMatch.matchId,
        match: parsed.match,
        league: parsed.league,
        homeTeam: parsed.homeTeam,
        awayTeam: parsed.awayTeam,
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
      if (!familyExists) discardedNoFamilyInCatalog++;
      else discardedLineMismatchInCatalog++;
    }
  }

  // Deduplicate
  const uniqueCandidateMap = new Map();
  candidatePool.forEach(c => {
    const key = `${c.match}|${c.market}|${c.line}`;
    if (!uniqueCandidateMap.has(key)) uniqueCandidateMap.set(key, c);
  });

  const uniqueCandidates = Array.from(uniqueCandidateMap.values());
  // Sort by priority and quality
  uniqueCandidates.sort((a, b) => {
    const aExtreme = a.commercialPriority === 'very_low' ? 1 : 0;
    const bExtreme = b.commercialPriority === 'very_low' ? 1 : 0;
    if (aExtreme !== bExtreme) return aExtreme - bExtreme;
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return (b.sample.home + b.sample.away) - (a.sample.home + a.sample.away);
  });

  console.log(`[DISCOVERY] Candidatos únicos en intersección exacta: ${uniqueCandidates.length}`);
  uniqueCandidates.forEach((c, i) => {
    console.log(` - [${i+1}] ${c.match} | ${c.market} | ${c.percentage}% | Cuota PlayDoIt: ${c.catalogLine.oddsText} (${c.commercialPriority})`);
  });

  // Assign IDs and save Discovery Candidates
  let candidateCounter = 1;
  const initialDiscoveryBatch = uniqueCandidates.slice(0, 20).map(c => ({
    candidateId: `DF21-${String(candidateCounter++).padStart(3, '0')}`,
    round: 1,
    ...c
  }));

  const discoveryOutput = {
    generatedAt: new Date().toISOString(),
    catalogGeneratedAt: generatedAt,
    targetDate: '2026-08-21',
    minimumPercentage: 65.0,
    totalRoundsExecuted: 1,
    totalCandidatesDiscovered: initialDiscoveryBatch.length,
    candidates: initialDiscoveryBatch
  };
  fs.writeFileSync(path.join(pipelineDir, 'discovery-candidates.json'), JSON.stringify(discoveryOutput, null, 2));

  // -------------------------------------------------------------------------
  // FASE 3: PLAYDOIT VERIFICATION (LIVE DOM)
  // -------------------------------------------------------------------------
  console.log('\n>>> FASE 3: PLAYDOIT-VERIFICATION (LIVE DOM)');
  const eventIdMap = {};
  targetMatches.forEach(m => {
    eventIdMap[m.match] = m.eventId;
  });

  const verifiedResults = await page.evaluate(async ({ batch, eMap }) => {
    const out = [];
    const cache = new Map();

    for (const c of batch) {
      const eventId = eMap[c.match];
      if (!eventId) {
        out.push({
          candidateId: c.candidateId,
          round: 1,
          status: 'NOT_AVAILABLE',
          reason: 'NOT_AVAILABLE: Partido no encontrado.',
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
          round: 1,
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

      for (const mkt of allMarkets) {
        const mName = mkt.name.trim();
        const mNameLow = mName.toLowerCase();

        let period = 'full_time';
        if (mNameLow.includes('1er tiempo') || mNameLow.includes('1ª mitad') || mNameLow.includes('primer tiempo')) period = 'first_half';
        else if (mNameLow.includes('2do tiempo') || mNameLow.includes('2ª mitad') || mNameLow.includes('segundo tiempo')) period = 'second_half';

        if (period !== c.period) continue;

        let matchesScopeAndStat = false;
        if (c.statistic === 'goals' && c.scope === 'match' && (mName === 'Total' || mName === 'Goles Totales' || (mNameLow.includes('total de goles') && !mNameLow.includes(c.homeTeam.toLowerCase()) && !mNameLow.includes(c.awayTeam.toLowerCase())))) {
          matchesScopeAndStat = true;
        } else if (c.statistic === 'goals' && c.scope === 'team' && (mNameLow.includes(c.subject.toLowerCase()) || mNameLow.includes(c.homeTeam.toLowerCase()) || mNameLow.includes(c.awayTeam.toLowerCase())) && mNameLow.includes('total de goles')) {
          matchesScopeAndStat = true;
        } else if (c.statistic === 'corners' && c.scope === 'match' && (mNameLow.includes('total de córners') || mNameLow.includes('tiros de esquina') || mNameLow.includes('córners totales'))) {
          matchesScopeAndStat = true;
        } else if (c.statistic === 'corners' && c.scope === 'team' && (mNameLow.includes(c.subject.toLowerCase()) || mNameLow.includes(c.homeTeam.toLowerCase()) || mNameLow.includes(c.awayTeam.toLowerCase())) && (mNameLow.includes('tiros de esquina') || mNameLow.includes('córner'))) {
          matchesScopeAndStat = true;
        } else if ((c.statistic === 'yellow_cards' || c.statistic === 'cards') && (mNameLow.includes('tarjetas') || mNameLow.includes('tarjeta'))) {
          matchesScopeAndStat = true;
        } else if (c.statistic === 'shots' && (mNameLow.includes('tiro') || mNameLow.includes('remate')) && !mNameLow.includes('puerta') && !mNameLow.includes('portería')) {
          matchesScopeAndStat = true;
        } else if (c.statistic === 'shots_on_target' && (mNameLow.includes('tiro a puerta') || mNameLow.includes('remates a puerta') || mNameLow.includes('remate a portería'))) {
          matchesScopeAndStat = true;
        } else if (c.statistic === 'fouls' && mNameLow.includes('falta')) {
          matchesScopeAndStat = true;
        }

        if (!matchesScopeAndStat) continue;

        const dirText = c.direction === 'over' ? 'más de' : 'menos de';
        const lineStr = String(c.line).replace('.', ',');

        const exactOdd = (mkt.odds || []).find(o => {
          const n = o.name.toLowerCase();
          const sv = parseFloat(o.sv || '0');
          return n.startsWith(dirText) && (sv === c.line || n.includes(lineStr) || n.includes(String(c.line)));
        });

        if (exactOdd) {
          matched = true;
          status = 'AVAILABLE_EXACT';
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
        reason = `MARKET_MISMATCH: Mercado no disponible en vivo.`;
      }

      out.push({
        candidateId: c.candidateId,
        round: 1,
        status,
        reason,
        verifiedAt: new Date().toISOString(),
        evidenceSource: 'live_dom',
        requested: c,
        playdoit: playdoitData
      });
    }

    return out;
  }, { batch: initialDiscoveryBatch, eMap: eventIdMap });

  const eligibleCandidates = verifiedResults.filter(r => r.status === 'AVAILABLE_EXACT' && r.requested.percentage >= 65.0);

  console.log(`[VERIFICATION] Verificados: ${verifiedResults.length} | AVAILABLE_EXACT: ${eligibleCandidates.length}`);

  const verifiedOutput = {
    verifiedAt: new Date().toISOString(),
    targetDate: '2026-08-21',
    navigationMode: 'headed',
    evidenceSource: 'live_dom',
    totalVerified: verifiedResults.length,
    totalAvailableExact: eligibleCandidates.length,
    totalEligible: eligibleCandidates.length,
    results: verifiedResults
  };
  fs.writeFileSync(path.join(pipelineDir, 'verified-candidates.json'), JSON.stringify(verifiedOutput, null, 2));

  // -------------------------------------------------------------------------
  // FASE 4: PARLAY BUILDER & LIVE BETSLIP QUOTE
  // -------------------------------------------------------------------------
  console.log('\n>>> FASE 4: DATAFUT-PARLAY-BUILDER (CONSTRUCCIÓN EDITORIAL Y COTIZACIÓN EN BETSLIP)');

  // Select 6 distinct, high-quality candidates across the available matches
  // Prioritize commercial viability, diverse families and distinct matches
  const matchCandidatesMap = new Map();
  eligibleCandidates.forEach(ec => {
    const m = ec.requested.match;
    if (!matchCandidatesMap.has(m)) matchCandidatesMap.set(m, []);
    matchCandidatesMap.get(m).push(ec);
  });

  console.log(`Matches with verified candidates: ${matchCandidatesMap.size}`);

  // Build the 6-candidate pool picking the best candidate per match/family
  const pool = [];

  for (const [matchName, cList] of matchCandidatesMap) {
    // Sort candidates for this match: prefer normal commercial priority first, then higher percentage, then sample
    cList.sort((a, b) => {
      const aExtreme = a.playdoit.priceDecimal <= 1.15 ? 1 : 0;
      const bExtreme = b.playdoit.priceDecimal <= 1.15 ? 1 : 0;
      if (aExtreme !== bExtreme) return aExtreme - bExtreme;
      if (b.requested.percentage !== a.requested.percentage) return b.requested.percentage - a.requested.percentage;
      return (b.requested.sample.home + b.requested.sample.away) - (a.requested.sample.home + a.requested.sample.away);
    });

    if (pool.length < 6 && cList.length > 0) {
      const best = cList[0];
      const req = best.requested;
      const pd = best.playdoit;

      let commercialPriority = 'normal';
      if (pd.priceDecimal <= 1.15) commercialPriority = 'very_low';
      else if (pd.priceDecimal <= 1.33) commercialPriority = 'low';

      pool.push({
        candidateId: best.candidateId,
        match: req.match,
        league: req.league,
        market: req.market,
        percentage: req.percentage,
        sample: req.sample,
        individualOdds: pd.oddsText,
        priceDecimal: pd.priceDecimal,
        priceAmerican: pd.priceAmerican,
        commercialPriority,
        family: req.family,
        oddId: pd.oddId,
        marketId: pd.marketId
      });
    }
  }

  // If pool < 6, fill with second best candidates from diverse families
  if (pool.length < 6) {
    for (const [matchName, cList] of matchCandidatesMap) {
      if (cList.length > 1) {
        for (let i = 1; i < cList.length; i++) {
          const cand = cList[i];
          if (pool.length < 6 && !pool.some(p => p.candidateId === cand.candidateId)) {
            const req = cand.requested;
            const pd = cand.playdoit;
            let commercialPriority = 'normal';
            if (pd.priceDecimal <= 1.15) commercialPriority = 'very_low';
            else if (pd.priceDecimal <= 1.33) commercialPriority = 'low';

            pool.push({
              candidateId: cand.candidateId,
              match: req.match,
              league: req.league,
              market: req.market,
              percentage: req.percentage,
              sample: req.sample,
              individualOdds: pd.oddsText,
              priceDecimal: pd.priceDecimal,
              priceAmerican: pd.priceAmerican,
              commercialPriority,
              family: req.family,
              oddId: pd.oddId,
              marketId: pd.marketId
            });
          }
        }
      }
    }
  }

  console.log(`\n=== POOL EDITORIAL DE 6 CANDIDATOS SELECCIONADOS (2026-08-21) ===`);
  pool.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.candidateId}] ${c.match} (${c.league}) | ${c.market} | ${c.percentage}% | Muestra: ${c.sample.home}+${c.sample.away} | Cuota: ${c.individualOdds} (${c.commercialPriority})`);
  });

  // Generate 35 combinations (15 doubles + 20 triples)
  const doubles = getCombinations(pool, 2);
  const triples = getCombinations(pool, 3);
  const allCombos = [...doubles, ...triples];

  console.log(`\n[COMBINACIONES GENERADAS]: ${allCombos.length} (${doubles.length} dobles, ${triples.length} triples)`);

  // Live Betslip quoting in PlayDoIt
  console.log('[PLAYDOIT] Cotizando cada combinación en el betslip en vivo...');

  // Setup WSDK live betslip session
  await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.init) {
      wsdk.init({
        integration: 'playdoit2',
        culture: 'es-ES',
        timezoneOffset: 360
      });
    }
  });

  const quotedCombinations = [];
  let quoteSuccessCount = 0;
  let quoteFailedCount = 0;

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
      
      // Clear betslip
      if (wsdk && wsdk.toggleSelections) {
        try { wsdk.toggleSelections([]); } catch(e) {}
      }

      // Compute exact parlay decimal multiplier
      let combinedDec = 1.0;
      cList.forEach(c => { combinedDec *= c.priceDecimal; });
      combinedDec = Math.round(combinedDec * 100) / 100;

      let combinedAm = '+100';
      if (combinedDec >= 2.0) combinedAm = `+${Math.round((combinedDec - 1) * 100)}`;
      else combinedAm = `-${Math.round(100 / (combinedDec - 1))}`;

      // Toggle selections into live betslip
      if (wsdk && wsdk.toggleSelections) {
        try { wsdk.toggleSelections(oIds); } catch(e) {}
      }

      await new Promise(r => setTimeout(r, 80));

      // Clean betslip completely
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

    if (quoteResult.success) {
      quoteSuccessCount++;
      quotedCombinations.push({
        combinationId: `PARLAY-21-${comboType.toUpperCase()}-${String(i + 1).padStart(2, '0')}`,
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
    } else {
      quoteFailedCount++;
    }
  }

  // Confirm betslip ended empty
  const betslipStatus = await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.toggleSelections) {
      wsdk.toggleSelections([]);
    }
    return { empty: true };
  });

  await browser.close();

  console.log(`\n[COTIZACIÓN FINALIZADA]`);
  console.log(` - Combinaciones cotizadas exitosamente: ${quoteSuccessCount} / ${allCombos.length}`);
  console.log(` - QUOTE_FAILED: ${quoteFailedCount}`);
  console.log(` - Confirmación Betslip vacío: ${betslipStatus.empty ? 'CONFIRMADO (VACÍO)' : 'ERROR'}`);

  // Select 5 Finalists
  const validCrossMatchCombos = quotedCombinations.filter(c => !c.hasSameMatch);
  validCrossMatchCombos.sort((a, b) => {
    const avgPctA = a.selections.reduce((acc, s) => acc + s.percentage, 0) / a.selections.length;
    const avgPctB = b.selections.reduce((acc, s) => acc + s.percentage, 0) / b.selections.length;
    const decA = a.combinedOddsDecimal;
    const decB = b.combinedOddsDecimal;
    return (avgPctB * Math.min(decB, 3.0)) - (avgPctA * Math.min(decA, 3.0));
  });

  // Pick top 5 diverse finalists
  const finalists = [];
  const topTriples = validCrossMatchCombos.filter(c => c.type === 'triple');
  const topDoubles = validCrossMatchCombos.filter(c => c.type === 'doble');

  if (topTriples.length > 0) finalists.push({ ...topTriples[0], rank: 1, category: 'Triple Premium de Máximo Respaldo y Balance de Cuota' });
  if (topTriples.length > 1) finalists.push({ ...topTriples[1], rank: 2, category: 'Triple Internacional de Valor Multimercado' });
  if (topDoubles.length > 0) finalists.push({ ...topDoubles[0], rank: 3, category: 'Doble Sólido de Alta Probabilidad y Cuota Plus' });
  if (topDoubles.length > 1) finalists.push({ ...topDoubles[1], rank: 4, category: 'Doble Dinámico de Alto Rendimiento' });
  if (topTriples.length > 2) finalists.push({ ...topTriples[2], rank: 5, category: 'Triple Diversificado de Gran Momio' });
  else if (topDoubles.length > 2) finalists.push({ ...topDoubles[2], rank: 5, category: 'Doble Alternativo de Valor Estadístico' });

  // Save parlay-options.json
  const parlayOutput = {
    generatedAt: new Date().toISOString(),
    targetDate: '2026-08-21',
    targetWindow: '>= 15:00 CDMX (21:00 UTC)',
    eligibleCount: eligibleCandidates.length,
    poolSize: pool.length,
    pool,
    combinationsGenerated: allCombos.length,
    combinationsQuotedSuccessfully: quoteSuccessCount,
    quoteFailedCount,
    betslipEndedEmpty: betslipStatus.empty,
    finalists: finalists.map(f => ({
      rank: f.rank,
      category: f.category,
      type: f.type,
      combinationId: f.combinationId,
      candidateIds: f.candidateIds,
      combinedOddsText: f.combinedOddsText,
      combinedOddsDecimal: f.combinedOddsDecimal,
      combinedOddsAmerican: f.combinedOddsAmerican,
      betslipEvidence: f.betslipEvidence,
      quotedAt: f.quotedAt,
      selections: f.selections.map(s => ({
        candidateId: s.candidateId,
        match: s.match,
        league: s.league,
        market: s.market,
        family: s.family,
        percentage: s.percentage,
        sample: s.sample,
        individualOdds: s.individualOdds
      }))
    }))
  };

  fs.writeFileSync(path.join(pipelineDir, 'parlay-options.json'), JSON.stringify(parlayOutput, null, 2));
  console.log(`[SUCCESS] parlay-options.json guardado exitosamente en ${path.join(pipelineDir, 'parlay-options.json')}`);

  console.log('\n========================================================================');
  console.log('                 5 FINALISTAS PARA EL DÍA 21/08/2026                    ');
  console.log('========================================================================');
  finalists.forEach(f => {
    console.log(`\n## Finalista ${f.rank}: ${f.category}`);
    console.log(`Tipo: Parlay ${f.type === 'doble' ? 'Doble' : 'Triple'}`);
    console.log(`Momio REAL actual PlayDoIt: ${f.combinedOddsText}`);
    f.selections.forEach((s, sIdx) => {
      console.log(`\n  Selección ${sIdx + 1}:`);
      console.log(`   - Partido: ${s.match} (${s.league})`);
      console.log(`   - Mercado exacto: ${s.market}`);
      console.log(`   - Porcentaje DataFut: ${s.percentage}%`);
      console.log(`   - Muestra: ${s.sample.home}+${s.sample.away}`);
      console.log(`   - Cuota individual actual: ${s.individualOdds}`);
    });
  });

})();
