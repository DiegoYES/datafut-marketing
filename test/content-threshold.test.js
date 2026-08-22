const assert = require('node:assert/strict');
const { validateParlayData } = require('../scripts/lib/validation');

function pick(percentage) {
  return {
    league: 'Liga',
    homeTeam: 'Local',
    awayTeam: 'Visitante',
    market: 'Menos de 3.5 goles',
    percentage,
    sampleText: '10+10',
    evidence: [
      { label: 'Local', value: '8/10', detail: 'Detalle local' },
      { label: 'Visitante', value: '7/10', detail: 'Detalle visitante' }
    ]
  };
}

function input(percentages) {
  return {
    format: 'parlay-de-datos',
    date: '2026-08-22',
    title: 'Titulo',
    subtitle: 'Subtitulo',
    ctaTitle: 'CTA',
    ctaText: 'Texto',
    probabilityNotice: 'Porcentajes individuales.',
    disclaimer: 'Consulta responsable.',
    musicPreset: 'analysis',
    picks: percentages.map(pick)
  };
}

assert.deepEqual(validateParlayData(input([70.1, 71])).errors, []);
assert.deepEqual(validateParlayData(input([70.1, 71, 80])).errors, []);
assert.equal(
  validateParlayData(input([70, 71])).errors.some(error => error.includes('mayor de 70')),
  true
);

console.log('content-threshold.test.js: OK (dobles y triples >70).');
