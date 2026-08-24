const fs = require('node:fs');
const path = require('node:path');
const { readJson } = require('./lib/validation');

const projectDir = path.resolve(__dirname, '..');
const pipelineDir = path.join(projectDir, 'pipeline-state');

function decimalToAmerican(decimal) {
  if (!Number.isFinite(decimal) || decimal <= 1) return null;
  return decimal >= 2
    ? `+${Math.round((decimal - 1) * 100)}`
    : `-${Math.round(100 / (decimal - 1))}`;
}

function combinations(items, size) {
  const result = [];
  function visit(start, current) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      current.push(items[index]);
      visit(index + 1, current);
      current.pop();
    }
  }
  visit(0, []);
  return result;
}

const verified = readJson(path.join(pipelineDir, 'verified-candidates.json'));
const discovery = readJson(path.join(pipelineDir, 'discovery-candidates.json'));
const discoveryById = new Map((discovery.candidates || []).map(item => [item.candidateId, item]));

const eligible = (verified.results || [])
  .filter(item => item.status === 'AVAILABLE_EXACT' && item.editorialEligible === true && Number(item.percentage) > 70)
  .map(item => {
    const source = discoveryById.get(item.candidateId) || {};
    return {
      candidateId: item.candidateId,
      datafutCardId: item.datafutCardId,
      match: item.requested?.match,
      market: item.requested?.market,
      family: source.family || item.requested?.statistic,
      percentage: Number(item.percentage),
      sample: source.sample,
      individualOdds: item.playdoit?.oddsText,
      priceDecimal: Number(item.playdoit?.priceDecimal)
    };
  });

const estimated = [...combinations(eligible, 2), ...combinations(eligible, 3)]
  .filter(combo => new Set(combo.map(item => item.match)).size === combo.length)
  .map((combo, index) => {
    const combinedDecimal = combo.reduce((value, item) => value * item.priceDecimal, 1);
    return {
      estimateId: `EST-${String(index + 1).padStart(3, '0')}`,
      type: combo.length === 2 ? 'doble' : 'triple',
      candidateIds: combo.map(item => item.candidateId),
      combinedOddsDecimalEstimated: Number(combinedDecimal.toFixed(4)),
      combinedOddsAmericanEstimated: decimalToAmerican(combinedDecimal),
      quoteMethod: 'calculated_from_individual_odds',
      publishable: false,
      selections: combo
    };
  });

const generatedAt = new Date().toISOString();
const estimateOutput = {
  generatedAt,
  verificationGeneratedAt: verified.verifiedAt,
  status: 'ESTIMATE_ONLY',
  publishable: false,
  quoteMethod: 'calculated_from_individual_odds',
  integrityNotice: 'Estas combinaciones no fueron leidas del DOM del betslip y no son finalistas oficiales.',
  combinations: estimated
};
fs.writeFileSync(
  path.join(pipelineDir, 'parlay-options-estimated.json'),
  `${JSON.stringify(estimateOutput, null, 2)}\n`
);

const officialOutput = {
  generatedAt,
  verificationGeneratedAt: verified.verifiedAt,
  status: 'BETSLIP_DOM_REQUIRED',
  publishable: false,
  quoteMethod: 'not_observed',
  eligibleCount: eligible.length,
  finalists: [],
  integrityNotice: 'El Builder oficial queda bloqueado hasta leer filas y momio combinado del DOM real y guardar una captura PNG autentica.'
};
fs.writeFileSync(
  path.join(pipelineDir, 'parlay-options.json'),
  `${JSON.stringify(officialOutput, null, 2)}\n`
);

console.error(
  `[BETSLIP DOM REQUIRED] Se guardaron ${estimated.length} estimaciones no publicables; no se generaron finalistas oficiales.`
);
process.exitCode = 1;
