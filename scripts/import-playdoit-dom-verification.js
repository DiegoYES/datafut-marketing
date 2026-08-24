const fs = require('node:fs');
const path = require('node:path');
const { validateDomSelectorConfig } = require('./lib/dom-selector-config');
const {
  buildVerificationFromObservation,
  readObservation,
  validateVerificationObservation
} = require('./lib/dom-observation-import');
const { validatePngArtifact } = require('./lib/pipeline-audit');
const { readJson } = require('./lib/validation');

const projectDir = path.resolve(__dirname, '..');
const stateDir = path.join(projectDir, 'pipeline-state');
const observationArg = process.argv[2];
if (!observationArg) throw new Error('Uso: import-playdoit-dom-verification.js <observacion.json>');

const selectorConfig = readJson(path.join(projectDir, 'config', 'playdoit-dom.json'));
const selectorValidation = validateDomSelectorConfig(selectorConfig);
if (!selectorValidation.valid) {
  throw new Error(`Selectores DOM no verificados:\n- ${selectorValidation.errors.join('\n- ')}`);
}
const catalog = readJson(path.join(stateDir, 'playdoit-catalog.json'));
const discovery = readJson(path.join(stateDir, 'discovery-candidates.json'));
if (catalog.catalogStatus !== 'VERIFIED' || catalog.evidenceSource !== 'live_dom') {
  throw new Error('Verification DOM requiere Catalog VERIFIED live_dom.');
}

const observation = readObservation(projectDir, observationArg);
const validateArtifact = screenshot => validatePngArtifact(projectDir, screenshot);
const validation = validateVerificationObservation(catalog, discovery, observation.document, {
  selectorConfig,
  validateArtifact
});
if (!validation.valid) {
  throw new Error(`Observacion DOM de Verification invalida:\n- ${validation.errors.join('\n- ')}`);
}

const output = buildVerificationFromObservation(catalog, discovery, observation.document, {
  selectorConfig,
  validateArtifact
});
fs.writeFileSync(
  path.join(stateDir, 'verified-candidates.json'),
  `${JSON.stringify(output, null, 2)}\n`
);
console.log(
  `Verification DOM completa: ${output.totalEligible}/${output.totalCandidatesReviewed} ` +
  'candidato(s) AVAILABLE_EXACT.'
);
