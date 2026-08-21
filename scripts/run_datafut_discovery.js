const fs = require('fs');
const path = require('path');

// Ensure pipeline-state folder exists
const pipelineDir = path.join(__dirname, '..', 'pipeline-state');
if (!fs.existsSync(pipelineDir)) {
  fs.mkdirSync(pipelineDir, { recursive: true });
}

// Load all raw picks extracted from DataFut
const rawPicksPath = path.join(__dirname, 'all_raw_datafut_picks.json');
const allRawPicks = JSON.parse(fs.readFileSync(rawPicksPath, 'utf8'));

console.log(`Loaded ${allRawPicks.length} raw picks from DataFut.`);

// Helper to parse market semantics
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

  // Check period
  if (t.toLowerCase().includes('1er tiempo') || t.toLowerCase().includes('primer tiempo') || t.toLowerCase().includes('1ª mitad')) {
    period = 'first_half';
  } else if (t.toLowerCase().includes('2do tiempo') || t.toLowerCase().includes('segundo tiempo') || t.toLowerCase().includes('2ª mitad')) {
    period = 'second_half';
  }

  // Direction
  if (t.toLowerCase().startsWith('más de') || t.toLowerCase().startsWith('mas de') || t.toLowerCase().startsWith('over')) {
    direction = 'over';
  } else if (t.toLowerCase().startsWith('menos de') || t.toLowerCase().startsWith('under')) {
    direction = 'under';
  }

  // Extract number / line
  const numMatch = t.match(/\d+(\.\d+)?/);
  if (numMatch) {
    line = parseFloat(numMatch[0]);
  }

  // Scope & Subject & Statistic & Family
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
  }

  // Parse sample numbers
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

// Filter and select candidates
// Rule: Prohibido durante selección normal: Más de 0.5 goles del partido.
const validParsed = allRawPicks
  .map(parseMarketSemantics)
  .filter(c => {
    if (c.percentage === null) return false;
    // Exclude trivial match Over 0.5 goals
    if (c.family === 'goals' && c.scope === 'match' && c.direction === 'over' && c.line <= 0.5) {
      return false;
    }
    return true;
  });

// We want a diverse set of up to 20 strong candidates across matches and families
// Selection strategy:
// 1. Ensure representation across all matches (LDU Quito, Macará, Leones FC, Athletic Club, Novorizontino, Corinthians, Real Cartagena).
// 2. Ensure representation across all families (fouls, cards, corners_team, corners_total, shots_on_target, shots, team_goals, goals).
// 3. Prioritize higher percentage and solid sample size.

// Group by match and family
const selectedCandidates = [];
const seenKeys = new Set();

function addCandidate(c) {
  const key = `${c.match}|${c.market}`;
  if (!seenKeys.has(key) && selectedCandidates.length < 20) {
    seenKeys.add(key);
    selectedCandidates.push(c);
    return true;
  }
  return false;
}

// 1. Top candidates for LDU Quito vs Mirassol (Libertadores)
const lduCandidates = validParsed
  .filter(c => c.match.includes('LDU Quito'))
  .sort((a, b) => b.percentage - a.percentage);

// Local marca (71.4%), Más de 1.5 goles (71.4%), Más de 6.5 corners (71.4%), Más de 17.5 tiros (71.4%)
lduCandidates.filter(c => c.family === 'team_goals').slice(0, 1).forEach(addCandidate);
lduCandidates.filter(c => c.family === 'goals' && c.line === 1.5).slice(0, 1).forEach(addCandidate);
lduCandidates.filter(c => c.family === 'corners_total' && c.line <= 7.5).slice(0, 1).forEach(addCandidate);
lduCandidates.filter(c => c.family === 'shots_on_target' || c.family === 'shots').slice(0, 1).forEach(addCandidate);

// 2. Top candidates for Macará vs Santos (Sudamericana)
const macaraCandidates = validParsed
  .filter(c => c.match.includes('Macará'))
  .sort((a, b) => b.percentage - a.percentage);

macaraCandidates.filter(c => c.family === 'team_goals').slice(0, 1).forEach(addCandidate);
macaraCandidates.filter(c => c.family === 'goals' && c.line === 1.5).slice(0, 1).forEach(addCandidate);
macaraCandidates.filter(c => c.family === 'corners_total' && c.line <= 7.5).slice(0, 1).forEach(addCandidate);
macaraCandidates.filter(c => c.family === 'shots_on_target' || c.family === 'shots').slice(0, 1).forEach(addCandidate);

// 3. Top candidates for Leones FC vs Real Cundinamarca (Colombia Primera B)
const leonesCandidates = validParsed
  .filter(c => c.match.includes('Leones FC'))
  .sort((a, b) => b.percentage - a.percentage);

leonesCandidates.filter(c => c.direction === 'under' && c.line === 3.5).slice(0, 1).forEach(addCandidate);
leonesCandidates.filter(c => c.family === 'goals' && c.line === 1.5).slice(0, 1).forEach(addCandidate);

// 4. Top candidates for Athletic Club vs CRB (Brasileirão Série B)
const athleticCandidates = validParsed
  .filter(c => c.match.includes('Athletic Club'))
  .sort((a, b) => b.percentage - a.percentage);

athleticCandidates.filter(c => c.family === 'fouls').slice(0, 2).forEach(addCandidate);
athleticCandidates.filter(c => c.family === 'cards').slice(0, 2).forEach(addCandidate);
athleticCandidates.filter(c => c.family === 'shots_on_target').slice(0, 1).forEach(addCandidate);
athleticCandidates.filter(c => c.family === 'shots').slice(0, 1).forEach(addCandidate);

// 5. Top candidates for Novorizontino vs América Mineiro (Brasileirão Série B)
const novoCandidates = validParsed
  .filter(c => c.match.includes('Novorizontino'))
  .sort((a, b) => b.percentage - a.percentage);

novoCandidates.filter(c => c.family === 'fouls').slice(0, 1).forEach(addCandidate);
novoCandidates.filter(c => c.family === 'cards').slice(0, 1).forEach(addCandidate);
novoCandidates.filter(c => c.family === 'shots_on_target').slice(0, 1).forEach(addCandidate);

// 6. Top candidates for Corinthians vs Rosario Central (Libertadores)
const corinthiansCandidates = validParsed
  .filter(c => c.match.includes('Corinthians'))
  .sort((a, b) => b.percentage - a.percentage);

corinthiansCandidates.filter(c => c.family === 'corners_team').slice(0, 1).forEach(addCandidate);
corinthiansCandidates.filter(c => c.family === 'shots_on_target').slice(0, 1).forEach(addCandidate);

// 7. Top candidate for Real Cartagena vs Bogotá FC (Colombia Primera B)
const cartagenaCandidates = validParsed
  .filter(c => c.match.includes('Real Cartagena'))
  .sort((a, b) => b.percentage - a.percentage);

cartagenaCandidates.filter(c => c.family === 'goals' && c.line === 1.5).slice(0, 1).forEach(addCandidate);

// Fill up to exactly 20 candidates if needed from highest quality remaining candidates
if (selectedCandidates.length < 20) {
  const remaining = validParsed
    .sort((a, b) => b.percentage - a.percentage);
  for (const r of remaining) {
    if (selectedCandidates.length >= 20) break;
    addCandidate(r);
  }
}

// Assign official Candidate IDs DF-001 .. DF-020
const finalCandidates = selectedCandidates.slice(0, 20).map((c, idx) => {
  const num = String(idx + 1).padStart(3, '0');
  return {
    candidateId: `DF-${num}`,
    ...c
  };
});

const discoveryOutput = {
  generatedAt: new Date().toISOString(),
  date: "2026-08-20",
  round: 1,
  source: "DataFut",
  candidates: finalCandidates
};

const outputPath = path.join(pipelineDir, 'discovery-candidates.json');
fs.writeFileSync(outputPath, JSON.stringify(discoveryOutput, null, 2), 'utf8');

console.log(`\nSuccessfully generated ${finalCandidates.length} Discovery candidates.`);
console.log(`Saved to: ${outputPath}`);

console.log('\n--- CANDIDATES SUMMARY ---');
finalCandidates.forEach(c => {
  console.log(`[${c.candidateId}] [${c.family.padEnd(16)}] ${c.match.padEnd(36)} -> ${c.market} (${c.percentage}%) [sample: ${c.sample.home}+${c.sample.away}]`);
});
