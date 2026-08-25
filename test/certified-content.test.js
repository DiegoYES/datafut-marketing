const assert = require('node:assert/strict');
const {
  buildCertifiedCombinadaData,
  buildCertifiedIndividualData,
  buildCertifiedParlayData,
  validateCertifiedCombinadaDataAgainstContext,
  validateCertifiedIndividualDataAgainstContext,
  validateCertifiedParlayDataAgainstContext
} = require('../scripts/lib/certified-content');

function entry(candidateId, matchId, match, market, percentage, cardId, smoothed) {
  return {
    discovery: {
      candidateId,
      catalogMatchId: matchId,
      match,
      market,
      percentage,
      sample: { home: 10, away: 10 },
      datafutCard: { cardId, smoothedPercentages: smoothed }
    },
    verification: {
      candidateId,
      status: 'AVAILABLE_EXACT',
      evidenceSource: 'live_dom',
      percentage,
      datafutCardId: cardId,
      playdoit: { oddsText: '-150' }
    }
  };
}

const ids = ['DF-001', 'DF-002'];
const optionId = 'PAR-DF-001-DF-002';
const context = {
  catalog: {
    generatedAt: '2026-08-25T00:50:00.000Z',
    targetDate: '2026-08-25',
    matches: [
      { matchId: 'PD-001', homeTeam: 'Monterrey', awayTeam: 'Chicago Fire', league: 'Liga' },
      { matchId: 'PD-002', homeTeam: 'Seoul', awayTeam: 'Bucheon', league: 'Liga' }
    ]
  },
  eligiblePool: {
    generatedAt: '2026-08-25T01:00:00.000Z',
    candidates: [
      entry('DF-001', 'PD-001', 'Monterrey vs Chicago Fire', 'Mas de 2.5 goles', 71.4, 'card-a', [64.3, 78.6]),
      entry('DF-002', 'PD-002', 'Seoul vs Bucheon', 'Menos de 9.5 corners', 74.2, 'card-b', [71.4, 76.9]),
      entry('DF-003', 'PD-001', 'Monterrey vs Chicago Fire', 'Menos de 10.5 corners', 71.4, 'card-c', [64.3, 78.6])
    ]
  },
  formatOptions: {
    routes: {
      individual: {
        options: [{
          optionId: 'IND-DF-001',
          status: 'READY_FOR_USER_SELECTION',
          candidate: { candidateId: 'DF-001' }
        }]
      },
      parlay: {
        options: [{
          optionId,
          candidateIds: ids,
          status: 'READY_FOR_USER_SELECTION',
          quoteMethod: 'betslip_dom_read',
          combinedOdds: '+180'
        }]
      },
      combinada: {
        options: [{
          optionId: 'COM-DF-001-DF-003',
          candidateIds: ['DF-001', 'DF-003'],
          status: 'READY_FOR_USER_SELECTION',
          compatibility: 'COMPATIBLE',
          quoteMethod: 'betslip_dom_read',
          betslipEvidence: 'live_dom',
          combinedOdds: '+220',
          domEvidence: { source: 'live_dom' }
        }]
      }
    }
  },
  parlayOptions: {
    generatedAt: '2026-08-25T01:10:00.000Z',
    verificationGeneratedAt: '2026-08-25T01:05:00.000Z',
    publishable: true,
    finalists: [{
      candidateIds: ids,
      combinedOddsText: '+180',
      quoteMethod: 'betslip_dom_read',
      betslipEvidence: 'live_dom'
    }]
  }
};

const valid = buildCertifiedParlayData(
  context,
  optionId,
  '2026-08-25',
  '2026-08-25T01:20:00.000Z'
);
assert.deepEqual(validateCertifiedParlayDataAgainstContext(valid, context).errors, []);

const forgedPercentage = structuredClone(valid);
forgedPercentage.picks[0].percentage = 74.2;
assert.match(
  validateCertifiedParlayDataAgainstContext(forgedPercentage, context).errors.join('\n'),
  /no coinciden exactamente|certificationHash/
);

const forgedMarket = structuredClone(valid);
forgedMarket.picks[0].market = 'Mas de 3.5 goles';
assert.match(
  validateCertifiedParlayDataAgainstContext(forgedMarket, context).errors.join('\n'),
  /no coinciden exactamente/
);

const borrowedCard = structuredClone(valid);
borrowedCard.picks[0].datafutCardId = 'card-b';
assert.match(
  validateCertifiedParlayDataAgainstContext(borrowedCard, context).errors.join('\n'),
  /no coinciden exactamente/
);

const manual = structuredClone(valid);
delete manual.provenance;
assert.match(
  validateCertifiedParlayDataAgainstContext(manual, context).errors.join('\n'),
  /provenance/
);

const individual = buildCertifiedIndividualData(
  context,
  'IND-DF-001',
  '2026-08-25',
  '2026-08-25T01:30:00.000Z'
);
assert.deepEqual(validateCertifiedIndividualDataAgainstContext(individual, context).errors, []);
const forgedIndividual = structuredClone(individual);
forgedIndividual.percentage = 74.2;
assert.match(
  validateCertifiedIndividualDataAgainstContext(forgedIndividual, context).errors.join('\n'),
  /no coincide exactamente|certificationHash/
);

assert.throws(
  () => buildCertifiedParlayData(context, optionId, '2026-08-26'),
  /no coincide con el Catalog/
);

const combinada = buildCertifiedCombinadaData(
  context,
  'COM-DF-001-DF-003',
  '2026-08-25',
  '2026-08-25T01:40:00.000Z'
);
assert.deepEqual(validateCertifiedCombinadaDataAgainstContext(combinada, context).errors, []);
const forgedCombinada = structuredClone(combinada);
forgedCombinada.selections[1].market = 'Menos de 9.5 corners';
assert.match(
  validateCertifiedCombinadaDataAgainstContext(forgedCombinada, context).errors.join('\n'),
  /no coincide exactamente|certificationHash/
);

console.log('certified-content.test.js: OK (individual, parlay y combinada bloquean datos manuales).');
