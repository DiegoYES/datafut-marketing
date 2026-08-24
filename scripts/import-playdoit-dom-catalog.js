const fs = require('node:fs');
const path = require('node:path');
const { validateDomSelectorConfig } = require('./lib/dom-selector-config');
const {
  buildCatalogFromObservation,
  readObservation,
  validateCatalogObservation
} = require('./lib/dom-observation-import');
const { validatePngArtifact } = require('./lib/pipeline-audit');
const { readJson } = require('./lib/validation');

const projectDir = path.resolve(__dirname, '..');
const observationArg = process.argv[2];
if (!observationArg) throw new Error('Uso: import-playdoit-dom-catalog.js <observacion.json>');

const selectorConfig = readJson(path.join(projectDir, 'config', 'playdoit-dom.json'));
const selectorValidation = validateDomSelectorConfig(selectorConfig);
if (!selectorValidation.valid) {
  throw new Error(`Selectores DOM no verificados:\n- ${selectorValidation.errors.join('\n- ')}`);
}

const observation = readObservation(projectDir, observationArg);
const validation = validateCatalogObservation(observation.document, {
  selectorConfig,
  validateArtifact: screenshot => validatePngArtifact(projectDir, screenshot)
});
if (!validation.valid) {
  throw new Error(`Observacion DOM de Catalog invalida:\n- ${validation.errors.join('\n- ')}`);
}

const catalog = buildCatalogFromObservation(observation.document, {
  observationPath: observation.relativePath,
  observationSha256: observation.sha256
});
const outputPath = path.join(projectDir, 'pipeline-state', 'playdoit-catalog.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
const invalidatedAt = new Date().toISOString();
[
  path.join(projectDir, 'pipeline-state', 'discovery-candidates.json'),
  path.join(projectDir, 'scripts', 'datafut-live-raw.json')
].forEach(filePath => {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
});
fs.writeFileSync(path.join(projectDir, 'pipeline-state', 'verified-candidates.json'), `${JSON.stringify({
  verifiedAt: invalidatedAt,
  discoveryGeneratedAt: null,
  navigationMode: 'not_started',
  evidenceSource: 'not_observed',
  verificationMethod: 'not_observed',
  totalCandidatesReviewed: 0,
  totalEligible: 0,
  publishable: false,
  integrityNotice: 'Catalog fue renovado; se requiere una nueva ronda de Discovery y Verification.',
  results: []
}, null, 2)}\n`);
fs.writeFileSync(path.join(projectDir, 'pipeline-state', 'eligible-candidates.json'), `${JSON.stringify({
  generatedAt: invalidatedAt,
  catalogGeneratedAt: catalog.generatedAt,
  eligibleCount: 0,
  status: 'AWAITING_DISCOVERY',
  candidates: []
}, null, 2)}\n`);
fs.writeFileSync(path.join(projectDir, 'pipeline-state', 'replenishment-state.json'), `${JSON.stringify({
  updatedAt: invalidatedAt,
  catalogGeneratedAt: catalog.generatedAt,
  status: 'AWAITING_DISCOVERY',
  eligibleCount: 0,
  evaluatedKeys: [],
  eligible: [],
  rounds: []
}, null, 2)}\n`);
fs.writeFileSync(path.join(projectDir, 'pipeline-state', 'format-options.json'), `${JSON.stringify({
  generatedAt: invalidatedAt,
  eligiblePoolGeneratedAt: invalidatedAt,
  userSelectionRequired: true,
  publishable: false,
  status: 'AWAITING_DISCOVERY',
  routes: {
    individual: { options: [] },
    parlay: { options: [] },
    combinada: { options: [] }
  }
}, null, 2)}\n`);
fs.writeFileSync(path.join(projectDir, 'pipeline-state', 'parlay-options.json'), `${JSON.stringify({
  generatedAt: invalidatedAt,
  verificationGeneratedAt: null,
  status: 'AWAITING_VERIFICATION',
  publishable: false,
  quoteMethod: 'not_observed',
  eligibleCount: 0,
  finalists: [],
  integrityNotice: 'Catalog fue renovado; las cotizaciones anteriores quedaron invalidadas.'
}, null, 2)}\n`);
console.log(
  `Catalog DOM VERIFIED: ${catalog.totalMatchesCataloged} partido(s), ` +
  `${catalog.totalStructuredMarkets} mercado(s). Estado derivado anterior invalidado.`
);
