const assert = require('assert');
const { buildFormatOptions } = require('../scripts/lib/format-options');

function candidate(candidateId, catalogMatchId, match, percentage = 70) {
  return {
    candidateId,
    catalogMatchId,
    match,
    market: `Mercado ${candidateId}`,
    percentage,
    sample: { home: 10, away: 10 },
    playdoitOddsText: '-110'
  };
}

function result(candidateId, match, percentage = 70) {
  return {
    candidateId,
    percentage,
    status: 'AVAILABLE_EXACT',
    editorialEligible: true,
    requested: { match },
    playdoit: { oddsText: '-110' }
  };
}

const discovery = {
  generatedAt: 'discovery-1',
  candidates: [
    candidate('A', 'MATCH-1', 'Uno vs Dos'),
    candidate('B', 'MATCH-1', 'Uno vs Dos')
  ]
};
const verification = {
  verifiedAt: 'verification-1',
  results: [result('A', 'Uno vs Dos'), result('B', 'Uno vs Dos')]
};

const sameMatch = buildFormatOptions(discovery, verification, 'now');
assert.strictEqual(sameMatch.routes.individual.options.length, 2);
assert.strictEqual(sameMatch.routes.parlay.options.length, 0);
assert.strictEqual(sameMatch.routes.parlay.status, 'INSUFFICIENT_DISTINCT_MATCHES');
assert.strictEqual(sameMatch.routes.combinada.options.length, 1);
assert.strictEqual(sameMatch.routes.combinada.options[0].compatibility, 'NOT_CHECKED');
assert.strictEqual(sameMatch.publishable, false);

const crossMatchDiscovery = {
  generatedAt: 'discovery-2',
  candidates: [
    candidate('A', 'MATCH-1', 'Uno vs Dos'),
    candidate('C', 'MATCH-2', 'Tres vs Cuatro')
  ]
};
const crossMatchVerification = {
  verifiedAt: 'verification-2',
  results: [result('A', 'Uno vs Dos'), result('C', 'Tres vs Cuatro')]
};
const crossMatch = buildFormatOptions(crossMatchDiscovery, crossMatchVerification, 'now');
assert.strictEqual(crossMatch.routes.parlay.options.length, 1);
assert.strictEqual(crossMatch.routes.parlay.options[0].status, 'REQUIRES_BETSLIP_QUOTE');
assert.strictEqual(crossMatch.routes.combinada.options.length, 0);

console.log('format-options.test.js: OK');
