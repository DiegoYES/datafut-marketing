const fs = require('node:fs');
const path = require('node:path');
const {
  buildDatafutRawFromObservation,
  validateDatafutDomObservation
} = require('./lib/datafut-dom-observation');
const { readObservation } = require('./lib/dom-observation-import');
const { validatePngArtifact } = require('./lib/pipeline-audit');
const { readJson } = require('./lib/validation');

const projectDir = path.resolve(__dirname, '..');
const observationArg = process.argv[2];
if (!observationArg) throw new Error('Uso: import-datafut-dom-discovery.js <observacion.json>');
const catalog = readJson(path.join(projectDir, 'pipeline-state', 'playdoit-catalog.json'));
if (catalog.catalogStatus !== 'VERIFIED' || catalog.evidenceSource !== 'live_dom') {
  throw new Error('DataFut Discovery DOM requiere Catalog VERIFIED live_dom.');
}
const observation = readObservation(projectDir, observationArg);
const validation = validateDatafutDomObservation(catalog, observation.document, {
  validateArtifact: screenshot => validatePngArtifact(projectDir, screenshot)
});
if (!validation.valid) {
  throw new Error(`Observacion DOM de DataFut invalida:\n- ${validation.errors.join('\n- ')}`);
}
const raw = buildDatafutRawFromObservation(catalog, observation.document, {
  observationPath: observation.relativePath,
  observationSha256: observation.sha256
});
const rawPath = path.join(projectDir, 'scripts', 'datafut-live-raw.json');
fs.writeFileSync(rawPath, `${JSON.stringify(raw, null, 2)}\n`);
console.log(`Extraccion DataFut DOM importada: ${raw.matches.length} partido(s).`);
