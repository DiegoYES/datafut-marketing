const assert = require('node:assert/strict');
const {
  buildParlayOptionsFromObservation,
  validateBetslipQuoteObservation
} = require('../scripts/lib/betslip-observation-import');

const selectorConfig = {
  selectors: {
    betslipContainer: ['[class^="BetSlipContainer-sc-"]'],
    selectionRow: ['[class^="BetSlipSelectionBoxContainer-"]'],
    combinedOdds: ['[class^="BetSlipHeaderTotalOddsValue-"]']
  }
};

function eligible(candidateId, match, market, selection, odds, percentage) {
  return {
    discovery: {
      candidateId,
      percentage,
      commercialPriority: 'normal',
      sample: { home: 10, away: 10 }
    },
    verification: {
      candidateId,
      requested: { match },
      playdoit: {
        matchText: match,
        marketText: market,
        selectionText: selection,
        oddsText: odds
      },
      status: 'AVAILABLE_EXACT',
      evidenceSource: 'live_dom'
    }
  };
}

const eligibleItems = [
  eligible('DF-001', 'A vs B', 'Total', 'Menos de 3.5', '-200', 75.0),
  eligible('DF-002', 'C vs D', 'Total de tarjetas', 'Mas de 4.5', '-110', 74.0),
  eligible('DF-003', 'E vs F', 'Total Tiros De Esquina', 'Mas de 8.5', '+105', 73.0)
];

function row(item) {
  const value = item.verification.playdoit;
  return {
    candidateId: item.verification.candidateId,
    ...value,
    rawText: `${value.matchText} ${value.marketText} ${value.selectionText} ${value.oddsText}`
  };
}

function quote(items, odds, minute) {
  const selectionRows = items.map(row);
  return {
    candidateIds: items.map(item => item.verification.candidateId),
    observedAt: `2026-08-24T22:${minute}:00.000Z`,
    url: 'https://www.playdoit.mx/#page=sportsbook',
    visible: true,
    combinedOddsText: odds,
    selectionRows,
    rawText: `Parlay ${items.length} ${odds} ${selectionRows.map(item => item.rawText).join(' ')}`,
    screenshot: { path: `captures/evidence/${minute}.png`, sha256: 'b'.repeat(64) },
    cleanup: { empty: true, observedAt: `2026-08-24T22:${minute}:30.000Z` }
  };
}

const observation = {
  schemaVersion: 1,
  captureType: 'playdoit_betslip_quotes',
  source: 'live_dom',
  navigationMode: 'chrome_extension',
  observedAt: '2026-08-24T22:45:00.000Z',
  verificationGeneratedAt: '2026-08-24T22:40:00.000Z',
  quotes: [
    quote(eligibleItems.slice(0, 2), '+180', '41'),
    quote(eligibleItems, '+420', '42')
  ]
};

const validation = validateBetslipQuoteObservation(eligibleItems, observation, {
  selectorConfig,
  validateArtifact: () => true
});
assert.equal(validation.valid, true, validation.errors.join('\n'));

const output = buildParlayOptionsFromObservation(eligibleItems, observation, {
  selectorConfig,
  verificationGeneratedAt: observation.verificationGeneratedAt
});
assert.equal(output.quoteMethod, 'betslip_dom_read');
assert.equal(output.finalists.length, 2);
assert.deepEqual(output.finalists.map(item => item.type), ['doble', 'triple']);
assert.equal('combinedProbability' in output.finalists[0], false);

const wrongScope = structuredClone(observation);
wrongScope.quotes[0].selectionRows[0].marketText = 'Total de tarjetas A';
const rejected = validateBetslipQuoteObservation(eligibleItems, wrongScope, {
  selectorConfig,
  validateArtifact: () => true
});
assert.equal(rejected.valid, false);
assert.match(rejected.errors.join('\n'), /marketText no coincide/);

console.log('betslip-observation-import.test.js: OK (dobles/triples usan cuota DOM y filas exactas).');
