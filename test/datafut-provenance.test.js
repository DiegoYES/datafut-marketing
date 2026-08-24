const assert = require('node:assert/strict');
const {
  createDatafutCard,
  validateDatafutCard
} = require('../scripts/lib/datafut-provenance');

const sourceUrl = 'https://data-fut.com/partido.html?partido=1492340';
const totalSemantics = {
  subject: 'Botafogo vs Athlético Paranaense',
  statistic: 'shots_on_target',
  scope: 'match',
  direction: 'over',
  line: 5.5,
  period: 'full_time'
};
const totalPick = {
  rawTitle: 'Más de 5.5 tiros a puerta totales',
  percentage: 78.6,
  evidenceText: [
    'Fuente local con suavizado: 85.7%. Fuente visitante con suavizado: 71.4%.'
  ],
  fullSnippet: 'Más de 5.5 tiros a puerta totales 78.6% mediamuestra 10 · 2/2 fuentes Fuente local con suavizado: 85.7%. Fuente visitante con suavizado: 71.4%.'
};
const totalCandidate = {
  ...totalSemantics,
  market: totalPick.rawTitle,
  percentage: totalPick.percentage,
  evidence: totalPick.evidenceText,
  sourceUrl
};
totalCandidate.datafutCard = createDatafutCard({ sourceUrl, pick: totalPick, semantics: totalSemantics });
assert.equal(validateDatafutCard(totalCandidate).valid, true);

const localSemantics = {
  subject: 'Botafogo',
  statistic: 'shots_on_target',
  scope: 'team',
  direction: 'over',
  line: 3.5,
  period: 'full_time'
};
const wronglyCrossed = {
  ...localSemantics,
  market: 'Más de 3.5 tiros a puerta del local',
  percentage: 78.6,
  evidence: totalPick.evidenceText,
  sourceUrl,
  datafutCard: totalCandidate.datafutCard
};
assert.equal(validateDatafutCard(wronglyCrossed).valid, false);

const componentMistakenForFinal = {
  rawTitle: 'Más de 3.5 tiros a puerta del local',
  percentage: 78.6,
  evidenceText: [
    'Fuente local con suavizado: 78.6%. Fuente visitante con suavizado: 50%.'
  ],
  fullSnippet: 'Más de 3.5 tiros a puerta del local 78.6% mediamuestra 10 · 2/2 fuentes Fuente local con suavizado: 78.6%. Fuente visitante con suavizado: 50%.'
};
const badLocalCandidate = {
  ...localSemantics,
  market: componentMistakenForFinal.rawTitle,
  percentage: componentMistakenForFinal.percentage,
  evidence: componentMistakenForFinal.evidenceText,
  sourceUrl
};
badLocalCandidate.datafutCard = createDatafutCard({
  sourceUrl,
  pick: componentMistakenForFinal,
  semantics: localSemantics
});
const validation = validateDatafutCard(badLocalCandidate);
assert.equal(validation.valid, false);
assert.equal(validation.errors.some(error => error.includes('promedio 64.3%')), true);

console.log('datafut-provenance.test.js: OK (total/local y componente/final no se pueden cruzar).');
