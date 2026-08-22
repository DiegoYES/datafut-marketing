const fs = require('node:fs');
const path = require('node:path');
const { discoverCandidates } = require('./lib/discovery');
const { readJson } = require('./lib/validation');

const projectDir = path.resolve(__dirname, '..');
const catalogPath = path.join(projectDir, 'pipeline-state', 'playdoit-catalog.json');
const rawPath = path.resolve(projectDir, process.argv[2] || 'scripts/datafut-live-raw.json');
const outputPath = path.join(projectDir, 'pipeline-state', 'discovery-candidates.json');

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const catalog = readJson(catalogPath);
if (catalog.catalogStatus !== 'VERIFIED' || catalog.evidenceSource !== 'live_dom') {
  throw new Error('Discovery requiere un catalogo VERIFIED con evidencia live_dom.');
}

const rawMatches = readJson(rawPath);
const round = Number(optionValue('--round') || 1);
const candidates = discoverCandidates(catalog, rawMatches, {
  minimumPercentage: 65,
  limit: round === 1 ? 20 : 10,
  round
});

const output = {
  generatedAt: new Date().toISOString(),
  catalogGeneratedAt: catalog.generatedAt,
  datafutSource: 'authenticated_session_read',
  minimumPercentage: 65,
  round,
  publishable: false,
  candidates
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Discovery completo: ${candidates.length} candidato(s) exacto(s) guardado(s).`);
