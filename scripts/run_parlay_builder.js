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
const catalog = readJson(path.join(pipelineDir, 'playdoit-catalog.json'));
const discoveryById = new Map((discovery.candidates || []).map(item => [item.candidateId, item]));
const eligiblePoolPath = path.join(pipelineDir, 'eligible-candidates.json');
const eligiblePool = fs.existsSync(eligiblePoolPath) ? readJson(eligiblePoolPath) : null;

const verifiedRecords = eligiblePool?.catalogGeneratedAt === catalog.generatedAt &&
  Array.isArray(eligiblePool.candidates) && eligiblePool.candidates.length > 0
  ? eligiblePool.candidates.map(item => ({ source: item.discovery, result: item.verification }))
  : (verified.results || []).map(result => ({ source: discoveryById.get(result.candidateId) || {}, result }));

const eligible = verifiedRecords
  .filter(({ result }) => result.status === 'AVAILABLE_EXACT' && result.editorialEligible === true && Number(result.percentage) > 70)
  .map(({ source, result }) => {
    const catalogMatch = (catalog.matches || []).find(match => match.matchId === source.catalogMatchId);
    return {
      candidateId: result.candidateId,
      datafutCardId: result.datafutCardId,
      catalogMatchId: source.catalogMatchId,
      eventUrl: catalogMatch?.eventUrl || null,
      match: result.requested?.match,
      market: result.playdoit?.marketText,
      selection: result.playdoit?.selectionText,
      family: source.family || result.requested?.statistic,
      percentage: Number(result.percentage),
      sample: source.sample,
      individualOdds: result.playdoit?.oddsText,
      priceDecimal: Number(result.playdoit?.priceDecimal),
      commercialPriority: source.commercialPriority || 'unknown'
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
const quoteRequest = {
  generatedAt,
  verificationGeneratedAt: verified.verifiedAt,
  source: 'verified_candidates_only',
  quoteMethodRequired: 'betslip_dom_read',
  forbiddenActions: ['enter_stake', 'login_playdoit', 'place_bet', 'confirm_bet'],
  combinations: estimated.map(item => ({
    requestId: item.estimateId.replace('EST-', 'QUOTE-'),
    type: item.type,
    candidateIds: item.candidateIds,
    selections: item.selections.map(selection => ({
      candidateId: selection.candidateId,
      eventUrl: selection.eventUrl,
      matchText: selection.match,
      marketText: selection.market,
      selectionText: selection.selection,
      oddsTextAtVerification: selection.individualOdds
    }))
  }))
};
fs.writeFileSync(
  path.join(pipelineDir, 'parlay-quote-request.json'),
  `${JSON.stringify(quoteRequest, null, 2)}\n`
);
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
  `[BETSLIP DOM REQUIRED] Se prepararon ${estimated.length} combinaciones para captura; no se generaron finalistas oficiales.`
);
process.exitCode = 1;
