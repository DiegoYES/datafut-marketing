const fs = require('fs');
const path = require('path');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pipeline-state', 'playdoit-catalog.json'), 'utf8'));
const allRawPicks = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_raw_datafut_picks.json'), 'utf8'));

// Trivial market filter
function isTrivialMarket(t) {
  const low = t.toLowerCase().trim();
  
  // Over 0.5 goals match
  if (/más de 0\.5 goles/i.test(low) && !low.includes('local') && !low.includes('visitante') && !low.includes('tiempo') && !low.includes('mitad')) {
    return true;
  }
  
  // Shots on target <= 1.5 over
  if ((low.includes('tiro a puerta') || low.includes('tiros a puerta') || low.includes('remate a portería') || low.includes('remate a puerta')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }

  // Shots <= 2.5 over
  if ((low.includes('tiro') || low.includes('tiros') || low.includes('remates')) && !low.includes('puerta') && !low.includes('portería') && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 2.5) return true;
  }

  // Cards <= 0.5 over
  if ((low.includes('tarjeta') || low.includes('amarilla')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 0.5) return true;
  }

  // Corners <= 1.5 over
  if ((low.includes('córner') || low.includes('corner') || low.includes('córners') || low.includes('corners') || low.includes('esquina')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }

  // Fouls <= 2.5 over
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

console.log(`Total DataFut raw picks: ${allRawPicks.length}`);

// Analysis counters
let discardedLessThan65 = 0;
let discardedTrivial = 0;
let discardedNoMatchInCatalog = 0;
let discardedNoFamilyInCatalog = 0;
let discardedLineMismatchInCatalog = 0;
let matchingCandidates = [];

const catalogMatchMap = new Map();
catalog.matches.forEach(m => {
  const normName = `${m.homeTeam} vs ${m.awayTeam}`.toLowerCase();
  catalogMatchMap.set(normName, m);
});

for (const rawPick of allRawPicks) {
  // 1. Percentage check >= 65.0
  if (rawPick.percentage === null || rawPick.percentage < 65.0) {
    discardedLessThan65++;
    continue;
  }

  // 2. Trivial check
  if (isTrivialMarket(rawPick.rawTitle)) {
    discardedTrivial++;
    continue;
  }

  const parsed = parseDataFutPick(rawPick);

  // 3. Match in Catalog check
  const matchKey = parsed.match.toLowerCase();
  const catMatch = catalogMatchMap.get(matchKey);
  if (!catMatch) {
    discardedNoMatchInCatalog++;
    continue;
  }

  // 4. Check intersection with Catalog markets & exact lines
  let foundExactInCatalog = false;
  let catalogMarketFound = null;
  let catalogLineFound = null;

  for (const mkt of catMatch.markets) {
    // Check statistic & scope & period match
    if (mkt.statistic === parsed.statistic && mkt.scope === parsed.scope && mkt.period === parsed.period) {
      // Check subject if team
      if (parsed.scope === 'team') {
        const pSubj = parsed.subject.toLowerCase();
        const mSubj = mkt.subject.toLowerCase();
        if (!pSubj.includes(mSubj) && !mSubj.includes(pSubj)) {
          continue;
        }
      }

      // Check direction and line
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
    matchingCandidates.push({
      candidate: parsed,
      catalogMatchId: catMatch.matchId,
      catalogMarket: catalogMarketFound.marketText,
      catalogLine: catalogLineFound
    });
  } else {
    // Check if family existed
    const familyExists = catMatch.markets.some(m => m.statistic === parsed.statistic);
    if (!familyExists) {
      discardedNoFamilyInCatalog++;
    } else {
      discardedLineMismatchInCatalog++;
    }
  }
}

console.log(`\n=== DISCOVERY FILTERING RESULTS ===`);
console.log(`Discarded (<65%): ${discardedLessThan65}`);
console.log(`Discarded (Trivial): ${discardedTrivial}`);
console.log(`Discarded (No match in Catalog): ${discardedNoMatchInCatalog}`);
console.log(`Discarded (Family not in Catalog): ${discardedNoFamilyInCatalog}`);
console.log(`Discarded (Line mismatch in Catalog): ${discardedLineMismatchInCatalog}`);
console.log(`Matching Candidates (Exact Intersection): ${matchingCandidates.length}`);

console.log('\n--- MATCHING CANDIDATES DETAILS ---');
matchingCandidates.forEach((mc, i) => {
  console.log(`[${i+1}] ${mc.candidate.match} | ${mc.candidate.market} | ${mc.candidate.percentage}% | PlayDoIt Line: ${mc.catalogLine.line} @ ${mc.catalogLine.oddsText}`);
});
