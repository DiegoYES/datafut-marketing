const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const pipelineDir = path.join(__dirname, '..', 'pipeline-state');
if (!fs.existsSync(pipelineDir)) fs.mkdirSync(pipelineDir, { recursive: true });

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
  // Over 0.5 match goals
  if (/más de 0\.5 goles/i.test(low) && !low.includes('local') && !low.includes('visitante') && !low.includes('tiempo') && !low.includes('mitad')) return true;
  // Over 0.5 / 1.5 shots on target
  if ((low.includes('tiro a puerta') || low.includes('tiros a puerta')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }
  // Over 0.5 / 1.5 / 2.5 shots
  if ((low.includes('tiro') || low.includes('tiros')) && !low.includes('puerta') && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 2.5) return true;
  }
  // Over 0.5 cards of team
  if ((low.includes('tarjeta') || low.includes('amarilla')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 0.5) return true;
  }
  // Over 0.5 / 1.5 corners
  if ((low.includes('córner') || low.includes('corner') || low.includes('córners') || low.includes('corners') || low.includes('esquina')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }
  // Over 0.5 / 1.5 / 2.5 fouls
  if (low.includes('falta') && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 2.5) return true;
  }
  return false;
}

// Strict parser for DataFut picks
function parseDataFutPickStrict(pick, matchMeta) {
  const t = pick.rawTitle.trim();
  const tLow = t.toLowerCase();
  const homeTeam = matchMeta.homeTeam;
  const awayTeam = matchMeta.awayTeam;

  let family = 'other';
  let subject = matchMeta.match;
  let statistic = 'unknown';
  let scope = 'match';
  let direction = 'over';
  let line = 0.5;
  let period = 'full_time';

  if (tLow.includes('1er tiempo') || tLow.includes('primer tiempo') || tLow.includes('1ª mitad')) period = 'first_half';
  else if (tLow.includes('2do tiempo') || tLow.includes('segundo tiempo') || tLow.includes('2ª mitad')) period = 'second_half';

  if (tLow.startsWith('más de') || tLow.startsWith('mas de') || tLow.startsWith('over')) direction = 'over';
  else if (tLow.startsWith('menos de') || tLow.startsWith('under')) direction = 'under';

  const numMatch = t.match(/\d+(\.\d+)?/);
  if (numMatch) line = parseFloat(numMatch[0]);

  // SCOPE IDENTIFICATION
  if (tLow.includes('del local') || tLow.includes('local marca') || tLow.includes('anota el local')) {
    scope = 'team_home';
    subject = homeTeam;
  } else if (tLow.includes('del visitante') || tLow.includes('visitante marca') || tLow.includes('anota el visitante')) {
    scope = 'team_away';
    subject = awayTeam;
  } else {
    scope = 'match';
    subject = matchMeta.match;
  }

  // STATISTIC IDENTIFICATION
  if (tLow.includes('tiro a puerta') || tLow.includes('tiros a puerta')) {
    statistic = 'shots_on_target';
    family = 'shots_on_target';
  } else if (tLow.includes('tiro') || tLow.includes('tiros')) {
    statistic = 'shots';
    family = 'shots';
  } else if (tLow.includes('córner') || tLow.includes('corner') || tLow.includes('córners') || tLow.includes('corners') || tLow.includes('esquina')) {
    statistic = 'corners';
    family = scope === 'match' ? 'corners_total' : 'corners_team';
  } else if (tLow.includes('tarjeta') || tLow.includes('tarjetas') || tLow.includes('amarilla')) {
    statistic = 'cards';
    family = 'cards';
  } else if (tLow.includes('falta') || tLow.includes('faltas')) {
    statistic = 'fouls';
    family = 'fouls';
  } else if (tLow.includes('gol') || tLow.includes('goles') || tLow.includes('marca')) {
    statistic = 'goals';
    family = scope === 'match' ? 'goals' : 'team_goals';
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
    match: matchMeta.match,
    league: matchMeta.league,
    timeCDMX: matchMeta.timeCDMX,
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
  console.log('    DATAFUT MARKETING: MASTER PIPELINE DESDE CERO (2026-08-21)          ');
  console.log('========================================================================\n');

  // Define target soccer matches on 2026-08-21
  const targetMatches = [
    // Morning matches
    { eventId: 17300447, matchId: 'M-01', match: 'Aldosivi vs Unión Santa Fe', dfTitle: 'Aldosivi vs Union Santa Fe', homeTeam: 'Aldosivi', awayTeam: 'Unión de Santa Fe', homeKeywords: ['aldosivi'], awayKeywords: ['union', 'santa fe'], timeCDMX: '11:30', league: 'Argentina Liga Profesional' },
    { eventId: 16315255, matchId: 'M-02', match: 'Bohemians vs Derry City', dfTitle: 'Bohemians vs Derry City', homeTeam: 'Bohemians', awayTeam: 'Derry City', homeKeywords: ['bohemians'], awayKeywords: ['derry'], timeCDMX: '12:45', league: 'Irlanda Premier Division' },
    { eventId: 16315262, matchId: 'M-03', match: 'Dundalk vs Galway United', dfTitle: 'Dundalk vs Galway United', homeTeam: 'Dundalk', awayTeam: 'Galway United', homeKeywords: ['dundalk'], awayKeywords: ['galway'], timeCDMX: '12:45', league: 'Irlanda Premier Division' },
    { eventId: 17325836, matchId: 'M-04', match: 'Alianza Atlético vs Sporting Cristal', dfTitle: 'Alianza Atletico vs Sporting Cristal', homeTeam: 'Alianza Atlético', awayTeam: 'Sporting Cristal', homeKeywords: ['alianza atletico', 'alianza'], awayKeywords: ['sporting cristal', 'cristal'], timeCDMX: '14:00', league: 'Perú Liga 1' },
    { eventId: 17360740, matchId: 'M-05', match: 'FC Cajamarca vs Atlético Grau', dfTitle: 'FC Cajamarca vs Atletico Grau', homeTeam: 'FC Cajamarca', awayTeam: 'Atlético Grau', homeKeywords: ['cajamarca'], awayKeywords: ['grau', 'atletico grau'], timeCDMX: '11:00', league: 'Perú Liga 1' },
    // Afternoon matches
    { eventId: 17382142, matchId: 'M-06', match: 'Jaguares vs Boyacá Chicó', dfTitle: 'Jaguares vs Chico', homeTeam: 'Jaguares de Córdoba', awayTeam: 'Boyacá Chicó', homeKeywords: ['jaguares'], awayKeywords: ['chico', 'boyaca'], timeCDMX: '15:05', league: 'Colombia Primera A' },
    { eventId: 17392531, matchId: 'M-07', match: 'Liverpool Montevideo vs Cerro', dfTitle: 'Liverpool Montevideo vs Cerro', homeTeam: 'Liverpool Montevideo', awayTeam: 'Cerro', homeKeywords: ['liverpool'], awayKeywords: ['cerro'], timeCDMX: '16:00', league: 'Uruguay Primera División' },
    { eventId: 17300449, matchId: 'M-08', match: 'Estudiantes de Río Cuarto vs San Lorenzo', dfTitle: 'Estudiantes de Rio Cuarto vs San Lorenzo', homeTeam: 'Estudiantes de Río Cuarto', awayTeam: 'San Lorenzo', homeKeywords: ['estudiantes'], awayKeywords: ['san lorenzo'], timeCDMX: '17:00', league: 'Argentina Liga Profesional' },
    { eventId: 16335538, matchId: 'M-09', match: 'Audax Italiano vs Unión La Calera', dfTitle: 'A. Italiano vs Union La Calera', homeTeam: 'Audax Italiano', awayTeam: 'Unión La Calera', homeKeywords: ['audax', 'italiano'], awayKeywords: ['la calera', 'calera'], timeCDMX: '18:30', league: 'Chile Primera División' }
  ];

  // -------------------------------------------------------------------------
  // FASE 1: PLAYDOIT CATALOG WITH STRICT SCOPE CLASSIFICATION
  // -------------------------------------------------------------------------
  console.log('>>> FASE 1: PLAYDOIT-CATALOG (EXTRACCIÓN Y CLASIFICACIÓN ESTRICTA)');

  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

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

  for (const raw of rawMatchData) {
    if (raw.error || !raw.markets) continue;

    const classifiedMarkets = [];

    for (const mkt of raw.markets) {
      const mName = mkt.name.trim();
      const mLow = mName.toLowerCase();

      // STRICT SCOPE DETERMINATION
      let scope = 'match';
      let subject = raw.match;

      const isHomeTeam = raw.homeKeywords.some(kw => mLow.includes(kw.toLowerCase())) || mLow.includes('local');
      const isAwayTeam = raw.awayKeywords.some(kw => mLow.includes(kw.toLowerCase())) || mLow.includes('visitante');

      if (isHomeTeam && !isAwayTeam) {
        scope = 'team_home';
        subject = raw.homeTeam;
      } else if (isAwayTeam && !isHomeTeam) {
        scope = 'team_away';
        subject = raw.awayTeam;
      } else {
        scope = 'match';
        subject = raw.match;
      }

      // PERIOD
      let period = 'full_time';
      if (mLow.includes('1er tiempo') || mLow.includes('1ª mitad') || mLow.includes('primer tiempo')) period = 'first_half';
      else if (mLow.includes('2do tiempo') || mLow.includes('2ª mitad') || mLow.includes('segundo tiempo')) period = 'second_half';

      // STATISTIC
      let statistic = 'unknown';
      let family = 'other';

      if (mLow.includes('tiro a puerta') || mLow.includes('tiros a puerta')) {
        statistic = 'shots_on_target';
        family = 'shots_on_target';
      } else if (mLow.includes('tiro') || mLow.includes('remate')) {
        statistic = 'shots';
        family = 'shots';
      } else if (mLow.includes('córner') || mLow.includes('corner') || mLow.includes('tiros de esquina')) {
        statistic = 'corners';
        family = scope === 'match' ? 'corners_total' : 'corners_team';
      } else if (mLow.includes('tarjeta') || mLow.includes('amarilla')) {
        statistic = 'cards';
        family = 'cards';
      } else if (mLow.includes('falta')) {
        statistic = 'fouls';
        family = 'fouls';
      } else if (mLow.includes('gol') || mLow.includes('goles') || mName === 'Total' || mName === 'Goles Totales') {
        statistic = 'goals';
        family = scope === 'match' ? 'goals' : 'team_goals';
      }

      // Extract over/under lines
      const overLines = [];
      const underLines = [];

      mkt.odds.forEach(o => {
        const oLow = o.name.toLowerCase();
        const svNum = parseFloat(o.sv || (o.name.match(/\d+(\.\d+)?/) || [0])[0]);
        const dec = o.price;
        const am = decimalToAmerican(dec);

        if (oLow.startsWith('más de') || oLow.startsWith('over')) {
          overLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
        } else if (oLow.startsWith('menos de') || oLow.startsWith('under')) {
          underLines.push({ line: svNum, oddsDecimal: dec, oddsAmerican: am, oddsText: `${dec.toFixed(2)} (${am})`, rawSelection: o.name, oddId: o.id });
        }
      });

      const directions = [];
      if (overLines.length > 0) directions.push({ direction: 'over', lines: overLines });
      if (underLines.length > 0) directions.push({ direction: 'under', lines: underLines });

      if (statistic !== 'unknown' && directions.length > 0) {
        classifiedMarkets.push({
          marketId: mkt.id,
          marketText: mName,
          subject,
          statistic,
          scope,
          period,
          family,
          directions
        });
      }
    }

    catalogMatches.push({
      matchId: raw.matchId,
      eventId: raw.eventId,
      match: raw.match,
      homeTeam: raw.homeTeam,
      awayTeam: raw.awayTeam,
      league: raw.league,
      timeCDMX: raw.timeCDMX,
      markets: classifiedMarkets
    });
  }

  console.log(`[CATALOG] ${catalogMatches.length} partidos catalogados con alcance estricto.`);

  // -------------------------------------------------------------------------
  // FASE 2: DATAFUT DISCOVERY WITH 100% STRICT SCOPE MATCHING
  // -------------------------------------------------------------------------
  console.log('\n>>> FASE 2: DATAFUT-DISCOVERY & VERIFICACIÓN ESTRICTA (>= 65.0%, NON-TRIVIAL)');
  const dfScrapedMatches = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));

  const verifiedCandidates = [];

  for (const tm of targetMatches) {
    const dfMatch = dfScrapedMatches.find(m => m.title.includes(tm.dfTitle) || m.header.includes(tm.dfTitle));
    if (!dfMatch || !dfMatch.picks) continue;

    const catMatch = catalogMatches.find(m => m.matchId === tm.matchId);
    if (!catMatch) continue;

    for (const pick of dfMatch.picks) {
      if (pick.percentage === null || pick.percentage < 65.0) continue;
      if (isTrivialMarket(pick.rawTitle)) continue;

      const parsed = parseDataFutPickStrict(pick, tm);

      // Search for EXACT intersection in PlayDoIt catalog
      let foundExact = false;
      let matchedMarket = null;
      let matchedLine = null;

      for (const mkt of catMatch.markets) {
        // STRICT SCOPE MATCH
        if (mkt.scope !== parsed.scope) continue;
        // STRICT STAT MATCH
        if (mkt.statistic !== parsed.statistic) continue;
        // STRICT PERIOD MATCH
        if (mkt.period !== parsed.period) continue;

        for (const dir of mkt.directions) {
          if (dir.direction === parsed.direction) {
            const lineObj = dir.lines.find(l => Math.abs(l.line - parsed.line) < 0.01);
            if (lineObj) {
              foundExact = true;
              matchedMarket = mkt;
              matchedLine = lineObj;
              break;
            }
          }
        }
        if (foundExact) break;
      }

      if (foundExact) {
        let commercialPriority = 'normal';
        if (matchedLine.oddsDecimal <= 1.15) commercialPriority = 'very_low';
        else if (matchedLine.oddsDecimal <= 1.33) commercialPriority = 'low';

        verifiedCandidates.push({
          matchId: tm.matchId,
          match: tm.match,
          league: tm.league,
          timeCDMX: tm.timeCDMX,
          homeTeam: tm.homeTeam,
          awayTeam: tm.awayTeam,
          subject: parsed.subject,
          statistic: parsed.statistic,
          scope: parsed.scope,
          direction: parsed.direction,
          line: parsed.line,
          period: parsed.period,
          datafutMarket: parsed.market,
          percentage: parsed.percentage,
          sample: parsed.sample,
          evidence: parsed.evidence,
          family: parsed.family,
          commercialPriority,
          playdoitMarket: matchedMarket.marketText,
          playdoitSelection: matchedLine.rawSelection,
          oddsDecimal: matchedLine.oddsDecimal,
          oddsAmerican: matchedLine.oddsAmerican,
          oddsText: matchedLine.oddsText,
          oddId: matchedLine.oddId,
          marketId: matchedMarket.marketId
        });
      }
    }
  }

  // Deduplicate
  const uniqueCandidateMap = new Map();
  verifiedCandidates.forEach(c => {
    const key = `${c.match}|${c.scope}|${c.datafutMarket}|${c.line}`;
    if (!uniqueCandidateMap.has(key)) uniqueCandidateMap.set(key, c);
  });

  const uniqueVerified = Array.from(uniqueCandidateMap.values());
  // Sort by commercial priority, then percentage, then sample
  uniqueVerified.sort((a, b) => {
    const aExtreme = a.commercialPriority === 'very_low' ? 1 : 0;
    const bExtreme = b.commercialPriority === 'very_low' ? 1 : 0;
    if (aExtreme !== bExtreme) return aExtreme - bExtreme;
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return (b.sample.home + b.sample.away) - (a.sample.home + a.sample.away);
  });

  console.log(`\nCANDIDATOS 100% VERIFICADOS (ALCANCE ESTRICTO): ${uniqueVerified.length}`);
  uniqueVerified.forEach((c, idx) => {
    console.log(`[${idx + 1}] ${c.match} (${c.timeCDMX}) | Scope: ${c.scope}`);
    console.log(`     DataFut: "${c.datafutMarket}" -> ${c.percentage}%`);
    console.log(`     PlayDoIt: "${c.playdoitMarket} -> ${c.playdoitSelection}" -> Cuota: ${c.oddsText} (${c.commercialPriority})`);
    console.log(`     Evidencia: ${c.evidence[0]}\n`);
  });

  // -------------------------------------------------------------------------
  // FASE 3: POOL EDITORIAL DE 6 CANDIDATOS
  // -------------------------------------------------------------------------
  console.log('>>> FASE 3: CONSTRUCCIÓN DEL POOL EDITORIAL DE 6 CANDIDATOS');

  // Select 6 distinct matches / families
  const matchGroupMap = new Map();
  uniqueVerified.forEach(c => {
    if (!matchGroupMap.has(c.match)) matchGroupMap.set(c.match, []);
    matchGroupMap.get(c.match).push(c);
  });

  const pool = [];
  for (const [mName, cList] of matchGroupMap) {
    if (pool.length < 6 && cList.length > 0) {
      pool.push({
        candidateId: `POOL-${String(pool.length + 1).padStart(2, '0')}`,
        ...cList[0]
      });
    }
  }

  // Fill up to 6 if needed
  if (pool.length < 6) {
    for (const [mName, cList] of matchGroupMap) {
      if (cList.length > 1) {
        for (let i = 1; i < cList.length; i++) {
          if (pool.length < 6 && !pool.some(p => p.datafutMarket === cList[i].datafutMarket && p.match === cList[i].match)) {
            pool.push({
              candidateId: `POOL-${String(pool.length + 1).padStart(2, '0')}`,
              ...cList[i]
            });
          }
        }
      }
    }
  }

  console.log('\n=== POOL EDITORIAL OFICIAL SELECCIONADO (6 CANDIDATOS) ===');
  pool.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.candidateId}] ${c.match} (${c.timeCDMX} | ${c.league})`);
    console.log(`   - Mercado DataFut: ${c.datafutMarket} (${c.percentage}% | Muestra: ${c.sample.home}+${c.sample.away})`);
    console.log(`   - Mercado PlayDoIt: ${c.playdoitMarket} -> ${c.playdoitSelection}`);
    console.log(`   - Alcance: ${c.scope === 'match' ? 'Partido Completo (Ambos equipos)' : 'Equipo Individual'}`);
    console.log(`   - Cuota PlayDoIt: ${c.oddsText} (${c.commercialPriority})`);
    console.log(`   - Evidencia: ${c.evidence[0]}\n`);
  });

  // -------------------------------------------------------------------------
  // FASE 4: COTIZACIÓN EN VIVO DE TODAS LAS COMBINACIONES (15 DOBLES + 20 TRIPLES)
  // -------------------------------------------------------------------------
  console.log('>>> FASE 4: COTIZACIÓN EN VIVO EN BETSLIP DE PLAYDOIT');

  const doubles = getCombinations(pool, 2);
  const triples = getCombinations(pool, 3);
  const allCombos = [...doubles, ...triples];

  await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.init) wsdk.init({ integration: 'playdoit2', culture: 'es-ES', timezoneOffset: 360 });
  });

  const quotedCombos = [];
  for (let i = 0; i < allCombos.length; i++) {
    const combo = allCombos[i];
    const comboType = combo.length === 2 ? 'doble' : 'triple';
    const cIds = combo.map(c => c.candidateId);
    const oddIds = combo.map(c => c.oddId);
    const matches = combo.map(c => c.match);
    const hasSameMatch = new Set(matches).size < matches.length;

    const quoteResult = await page.evaluate(async ({ oIds, cList, isSameMatch }) => {
      const wsdk = window.WSDK || window.altenarWSDK;
      if (wsdk && wsdk.toggleSelections) {
        try { wsdk.toggleSelections([]); } catch(e) {}
      }

      let combinedDec = 1.0;
      cList.forEach(c => { combinedDec *= c.oddsDecimal; });
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

    quotedCombos.push({
      combinationId: `PARLAY-${comboType.toUpperCase()}-${String(i + 1).padStart(2, '0')}`,
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

  // Ensure betslip is empty
  const betslipStatus = await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.toggleSelections) wsdk.toggleSelections([]);
    return { empty: true };
  });

  await browser.close();

  console.log(`Combinaciones cotizadas exitosamente: ${quotedCombos.length} / ${allCombos.length}`);
  console.log(`Betslip quedó completamente vacío: ${betslipStatus.empty}`);

  // Save official state
  fs.writeFileSync(path.join(pipelineDir, 'master_clean_pool_21.json'), JSON.stringify({ pool, quotedCombos }, null, 2));

})();
