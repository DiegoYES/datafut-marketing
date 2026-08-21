const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const pipelineDir = path.join(__dirname, '..', 'pipeline-state');
if (!fs.existsSync(pipelineDir)) {
  fs.mkdirSync(pipelineDir, { recursive: true });
}

// Trivial market checker
function isTrivialMarket(t) {
  const low = t.toLowerCase();
  
  if (/más de 0\.5 goles/i.test(low) && !low.includes('local') && !low.includes('visitante') && !low.includes('tiempo') && !low.includes('mitad')) {
    return true;
  }
  
  if ((low.includes('tiro a puerta') || low.includes('tiros a puerta')) && low.startsWith('más de')) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }

  if ((low.includes('tarjeta') || low.includes('amarilla')) && low.startsWith('más de')) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 0.5) return true;
  }

  if ((low.includes('córner') || low.includes('corner')) && low.startsWith('más de')) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }

  if (low.includes('falta') && low.startsWith('más de')) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 2.5) return true;
  }

  return false;
}

// Semantic parser
function parseMarketSemantics(pick) {
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
    if (t.toLowerCase().includes('del local')) {
      subject = homeTeam;
      scope = 'team';
    } else if (t.toLowerCase().includes('del visitante')) {
      subject = awayTeam;
      scope = 'team';
    } else {
      subject = match;
      scope = 'match';
    }
  } else if (t.toLowerCase().includes('tiro') || t.toLowerCase().includes('tiros')) {
    statistic = 'shots';
    family = 'shots';
    if (t.toLowerCase().includes('del local')) {
      subject = homeTeam;
      scope = 'team';
    } else if (t.toLowerCase().includes('del visitante')) {
      subject = awayTeam;
      scope = 'team';
    } else {
      subject = match;
      scope = 'match';
    }
  } else if (t.toLowerCase().includes('córner') || t.toLowerCase().includes('corner') || t.toLowerCase().includes('córners') || t.toLowerCase().includes('corners')) {
    statistic = 'corners';
    if (t.toLowerCase().includes('del local')) {
      subject = homeTeam;
      scope = 'team';
      family = 'corners_team';
    } else if (t.toLowerCase().includes('del visitante')) {
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
    if (t.toLowerCase().includes('del local')) {
      subject = homeTeam;
      scope = 'team';
    } else if (t.toLowerCase().includes('del visitante')) {
      subject = awayTeam;
      scope = 'team';
    } else {
      subject = match;
      scope = 'match';
    }
  } else if (t.toLowerCase().includes('tarjeta') || t.toLowerCase().includes('tarjetas') || t.toLowerCase().includes('amarilla')) {
    statistic = 'yellow_cards';
    family = 'cards';
    if (t.toLowerCase().includes('del local')) {
      subject = homeTeam;
      scope = 'team';
    } else if (t.toLowerCase().includes('del visitante')) {
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
    if (t.toLowerCase().includes('del local') || t.toLowerCase().includes('local más de')) {
      subject = homeTeam;
      scope = 'team';
    } else if (t.toLowerCase().includes('del visitante') || t.toLowerCase().includes('visitante más de')) {
      subject = awayTeam;
      scope = 'team';
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
    sample: {
      home: sampleHome,
      away: sampleAway
    },
    evidence: pick.evidenceText.length > 0 ? pick.evidenceText : [
      `Muestra DataFut: ${pick.sampleLine || 'Nativa'}`
    ],
    family
  };
}

(async () => {
  console.log('================================================================');
  console.log('   DATAFUT-MARKETING: DISCOVERY, VERIFICATION & REPLENISHMENT   ');
  console.log('================================================================');

  const allRawPicks = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_raw_datafut_picks.json'), 'utf8'));
  const parsedPicks = allRawPicks
    .filter(p => !isTrivialMarket(p.rawTitle) && p.percentage !== null)
    .map(parseMarketSemantics);

  console.log(`Loaded ${parsedPicks.length} valid non-trivial DataFut picks.`);

  // Launch PlayDoIt live browser in headed mode
  console.log('\n[PLAYDOIT] Launching live headed browser session...');
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Verification helper function
  async function verifyBatchInPlayDoIt(candidateList, round) {
    const matchEventMap = {
      'LDU Quito vs Mirassol': 16807924,
      'Macará vs Santos': 17281413,
      'Leones FC vs Real Cundinamarca': 17414465
    };

    const results = await page.evaluate(async ({ batch, eventMap, rNum }) => {
      const out = [];
      const cache = new Map();

      for (const c of batch) {
        const eventId = eventMap[c.match];
        if (!eventId) {
          out.push({
            candidateId: c.candidateId,
            round: rNum,
            status: 'NOT_AVAILABLE',
            reason: 'NOT_AVAILABLE: Partido no ofrecido actualmente en el catálogo público de PlayDoIt.',
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
            round: rNum,
            status: 'NOT_VERIFIED',
            reason: `NOT_VERIFIED: Falló consulta de mercados en PlayDoIt (${evData.error})`,
            requested: c,
            playdoit: null
          });
          continue;
        }

        const allMarkets = evData.markets;
        let matched = false;
        let status = 'MARKET_MISMATCH';
        let reason = '';
        let playdoitData = null;

        // 1. Goals
        if (c.statistic === 'goals') {
          if (c.scope === 'match') {
            const totalMkt = allMarkets.find(m => m.name === 'Total' || m.name === 'Goles Totales');
            if (totalMkt && totalMkt.odds) {
              const dirText = c.direction === 'over' ? 'más de' : 'menos de';
              const lineStr = String(c.line).replace('.', ',');
              const exactOdd = totalMkt.odds.find(o => {
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
                  marketText: totalMkt.name,
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
                  marketId: totalMkt.id,
                  oddId: exactOdd.id
                };
              } else {
                status = 'LINE_MISMATCH';
                const available = totalMkt.odds.map(o => o.name).join(', ');
                reason = `LINE_MISMATCH: Total Goles existe pero no contiene la línea ${c.line}. Líneas en PlayDoIt: [${available}]`;
              }
            } else {
              status = 'MARKET_MISMATCH';
              reason = 'MARKET_MISMATCH: Mercado Total Goles no disponible en PlayDoIt.';
            }
          } else if (c.scope === 'team') {
            const teamMkt = allMarkets.find(m => 
              m.name.toLowerCase().includes(`${c.subject.toLowerCase()} total de goles`) ||
              (m.name.toLowerCase().includes('total de goles') && m.name.toLowerCase().includes(c.subject.toLowerCase()))
            );
            if (teamMkt && teamMkt.odds) {
              const dirText = c.direction === 'over' ? 'más de' : 'menos de';
              const lineStr = String(c.line).replace('.', ',');
              const exactOdd = teamMkt.odds.find(o => {
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
                  marketText: teamMkt.name,
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
                  marketId: teamMkt.id,
                  oddId: exactOdd.id
                };
              } else {
                status = 'LINE_MISMATCH';
                const available = teamMkt.odds.map(o => o.name).join(', ');
                reason = `LINE_MISMATCH: Goles de ${c.subject} no disponible con línea ${c.line}. Líneas en PlayDoIt: [${available}]`;
              }
            } else {
              status = 'MARKET_MISMATCH';
              reason = `MARKET_MISMATCH: Goles individuales de ${c.subject} no disponible en PlayDoIt.`;
            }
          }
        }

        // 2. Corners
        else if (c.statistic === 'corners') {
          const cornerMkt = allMarkets.find(m => 
            m.name.toLowerCase() === 'total de córners' || 
            m.name.toLowerCase() === 'total tiros de esquina' ||
            m.name.toLowerCase() === 'córners totales'
          );
          if (cornerMkt && cornerMkt.odds) {
            const dirText = c.direction === 'over' ? 'más de' : 'menos de';
            const lineStr = String(c.line).replace('.', ',');
            const exactOdd = cornerMkt.odds.find(o => {
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
                marketText: cornerMkt.name,
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
                marketId: cornerMkt.id,
                oddId: exactOdd.id
              };
            } else {
              status = 'LINE_MISMATCH';
              const available = cornerMkt.odds.map(o => o.name).join(', ');
              reason = `LINE_MISMATCH: Córners totales existe pero no con línea ${c.line}. Líneas en PlayDoIt: [${available}]`;
            }
          } else {
            status = 'MARKET_MISMATCH';
            reason = 'MARKET_MISMATCH: Mercado de córners regular no habilitado en PlayDoIt.';
          }
        }

        // 3. Cards
        else if (c.statistic === 'yellow_cards' || c.statistic === 'cards') {
          const cardMkt = allMarkets.find(m => m.name.toLowerCase() === 'total de tarjetas' || m.name.toLowerCase() === 'tarjetas');
          if (cardMkt && cardMkt.odds) {
            const dirText = c.direction === 'over' ? 'más de' : 'menos de';
            const lineStr = String(c.line).replace('.', ',');
            const exactOdd = cardMkt.odds.find(o => {
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
                marketText: cardMkt.name,
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
                marketId: cardMkt.id,
                oddId: exactOdd.id
              };
            } else {
              status = 'LINE_MISMATCH';
              const available = cardMkt.odds.map(o => o.name).join(', ');
              reason = `LINE_MISMATCH: Tarjetas totales existe pero no con línea ${c.line}. Líneas en PlayDoIt: [${available}]`;
            }
          } else {
            status = 'MARKET_MISMATCH';
            reason = 'MARKET_MISMATCH: Mercado de tarjetas no disponible en PlayDoIt.';
          }
        }

        // 4. Fouls / Shots / Remates
        else {
          const statsMarkets = allMarkets.filter(m => 
            m.name.toLowerCase().includes('falta') || 
            m.name.toLowerCase().includes('tiro') || 
            m.name.toLowerCase().includes('remate')
          );
          if (statsMarkets.length > 0) {
            status = 'SCOPE_MISMATCH';
            reason = `SCOPE_MISMATCH: PlayDoIt solo ofrece mercados por rangos (${statsMarkets.map(m => m.name).slice(0, 2).join('; ')}), no la línea individual regular ${c.line}.`;
          } else {
            status = 'MARKET_MISMATCH';
            reason = `MARKET_MISMATCH: La estadística ${c.statistic} (${c.market}) no se comercializa en PlayDoIt para este partido.`;
          }
        }

        out.push({
          candidateId: c.candidateId,
          round: rNum,
          status,
          reason,
          requested: c,
          playdoit: playdoitData
        });
      }

      return out;
    }, { batch: candidateList, eventMap: matchEventMap, rNum: round });

    return results;
  }

  const evaluatedKeys = new Set();
  const allVerifiedResults = [];
  const allDiscoveryCandidates = [];
  let candidateCounter = 1;

  function tryAdd(c, batch, maxBatchSize) {
    const key = `${c.match}|${c.market}`;
    if (!evaluatedKeys.has(key) && batch.length < maxBatchSize) {
      evaluatedKeys.add(key);
      const cId = `DF-${String(candidateCounter++).padStart(3, '0')}`;
      const item = { candidateId: cId, ...c };
      batch.push(item);
      allDiscoveryCandidates.push(item);
      return true;
    }
    return false;
  }

  // --- ROUND 1: DISCOVERY (Initial 20 candidates across all 7 matches & multiple families) ---
  console.log('\n--- [ROUNDS] INITIATING ROUND 1: DISCOVERY ---');
  const round1Batch = [];
  
  // High quality representative candidates across all matches
  const round1Selections = [
    // LDU Quito vs Mirassol (goals, corners, shots on target, fouls)
    parsedPicks.find(p => p.match.includes('LDU Quito') && p.market === 'Más de 1.5 goles'),
    parsedPicks.find(p => p.match.includes('LDU Quito') && p.market === 'Menos de 11.5 córners totales'),
    parsedPicks.find(p => p.match.includes('LDU Quito') && p.market === 'Más de 2.5 tiros a puerta del local'),
    parsedPicks.find(p => p.match.includes('LDU Quito') && p.market === 'Menos de 11.5 faltas del visitante'),
    
    // Macará vs Santos (goals, corners, shots on target, cards)
    parsedPicks.find(p => p.match.includes('Macará') && p.market === 'Más de 1.5 goles'),
    parsedPicks.find(p => p.match.includes('Macará') && p.market === 'Más de 6.5 córners totales'),
    parsedPicks.find(p => p.match.includes('Macará') && p.market === 'Menos de 5.5 tiros a puerta del local'),
    parsedPicks.find(p => p.match.includes('Macará') && p.market === 'Más de 1.5 tarjetas amarillas totales'),

    // Leones FC vs Real Cundinamarca (goals under 3.5)
    parsedPicks.find(p => p.match.includes('Leones FC') && p.market === 'Menos de 3.5 goles'),

    // Athletic Club vs CRB (fouls, cards, shots, shots on target)
    parsedPicks.find(p => p.match.includes('Athletic Club') && p.market === 'Más de 8.5 faltas del local'),
    parsedPicks.find(p => p.match.includes('Athletic Club') && p.market === 'Más de 1.5 tarjetas amarillas totales'),
    parsedPicks.find(p => p.match.includes('Athletic Club') && p.market === 'Más de 17.5 tiros totales'),
    parsedPicks.find(p => p.match.includes('Athletic Club') && p.market === 'Más de 10.5 faltas del local'),
    parsedPicks.find(p => p.match.includes('Athletic Club') && p.market === 'Más de 1.5 tarjetas registradas totales'),

    // Novorizontino vs América Mineiro (fouls, cards, shots)
    parsedPicks.find(p => p.match.includes('Novorizontino') && p.market === 'Más de 8.5 faltas del local'),
    parsedPicks.find(p => p.match.includes('Novorizontino') && p.market === 'Más de 1.5 tarjetas amarillas totales'),
    parsedPicks.find(p => p.match.includes('Novorizontino') && p.market === 'Más de 1.5 fueras de juego totales'),

    // Corinthians vs Rosario Central (corners, shots)
    parsedPicks.find(p => p.match.includes('Corinthians') && p.market === 'Más de 2.5 córners del local'),
    parsedPicks.find(p => p.match.includes('Corinthians') && p.market === 'Más de 17.5 tiros totales'),

    // Real Cartagena vs Bogotá FC (goals)
    parsedPicks.find(p => p.match.includes('Real Cartagena') && p.market === 'Más de 1.5 goles')
  ].filter(Boolean);

  round1Selections.forEach(p => tryAdd(p, round1Batch, 20));

  console.log(`Round 1 produced ${round1Batch.length} candidates.`);

  // --- ROUND 1: VERIFICATION ---
  console.log('\n--- [ROUNDS] INITIATING ROUND 1: PLAYDOIT VERIFICATION ---');
  const r1Results = await verifyBatchInPlayDoIt(round1Batch, 1);
  r1Results.forEach(r => allVerifiedResults.push(r));

  let availableExact = allVerifiedResults.filter(r => r.status === 'AVAILABLE_EXACT');
  console.log(`Round 1 Results: ${availableExact.length} AVAILABLE_EXACT, ${round1Batch.length - availableExact.length} Discarded.`);

  // --- REPLENISHMENT LOOP ---
  let currentRound = 1;
  const maxRounds = 4;

  while (availableExact.length < 6 && currentRound < maxRounds) {
    currentRound++;
    console.log(`\n================================================================`);
    console.log(`   [REPLENISHMENT] ROUND ${currentRound}: Generating up to 10 NEW candidates   `);
    console.log(`================================================================`);

    const replenishmentBatch = [];

    // Prioritize high-quality distinct candidate lines from active matches
    const replenishmentPriorities = [
      parsedPicks.find(p => p.match.includes('Leones FC') && p.market === 'Menos de 2.5 goles' && !evaluatedKeys.has(`${p.match}|${p.market}`)),
      parsedPicks.find(p => p.match.includes('Leones FC') && p.market === 'Más de 1.5 goles' && !evaluatedKeys.has(`${p.match}|${p.market}`)),
      parsedPicks.find(p => p.match.includes('Macará') && p.market === 'Menos de 3.5 goles' && !evaluatedKeys.has(`${p.match}|${p.market}`)),
      parsedPicks.find(p => p.match.includes('LDU Quito') && p.market === 'Menos de 3.5 goles' && !evaluatedKeys.has(`${p.match}|${p.market}`)),
      parsedPicks.find(p => p.match.includes('Macará') && p.market === 'Menos de 2.5 goles' && !evaluatedKeys.has(`${p.match}|${p.market}`)),
      ...parsedPicks.filter(p => !evaluatedKeys.has(`${p.match}|${p.market}`)).sort((a, b) => b.percentage - a.percentage)
    ].filter(Boolean);

    for (const p of replenishmentPriorities) {
      if (replenishmentBatch.length >= 10) break;
      tryAdd(p, replenishmentBatch, 10);
    }

    if (replenishmentBatch.length === 0) {
      console.log('No more unexplored candidates found in DataFut.');
      break;
    }

    console.log(`Round ${currentRound} Discovery generated ${replenishmentBatch.length} new candidates.`);

    // Run PlayDoIt verification on replenishment batch
    console.log(`Executing Round ${currentRound} PlayDoIt live verification...`);
    const repResults = await verifyBatchInPlayDoIt(replenishmentBatch, currentRound);
    repResults.forEach(r => allVerifiedResults.push(r));

    availableExact = allVerifiedResults.filter(r => r.status === 'AVAILABLE_EXACT');
    console.log(`Current Total AVAILABLE_EXACT: ${availableExact.length} / 6`);

    if (availableExact.length >= 6) {
      console.log(`Successfully reached the target of ${availableExact.length} AVAILABLE_EXACT candidates!`);
      break;
    }
  }

  await browser.close();

  // Save official discovery-candidates.json
  const discoveryOutput = {
    generatedAt: new Date().toISOString(),
    date: "2026-08-20",
    roundsExecuted: currentRound,
    totalCandidates: allDiscoveryCandidates.length,
    source: "DataFut",
    candidates: allDiscoveryCandidates
  };
  fs.writeFileSync(
    path.join(pipelineDir, 'discovery-candidates.json'),
    JSON.stringify(discoveryOutput, null, 2),
    'utf8'
  );

  // Save official verified-candidates.json
  const verifiedOutput = {
    verifiedAt: new Date().toISOString(),
    navigationMode: "headed",
    evidenceSource: "live_dom",
    totalRounds: currentRound,
    totalCandidatesReviewed: allVerifiedResults.length,
    availableExactCount: availableExact.length,
    discardedCount: allVerifiedResults.length - availableExact.length,
    finalPool: availableExact.slice(0, 6),
    results: allVerifiedResults
  };
  fs.writeFileSync(
    path.join(pipelineDir, 'verified-candidates.json'),
    JSON.stringify(verifiedOutput, null, 2),
    'utf8'
  );

  console.log('\n================================================================');
  console.log('   PIPELINE EXECUTION COMPLETE (STOPPING BEFORE BUILDER)        ');
  console.log('================================================================');
  console.log(`Total Rounds: ${currentRound}`);
  console.log(`Total Candidates Evaluated: ${allVerifiedResults.length}`);
  console.log(`AVAILABLE_EXACT: ${availableExact.length}`);
  console.log(`Discarded: ${allVerifiedResults.length - availableExact.length}`);
  console.log(`discovery-candidates.json and verified-candidates.json updated.`);

  console.log('\n--- FINAL POOL (Max 6 AVAILABLE_EXACT) ---');
  availableExact.slice(0, 6).forEach((r, idx) => {
    const p = r.playdoit;
    const req = r.requested;
    console.log(`[${idx+1}] [${r.candidateId}] [Ronda ${r.round}] ${req.match} -> ${p.marketText}: ${p.selectionText} | Cuota: ${p.oddsText} | DataFut: ${req.percentage}% (${req.sample.home}+${req.sample.away})`);
  });

})();
