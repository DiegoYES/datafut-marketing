const assert = require('node:assert/strict');
const {
  buildCatalogFromObservation,
  buildVerificationFromObservation,
  validateCatalogObservation,
  validateVerificationObservation
} = require('../scripts/lib/dom-observation-import');

const selectorConfig = {
  selectors: {
    marketContainer: ['[class^="EventDetailsMarketBoxRoot-"]'],
    selection: ['[class^="EventDetailsMarketBoxRoot-"] button[class^="OddBoxButton-"]']
  }
};

const screenshot = {
  path: 'captures/evidence/test.png',
  sha256: 'a'.repeat(64)
};

const catalogObservation = {
  schemaVersion: 1,
  captureType: 'playdoit_catalog',
  source: 'live_dom',
  observedAt: '2026-08-24T22:30:00.000Z',
  targetDate: '2026-08-24',
  navigationMode: 'chrome_extension',
  events: [{
    observedAt: '2026-08-24T22:29:00.000Z',
    url: 'https://www.playdoit.mx/#page=event&eventId=16335537&sportId=66',
    eventId: '16335537',
    homeTeam: 'Everton',
    awayTeam: 'U. de Concepcion',
    eventText: 'Everton vs U. de Concepcion',
    league: 'Liga de Primera',
    visible: true,
    rawText: 'Everton vs U. de Concepcion Total de tarjetas U. de Concepcion Mas de 3.5 +120 Menos de 3.5 -189',
    selectors: {
      marketContainer: selectorConfig.selectors.marketContainer[0],
      selection: selectorConfig.selectors.selection[0]
    },
    screenshot,
    markets: [{
      marketText: 'Total de tarjetas U. de Concepcion',
      rawText: 'Total de tarjetas U. de Concepcion Mas de 3.5 +120 Menos de 3.5 -189',
      selections: [
        { selectionText: 'Mas de 3.5', oddsText: '+120' },
        { selectionText: 'Menos de 3.5', oddsText: '-189' }
      ]
    }]
  }]
};

const catalogValidation = validateCatalogObservation(catalogObservation, {
  selectorConfig,
  validateArtifact: () => true
});
assert.equal(catalogValidation.valid, true, catalogValidation.errors.join('\n'));

const catalog = buildCatalogFromObservation(catalogObservation);
assert.equal(catalog.catalogStatus, 'VERIFIED');
assert.equal(catalog.evidenceSource, 'live_dom');
assert.equal(catalog.matches[0].markets[0].scope, 'team');
assert.equal(catalog.matches[0].markets[0].subject, 'U. de Concepcion');

const candidate = {
  candidateId: 'DF-R01-001',
  catalogMatchId: catalog.matches[0].matchId,
  match: 'Everton vs U. de Concepcion',
  subject: 'U. de Concepcion',
  statistic: 'yellow_cards',
  scope: 'team',
  direction: 'over',
  line: 3.5,
  period: 'full_time',
  market: 'Mas de 3.5 tarjetas del visitante',
  percentage: 74.2,
  datafutCard: { cardId: 'card-test' }
};
const discovery = {
  generatedAt: '2026-08-24T22:31:00.000Z',
  candidates: [candidate]
};
const candidateObservation = {
  candidateId: candidate.candidateId,
  observedAt: '2026-08-24T22:32:00.000Z',
  url: catalog.matches[0].eventUrl,
  homeTeam: 'Everton',
  awayTeam: 'U. de Concepcion',
  eventText: candidate.match,
  marketText: 'Total de tarjetas U. de Concepcion',
  selectionText: 'Mas de 3.5',
  oddsText: '+120',
  visible: true,
  rawText: 'Total de tarjetas U. de Concepcion Mas de 3.5 +120 Menos de 3.5 -189',
  screenshot,
  betslip: {
    observedAt: '2026-08-24T22:32:05.000Z',
    eventText: candidate.match,
    marketText: 'Total de tarjetas U. de Concepcion',
    selectionText: 'Mas de 3.5',
    oddsText: '+120',
    rawText: 'Everton vs U. de Concepcion Total de tarjetas U. de Concepcion Mas de 3.5 +120',
    selectionCount: 1,
    cleanupEmpty: true,
    cleanupObservedAt: '2026-08-24T22:32:10.000Z'
  }
};
const verificationObservation = {
  schemaVersion: 1,
  captureType: 'playdoit_verification',
  source: 'live_dom',
  observedAt: '2026-08-24T22:33:00.000Z',
  navigationMode: 'chrome_extension',
  catalogGeneratedAt: catalog.generatedAt,
  discoveryGeneratedAt: discovery.generatedAt,
  candidateObservations: [candidateObservation]
};

const verificationValidation = validateVerificationObservation(
  catalog,
  discovery,
  verificationObservation,
  { validateArtifact: () => true }
);
assert.equal(verificationValidation.valid, true, verificationValidation.errors.join('\n'));

const verification = buildVerificationFromObservation(catalog, discovery, verificationObservation, {
  selectorConfig,
  validateArtifact: () => true
});
assert.equal(verification.totalEligible, 1);
assert.equal(verification.results[0].status, 'AVAILABLE_EXACT');

const scopeMismatchObservation = structuredClone(verificationObservation);
scopeMismatchObservation.candidateObservations[0].marketText = 'Total de tarjetas';
scopeMismatchObservation.candidateObservations[0].rawText = 'Total de tarjetas Mas de 3.5 +120';
scopeMismatchObservation.candidateObservations[0].betslip.marketText = 'Total de tarjetas';
scopeMismatchObservation.candidateObservations[0].betslip.rawText =
  'Everton vs U. de Concepcion Total de tarjetas Mas de 3.5 +120';
const rejected = buildVerificationFromObservation(catalog, discovery, scopeMismatchObservation, {
  selectorConfig,
  validateArtifact: () => true
});
assert.equal(rejected.totalEligible, 0);
assert.equal(rejected.results[0].status, 'NOT_VERIFIED');
assert.match(rejected.results[0].reason, /scope|subject|alcance/i);

console.log('dom-observation-import.test.js: OK (Catalog y Verification solo promueven evidencia DOM acotada).');
