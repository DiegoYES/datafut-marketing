const fs = require('node:fs');
const path = require('node:path');
const {
  buildParlayOptionsFromObservation,
  validateBetslipQuoteObservation
} = require('./lib/betslip-observation-import');
const { validateDomSelectorConfig } = require('./lib/dom-selector-config');
const { readObservation } = require('./lib/dom-observation-import');
const { validatePngArtifact } = require('./lib/pipeline-audit');
const { mergeQuotedParlays } = require('./lib/format-options');
const { readJson } = require('./lib/validation');

const projectDir = path.resolve(__dirname, '..');
const stateDir = path.join(projectDir, 'pipeline-state');
const observationArg = process.argv[2];
if (!observationArg) throw new Error('Uso: import-playdoit-betslip-quotes.js <observacion.json>');

const selectorConfig = readJson(path.join(projectDir, 'config', 'playdoit-dom.json'));
const selectorValidation = validateDomSelectorConfig(selectorConfig);
if (!selectorValidation.valid) {
  throw new Error(`Selectores DOM no verificados:\n- ${selectorValidation.errors.join('\n- ')}`);
}
const verification = readJson(path.join(stateDir, 'verified-candidates.json'));
const eligiblePoolPath = path.join(stateDir, 'eligible-candidates.json');
const eligiblePool = fs.existsSync(eligiblePoolPath) ? readJson(eligiblePoolPath) : null;
const discovery = readJson(path.join(stateDir, 'discovery-candidates.json'));
const discoveryById = new Map((discovery.candidates || []).map(item => [item.candidateId, item]));
const eligibleItems = eligiblePool?.catalogGeneratedAt && Array.isArray(eligiblePool.candidates) && eligiblePool.candidates.length
  ? eligiblePool.candidates
  : (verification.results || [])
    .filter(result => result.status === 'AVAILABLE_EXACT' && result.editorialEligible === true)
    .map(result => ({ discovery: discoveryById.get(result.candidateId), verification: result }));
if (eligibleItems.length < 2) throw new Error('Se requieren al menos 2 candidatos elegibles verificados.');

const observation = readObservation(projectDir, observationArg);
if (observation.document.verificationGeneratedAt !== verification.verifiedAt) {
  throw new Error('La observacion del boleto pertenece a otra Verification.');
}
const validateArtifact = screenshot => validatePngArtifact(projectDir, screenshot);
const validation = validateBetslipQuoteObservation(eligibleItems, observation.document, {
  selectorConfig,
  validateArtifact
});
if (!validation.valid) {
  throw new Error(`Observacion DOM del boleto invalida:\n- ${validation.errors.join('\n- ')}`);
}
const output = buildParlayOptionsFromObservation(eligibleItems, observation.document, {
  selectorConfig,
  verificationGeneratedAt: verification.verifiedAt
});
fs.writeFileSync(path.join(stateDir, 'parlay-options.json'), `${JSON.stringify(output, null, 2)}\n`);
const formatOptionsPath = path.join(stateDir, 'format-options.json');
if (fs.existsSync(formatOptionsPath)) {
  const synchronizedFormats = mergeQuotedParlays(readJson(formatOptionsPath), output);
  fs.writeFileSync(formatOptionsPath, `${JSON.stringify(synchronizedFormats, null, 2)}\n`);
}
console.log(`Betslip DOM importado: ${output.finalists.length} finalista(s) listo(s) para eleccion humana.`);
