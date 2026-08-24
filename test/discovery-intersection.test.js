const assert = require('node:assert/strict');
const {
  discoverCandidates,
  isTrivialCandidate,
  matchCatalogEntry,
  parsePrediction
} = require('../scripts/lib/discovery');

const catalog = {
  generatedAt: '2026-08-22T01:25:16.648Z',
  catalogStatus: 'VERIFIED',
  evidenceSource: 'live_dom',
  matches: [{
    matchId: 'PD-LIVE-17175292',
    homeTeam: 'San Diego Wave FC (F)',
    awayTeam: 'Utah Royals FC (F)',
    league: 'National Soccer League Fem',
    markets: [{
      marketText: 'Total',
      statistic: 'goals',
      scope: 'match',
      period: 'full_time',
      directions: [
        { direction: 'over', lines: [{ line: 1.5, oddsText: '-450' }, { line: 2.5, oddsText: '-125' }] },
        { direction: 'under', lines: [{ line: 2.5, oddsText: '-118' }, { line: 3.5, oddsText: '-300' }] }
      ]
    }]
  }]
};

const rawMatches = [{
  title: 'San Diego Wave W vs Utah Royals W · Match Center',
  url: 'https://data-fut.com/partido.html?partido=1508513',
  picks: [
    {
      rawTitle: 'Más de 1.5 goles',
      percentage: 70,
      sampleLine: 'mediamuestra 10 · 2/2 fuentes',
      evidenceText: ['Fuente local cumplió 7/10 veces; con suavizado: 70%. Fuente visitante cumplió 8/10 veces; con suavizado: 70%.'],
      fullSnippet: 'Más de 1.5 goles 70% mediamuestra 10 · 2/2 fuentes Fuente local cumplió 7/10 veces; con suavizado: 70%. Fuente visitante cumplió 8/10 veces; con suavizado: 70%.'
    },
    {
      rawTitle: 'Menos de 3.5 goles',
      percentage: 71.4,
      sampleLine: 'mediamuestra 10 · 2/2 fuentes',
      evidenceText: ['Fuente local cumplió 9/10 veces; con suavizado: 71.4%. Fuente visitante cumplió 7/10 veces; con suavizado: 71.4%.'],
      fullSnippet: 'Menos de 3.5 goles 71.4% mediamuestra 10 · 2/2 fuentes Fuente local cumplió 9/10 veces; con suavizado: 71.4%. Fuente visitante cumplió 7/10 veces; con suavizado: 71.4%.'
    },
    {
      rawTitle: 'Más de 2.5 goles',
      percentage: 70.1,
      sampleLine: 'mediamuestra 8 · 2/2 fuentes',
      evidenceText: ['Fuente local cumplió 6/8 veces; con suavizado: 70%. Fuente visitante cumplió 6/8 veces; con suavizado: 70.2%.'],
      fullSnippet: 'Más de 2.5 goles 70.1% mediamuestra 8 · 2/2 fuentes Fuente local cumplió 6/8 veces; con suavizado: 70%. Fuente visitante cumplió 6/8 veces; con suavizado: 70.2%.'
    },
    { rawTitle: 'Más de 0.5 goles', percentage: 82.1, evidenceText: [] },
    { rawTitle: 'Menos de 11.5 córners totales', percentage: 71.4, evidenceText: [] },
    { rawTitle: 'Más de 2.5 goles', percentage: 60, evidenceText: [] }
  ]
}, {
  title: 'San Diego Wave W vs Utah Royals W · Match Center',
  url: 'https://data-fut.com/partido.html?partido=1508513&fecha=2026-08-21',
  picks: [{
    rawTitle: 'Menos de 3.5 goles',
    percentage: 71.4,
    sampleLine: 'mediamuestra 10 · 2/2 fuentes',
    evidenceText: ['Fuente local cumplió 9/10 veces; con suavizado: 71.4%. Fuente visitante cumplió 7/10 veces; con suavizado: 71.4%.'],
    fullSnippet: 'Menos de 3.5 goles 71.4% mediamuestra 10 · 2/2 fuentes Fuente local cumplió 9/10 veces; con suavizado: 71.4%. Fuente visitante cumplió 7/10 veces; con suavizado: 71.4%.'
  }]
}];

assert.equal(matchCatalogEntry(catalog, rawMatches[0].title).matchId, 'PD-LIVE-17175292');
assert.deepEqual(parsePrediction('Menos de 3.5 goles', catalog.matches[0]), {
  statistic: 'goals',
  scope: 'match',
  subject: 'San Diego Wave FC (F) vs Utah Royals FC (F)',
  direction: 'under',
  line: 3.5,
  period: 'full_time'
});

const candidates = discoverCandidates(catalog, rawMatches);
assert.equal(candidates.length, 2);
assert.deepEqual(candidates.map(candidate => candidate.market), [
  'Menos de 3.5 goles',
  'Más de 2.5 goles'
]);
assert.deepEqual(candidates[0].sample, { home: 10, away: 10 });
assert.equal(candidates[0].playdoitOddsText, '-300');
assert.equal(candidates.some(candidate => candidate.line === 0.5), false);
assert.equal(candidates.some(candidate => candidate.percentage <= 70), false);
assert.equal(candidates.some(candidate => candidate.statistic === 'corners'), false);
assert.equal(candidates.every(candidate => candidate.candidateKey), true);
assert.deepEqual(candidates.map(candidate => candidate.candidateId), ['DF-R01-001', 'DF-R01-002']);

const replacement = discoverCandidates(catalog, rawMatches, {
  round: 2,
  limit: 10,
  excludedKeys: [candidates[0].candidateKey]
});
assert.equal(replacement.length, 1);
assert.equal(replacement[0].candidateId, 'DF-R02-001');
assert.equal(replacement[0].candidateKey, candidates[1].candidateKey);

assert.equal(isTrivialCandidate({ direction: 'over', statistic: 'goals', line: 0.5 }), true);
assert.equal(isTrivialCandidate({ direction: 'over', statistic: 'shots', line: 2.5 }), true);
assert.equal(isTrivialCandidate({ direction: 'over', statistic: 'shots_on_target', line: 1.5 }), true);
assert.equal(isTrivialCandidate({ direction: 'over', statistic: 'corners', line: 1.5 }), true);
assert.equal(isTrivialCandidate({ direction: 'over', statistic: 'yellow_cards', line: 0.5 }), true);
assert.equal(isTrivialCandidate({ direction: 'over', statistic: 'fouls', line: 2.5 }), true);
assert.equal(isTrivialCandidate({ direction: 'under', statistic: 'goals', line: 0.5 }), false);

console.log('OK: Discovery cruza partido, mercado, direccion y linea exactos sin duplicados.');
