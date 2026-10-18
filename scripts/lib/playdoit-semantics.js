const TEAM_NOISE = new Set([
  'ac', 'atletico', 'club', 'de', 'del', 'deportivo', 'deportes', 'el', 'fc',
  'la', 'las', 'los', 'mg', 'sc', 'sjdr', 'sp', 'univ', 'universidad'
]);

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ª/g, 'a')
    .replace(/º/g, 'o')
    .replace(/\b1\s*(?:a|er)\s*(?:mitad|tiempo)\b/g, ' primera mitad ')
    .replace(/\b2\s*(?:a|do)\s*(?:mitad|tiempo)\b/g, ' segunda mitad ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokens(value) {
  return normalizeText(value).split(' ').filter(Boolean);
}

function inferPeriod(marketText) {
  const normalized = normalizeText(marketText);
  if (/\b(?:primera mitad|primer tiempo|1st half)\b/.test(normalized)) return 'first_half';
  if (/\b(?:segunda mitad|segundo tiempo|2nd half)\b/.test(normalized)) return 'second_half';
  return 'full_time';
}

function inferStatistic(marketText) {
  const normalized = normalizeText(marketText);
  if (/\b(?:roja|rojas|red card|red cards)\b/.test(normalized)) return null;
  if (/\b(?:tarjeta|tarjetas)\b/.test(normalized)) return 'yellow_cards';
  if (/\b(?:corner|corners)\b/.test(normalized) || normalized.includes('tiros de esquina')) return 'corners';
  if (/\b(?:falta|faltas)\b/.test(normalized)) return 'fouls';
  if (normalized.includes('tiros a puerta') || normalized.includes('tiro a puerta') || normalized.includes('remates a puerta') || normalized.includes('remate a puerta') || normalized.includes('tiros al arco') || normalized.includes('remates al arco')) {
    return 'shots_on_target';
  }
  if (/\b(?:tiro|tiros|remate|remates)\b/.test(normalized)) return 'shots';
  if (normalized === 'total' || /\b(?:gol|goles)\b/.test(normalized)) return 'goals';
  return null;
}

function teamScore(marketText, teamName, opponentName) {
  const market = normalizeText(marketText);
  const team = normalizeText(teamName);
  if (!market || !team) return 0;
  if (` ${market} `.includes(` ${team} `)) return 100;

  const opponent = new Set(tokens(opponentName));
  const distinctive = tokens(team).filter(token =>
    token.length >= 5 && !TEAM_NOISE.has(token) && !opponent.has(token)
  );
  const hits = distinctive.filter(token => new RegExp(`\\b${token}\\b`).test(market));
  return hits.length;
}

function isExplicitMatchMarket(marketText, statistic) {
  let normalized = normalizeText(marketText)
    .replace(/^(?:primera|segunda) mitad /, '')
    .replace(/^(?:primer|segundo) tiempo /, '')
    .trim();

  const patterns = {
    goals: /^(?:total|goles totales|total de goles)$/,
    yellow_cards: /^(?:total de tarjetas|tarjetas totales|total tarjetas)$/,
    corners: /^(?:total de corners|corners totales|total corners|total tiros de esquina)$/,
    shots: /^(?:total de tiros|tiros totales|total de remates|remates totales)$/,
    shots_on_target: /^(?:total de tiros a puerta|tiros a puerta totales|total de remates a puerta|remates a puerta totales)$/,
    fouls: /^(?:total de faltas|total de faltas cometidas|faltas totales)$/
  };
  return Boolean(patterns[statistic] && patterns[statistic].test(normalized));
}

function classifyMarket(marketText, homeTeam, awayTeam) {
  const statistic = inferStatistic(marketText);
  const period = inferPeriod(marketText);
  if (!statistic) return { valid: false, reason: 'STATISTIC_UNKNOWN', marketText };

  const homeScore = teamScore(marketText, homeTeam, awayTeam);
  const awayScore = teamScore(marketText, awayTeam, homeTeam);
  if (homeScore > 0 && awayScore > 0 && homeScore === awayScore) {
    const homeNorm = normalizeText(homeTeam);
    const awayNorm = normalizeText(awayTeam);
    const homeContainsAway = homeNorm.length > awayNorm.length && homeNorm.includes(awayNorm);
    const awayContainsHome = awayNorm.length > homeNorm.length && awayNorm.includes(homeNorm);
    if (homeContainsAway) {
      return { valid: true, subject: homeTeam, statistic, scope: 'team', period };
    }
    if (awayContainsHome) {
      return { valid: true, subject: awayTeam, statistic, scope: 'team', period };
    }
    return { valid: false, reason: 'SUBJECT_AMBIGUOUS', statistic, period, marketText };
  }
  if (homeScore > awayScore) {
    return { valid: true, subject: homeTeam, statistic, scope: 'team', period };
  }
  if (awayScore > homeScore) {
    return { valid: true, subject: awayTeam, statistic, scope: 'team', period };
  }
  if (isExplicitMatchMarket(marketText, statistic)) {
    return { valid: true, subject: `${homeTeam} vs ${awayTeam}`, statistic, scope: 'match', period };
  }
  return { valid: false, reason: 'SCOPE_UNKNOWN', statistic, period, marketText };
}

function parseSelection(selectionText) {
  const normalized = normalizeText(selectionText);
  let direction = null;
  if (/^(?:mas de|over)\b/.test(normalized)) direction = 'over';
  if (/^(?:menos de|under)\b/.test(normalized)) direction = 'under';
  const lineMatch = String(selectionText || '').replace(',', '.').match(/\d+(?:\.\d+)?/);
  const line = lineMatch ? Number(lineMatch[0]) : NaN;
  return { valid: Boolean(direction) && Number.isFinite(line), direction, line };
}

function sameText(a, b) {
  return normalizeText(a) === normalizeText(b);
}

module.exports = {
  classifyMarket,
  inferPeriod,
  inferStatistic,
  normalizeText,
  parseSelection,
  sameText
};
