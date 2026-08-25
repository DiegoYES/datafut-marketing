const assert = require('node:assert/strict');
const {
  buildDatafutRawFromObservation,
  validateDatafutDomObservation
} = require('../scripts/lib/datafut-dom-observation');
const { discoverCandidates, parsePrediction } = require('../scripts/lib/discovery');

const catalog = {
  generatedAt: '2026-08-24T22:28:52.159Z',
  targetDate: '2026-08-24',
  matches: [{
    matchId: 'PD-DOM-001', homeTeam: 'Everton', awayTeam: 'U. de Concepcion', league: 'Liga de Primera',
    markets: [{
      marketText: 'U. de Concepcion Remates Totales', subject: 'U. de Concepcion',
      statistic: 'shots', scope: 'team', period: 'full_time',
      directions: [{ direction: 'over', lines: [{ line: 8.5, oddsText: '-225' }] }]
    }]
  }]
};
const evidence = [
  'Fuente local: 8/10 veces; con suavizado: 71.4%. Fuente visitante: 8/9 veces; con suavizado: 76.9%.'
];
const card = {
  rawTitle: 'Mas de 8.5 tiros del visitante', displayedPercentage: 74.2,
  sampleLine: 'muestra 9 · 2/2 fuentes', evidenceText: evidence,
  dialogText: `Mas de 8.5 tiros del visitante ${evidence[0]}`,
  fullSnippet: `Mas de 8.5 tiros del visitante 74.2% muestra 9 · 2/2 fuentes ${evidence[0]}`,
  screenshot: { path: 'captures/dom/datafut.png', sha256: 'c'.repeat(64) }
};
const observation = {
  schemaVersion: 1, captureType: 'datafut_discovery', source: 'authenticated_chrome_dom',
  observedAt: '2026-08-24T22:50:00.000Z', targetDate: catalog.targetDate,
  catalogGeneratedAt: catalog.generatedAt,
  matches: [{
    catalogMatchId: 'PD-DOM-001',
    url: 'https://data-fut.com/partido.html?partido=1505501',
    title: 'Everton de Vina vs Universidad de Concepcion', cards: [card]
  }]
};

const validation = validateDatafutDomObservation(catalog, observation, { validateArtifact: () => true });
assert.equal(validation.valid, true, validation.errors.join('\n'));
const raw = buildDatafutRawFromObservation(catalog, observation);
const candidates = discoverCandidates(catalog, raw.matches, { limit: 20, round: 1 });
assert.equal(candidates.length, 1);
assert.equal(candidates[0].percentage, 74.2);
assert.equal(candidates[0].scope, 'team');
assert.equal(candidates[0].subject, 'U. de Concepcion');

const forged = structuredClone(observation);
forged.matches[0].cards[0].displayedPercentage = 78.6;
forged.matches[0].cards[0].fullSnippet = forged.matches[0].cards[0].fullSnippet.replace('74.2%', '78.6%');
const forgedValidation = validateDatafutDomObservation(catalog, forged, { validateArtifact: () => true });
assert.equal(forgedValidation.valid, false);
assert.match(forgedValidation.errors.join('\n'), /promedian 74.2/);
assert.equal(parsePrediction('Menos de 0.5 tarjetas rojas del visitante', catalog.matches[0]), null);
assert.equal(parsePrediction('Mas de 3.5 tarjetas registradas totales', catalog.matches[0]).statistic, 'registered_cards');

console.log('datafut-dom-observation.test.js: OK (Chrome autenticado conserva tarjeta, promedio y alcance).');
