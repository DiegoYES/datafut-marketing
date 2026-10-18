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
assert.equal(output.finalists.length, 1);
assert.deepEqual(output.finalists.map(item => item.type), ['doble']);
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

// Diversificacion OBLIGATORIA: cero repetidos entre finalistas. Aunque haya
// 7 cotizaciones, solo entran las que no compartan picks (doble AB + triple
// CDE); el resto se descarta aunque pase pisos.
const divEligible = [
  eligible('DF-A', 'A1 vs A2', 'Total', 'Mas de 1.5', '-110', 90.0),
  eligible('DF-B', 'B1 vs B2', 'Total', 'Mas de 1.5', '-110', 89.0),
  eligible('DF-C', 'C1 vs C2', 'Total', 'Mas de 1.5', '-110', 88.0),
  eligible('DF-D', 'D1 vs D2', 'Total', 'Mas de 1.5', '-110', 87.0),
  eligible('DF-E', 'E1 vs E2', 'Total', 'Mas de 1.5', '-110', 86.0),
  eligible('DF-F', 'F1 vs F2', 'Total', 'Mas de 1.5', '-110', 85.0)
];
const byId = id => divEligible.find(item => item.verification.candidateId === id);
const divObservation = {
  schemaVersion: 1,
  captureType: 'playdoit_betslip_quotes',
  source: 'live_dom',
  navigationMode: 'chrome_extension',
  observedAt: '2026-08-24T22:45:00.000Z',
  verificationGeneratedAt: '2026-08-24T22:40:00.000Z',
  quotes: [
    quote(['DF-A', 'DF-B'].map(byId), '+500', '50'),
    quote(['DF-A', 'DF-B', 'DF-C'].map(byId), '+600', '51'),
    quote(['DF-A', 'DF-B', 'DF-D'].map(byId), '+590', '52'),
    quote(['DF-A', 'DF-B', 'DF-E'].map(byId), '+580', '53'),
    quote(['DF-C', 'DF-D', 'DF-E'].map(byId), '+400', '54'),
    quote(['DF-C', 'DF-D', 'DF-F'].map(byId), '+390', '55'),
    quote(['DF-D', 'DF-E', 'DF-F'].map(byId), '+370', '56')
  ]
};
const divOutput = buildParlayOptionsFromObservation(divEligible, divObservation, {
  selectorConfig,
  verificationGeneratedAt: divObservation.verificationGeneratedAt
});
assert.equal(divOutput.finalists.length, 2);
const uses = new Map();
divOutput.finalists.forEach(item => item.candidateIds.forEach(id => uses.set(id, (uses.get(id) || 0) + 1)));
assert.ok(Math.max(...uses.values()) <= 1, `usos por pick: ${JSON.stringify([...uses])}`);

console.log('betslip-observation-import.test.js: OK (diversificacion obligatoria sin repetidos).');

// Pisos estrictos: cotizaciones bajo el piso jamas entran, aunque falten
// para completar 5 (dobles bajo -150, triples bajo +100).
const floorEligible = [
  eligible('DF-X1', 'A vs B', 'Total', 'Menos de 3.5', '-200', 80.0),
  eligible('DF-X2', 'C vs D', 'Total', 'Mas de 1.5', '-200', 79.0),
  eligible('DF-X3', 'E vs F', 'Total', 'Mas de 1.5', '-200', 78.0)
];
const floorObservation = {
  schemaVersion: 1,
  captureType: 'playdoit_betslip_quotes',
  source: 'live_dom',
  navigationMode: 'chrome_extension',
  observedAt: '2026-08-24T22:45:00.000Z',
  verificationGeneratedAt: '2026-08-24T22:40:00.000Z',
  quotes: [
    quote(floorEligible.slice(0, 2), '+180', '51'),
    quote(floorEligible, '+420', '52'),
    quote(floorEligible.slice(1, 3), '-300', '53'),
    quote(floorEligible, '-110', '54')
  ]
};
const floorOutput = buildParlayOptionsFromObservation(floorEligible, floorObservation, {
  selectorConfig,
  verificationGeneratedAt: floorObservation.verificationGeneratedAt
});
assert.equal(floorOutput.finalists.length, 1);
assert.ok(floorOutput.finalists.every(item => item.meetsMomioFloor));

console.log('betslip-observation-import.test.js: OK (pisos estrictos sin relleno bajo politica).');
