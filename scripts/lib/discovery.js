const TEAM_NOISE = new Set([
  'club', 'fc', 'f', 'w', 'women', 'femenil', 'femenina', 'cf', 'ac', 'sc'
]);
const PERCENTAGE_THRESHOLD_EXCLUSIVE = 70;
const { createDatafutCard, validateDatafutCard } = require('./datafut-provenance');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeTeamName(value) {
  return normalizeText(value)
    .split(' ')
    .filter(token => token && !TEAM_NOISE.has(token))
    .join(' ');
}

function matchCatalogEntry(catalog, sourceTitle) {
  const normalizedTitle = normalizeText(sourceTitle);
  return catalog.matches.find(match => {
    const home = normalizeTeamName(match.homeTeam);
    const away = normalizeTeamName(match.awayTeam);
    return home && away && normalizedTitle.includes(home) && normalizedTitle.includes(away);
  }) || null;
}

function parsePrediction(rawTitle, catalogMatch) {
  const normalized = normalizeText(rawTitle);
  const lineMatch = String(rawTitle || '').match(/\b(\d+(?:[.,]\d+)?)\b/);
  if (!lineMatch) return null;

  const direction = /^(mas|over)\b/.test(normalized)
    ? 'over'
    : /^(menos|under)\b/.test(normalized)
      ? 'under'
      : null;
  if (!direction) return null;

  let statistic = null;
  if (/tiros? a puerta|remates? a puerta/.test(normalized)) statistic = 'shots_on_target';
  else if (/tiros?|remates?/.test(normalized)) statistic = 'shots';
  else if (/corners?|tiros? de esquina/.test(normalized)) statistic = 'corners';
  else if (/tarjetas?|amarillas?/.test(normalized)) statistic = 'yellow_cards';
  else if (/faltas?/.test(normalized)) statistic = 'fouls';
  else if (/goles?/.test(normalized)) statistic = 'goals';
  if (!statistic) return null;

  const period = /1er tiempo|primer tiempo|1a mitad/.test(normalized)
    ? 'first_half'
    : /2do tiempo|segundo tiempo|2a mitad/.test(normalized)
      ? 'second_half'
      : 'full_time';

  const isHome = /del local|equipo local/.test(normalized);
  const isAway = /del visitante|equipo visitante/.test(normalized);
  const scope = isHome || isAway ? 'team' : 'match';
  const subject = isHome
    ? catalogMatch.homeTeam
    : isAway
      ? catalogMatch.awayTeam
      : `${catalogMatch.homeTeam} vs ${catalogMatch.awayTeam}`;

  return {
    statistic,
    scope,
    subject,
    direction,
    line: Number(lineMatch[1].replace(',', '.')),
    period
  };
}

function findCatalogLine(catalogMatch, semantics) {
  for (const market of catalogMatch.markets || []) {
    if (market.statistic !== semantics.statistic) continue;
    if (market.scope !== semantics.scope) continue;
    if (market.period !== semantics.period) continue;
    if (semantics.scope === 'team' && normalizeTeamName(market.subject) !== normalizeTeamName(semantics.subject)) {
      continue;
    }

    const direction = (market.directions || []).find(item => item.direction === semantics.direction);
    const line = direction?.lines?.find(item => Number(item.line) === semantics.line);
    if (line) return { market, line };
  }
  return null;
}

function isTrivialCandidate(semantics) {
  if (semantics.direction !== 'over') return false;
  if (semantics.statistic === 'goals') return semantics.line <= 0.5;
  if (semantics.statistic === 'shots') return semantics.line <= 2.5;
  if (semantics.statistic === 'shots_on_target') return semantics.line <= 1.5;
  if (semantics.statistic === 'yellow_cards') return semantics.line <= 0.5;
  if (semantics.statistic === 'corners') return semantics.line <= 1.5;
  if (semantics.statistic === 'fouls') return semantics.line <= 2.5;
  return false;
}

function parseSample(evidenceText) {
  const evidence = Array.isArray(evidenceText) ? evidenceText.join(' ') : String(evidenceText || '');
  const samples = [...evidence.matchAll(/(\d+)\s*\/\s*(\d+)\s*veces/gi)].map(match => Number(match[2]));
  return {
    home: samples[0] || null,
    away: samples[1] || null
  };
}

function commercialPriority(oddsText) {
  const odds = Number(String(oddsText || '').replace('+', ''));
  if (!Number.isFinite(odds)) return 'unknown';
  if (Math.abs(odds) >= 1000) return 'very_low';
  if (Math.abs(odds) >= 500) return 'low';
  return 'normal';
}

function candidateKey(candidate) {
  return [
    candidate.catalogMatchId,
    normalizeText(candidate.subject),
    candidate.statistic,
    candidate.scope,
    candidate.direction,
    Number(candidate.line),
    candidate.period
  ].join('|');
}

function compareCandidateQuality(left, right) {
  const commercialRank = { normal: 0, low: 1, very_low: 2, unknown: 3 };
  const priorityDifference =
    (commercialRank[left.commercialPriority] ?? 3) -
    (commercialRank[right.commercialPriority] ?? 3);
  if (priorityDifference !== 0) return priorityDifference;

  const percentageDifference = Number(right.percentage) - Number(left.percentage);
  if (percentageDifference !== 0) return percentageDifference;

  const leftSample = Number(left.sample?.home || 0) + Number(left.sample?.away || 0);
  const rightSample = Number(right.sample?.home || 0) + Number(right.sample?.away || 0);
  if (rightSample !== leftSample) return rightSample - leftSample;

  return candidateKey(left).localeCompare(candidateKey(right));
}

function discoverCandidates(catalog, rawMatches, options = {}) {
  const percentageThresholdExclusive = Number(
    options.percentageThresholdExclusive ?? PERCENTAGE_THRESHOLD_EXCLUSIVE
  );
  const limit = Number(options.limit || 20);
  const round = Number(options.round || 1);
  const excludedKeys = new Set(options.excludedKeys || []);
  const candidates = [];
  const seen = new Set();

  for (const rawMatch of rawMatches) {
    const catalogMatch = matchCatalogEntry(catalog, rawMatch.title || rawMatch.header);
    if (!catalogMatch) continue;

    for (const pick of rawMatch.picks || []) {
      if (
        !Number.isFinite(pick.percentage) ||
        pick.percentage <= percentageThresholdExclusive
      ) continue;
      const semantics = parsePrediction(pick.rawTitle, catalogMatch);
      if (!semantics || isTrivialCandidate(semantics)) continue;
      const catalogLine = findCatalogLine(catalogMatch, semantics);
      if (!catalogLine) continue;

      const key = candidateKey({ catalogMatchId: catalogMatch.matchId, ...semantics });
      if (seen.has(key) || excludedKeys.has(key)) continue;
      seen.add(key);

      candidates.push({
        candidateKey: key,
        catalogMatchId: catalogMatch.matchId,
        match: `${catalogMatch.homeTeam} vs ${catalogMatch.awayTeam}`,
        league: catalogMatch.league,
        subject: semantics.subject,
        statistic: semantics.statistic,
        scope: semantics.scope,
        direction: semantics.direction,
        line: semantics.line,
        period: semantics.period,
        market: pick.rawTitle,
        percentage: pick.percentage,
        sample: parseSample(pick.evidenceText),
        sampleText: pick.sampleLine || null,
        evidence: Array.isArray(pick.evidenceText) ? pick.evidenceText : [],
        sourceUrl: rawMatch.url,
        family: semantics.statistic,
        playdoitOddsText: catalogLine.line.oddsText,
        editorialPriority: pick.percentage >= 80 ? 'high' : pick.percentage >= 70 ? 'medium' : 'normal',
        commercialPriority: commercialPriority(catalogLine.line.oddsText),
        datafutCard: createDatafutCard({
          sourceUrl: rawMatch.url,
          pick,
          semantics
        })
      });

    }
  }

  return candidates
    .filter(candidate => validateDatafutCard(candidate).valid)
    .sort(compareCandidateQuality)
    .slice(0, limit)
    .map((candidate, index) => ({
      candidateId: `DF-R${String(round).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`,
      ...candidate
    }));
}

module.exports = {
  PERCENTAGE_THRESHOLD_EXCLUSIVE,
  candidateKey,
  compareCandidateQuality,
  discoverCandidates,
  findCatalogLine,
  isTrivialCandidate,
  matchCatalogEntry,
  normalizeTeamName,
  normalizeText,
  parsePrediction
};
