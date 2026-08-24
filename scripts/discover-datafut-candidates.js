const fs = require('node:fs');
const crypto = require('node:crypto');
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

const rawDocument = readJson(rawPath);
if (!rawDocument || Array.isArray(rawDocument) || !Array.isArray(rawDocument.matches)) {
  throw new Error('Discovery solo acepta una extraccion oficial con metadata y matches[].');
}
if (rawDocument.datafutSource !== 'authenticated_session_read') {
  throw new Error('La extraccion no declara datafutSource="authenticated_session_read".');
}
if (rawDocument.catalogGeneratedAt !== catalog.generatedAt) {
  throw new Error('La extraccion DataFut pertenece a otro catalogo PlayDoIt.');
}
if (rawDocument.targetDate !== catalog.targetDate) {
  throw new Error('La extraccion DataFut y el catalogo PlayDoIt pertenecen a fechas distintas.');
}
const rawMatches = rawDocument.matches;
const rawSha256 = crypto.createHash('sha256').update(fs.readFileSync(rawPath)).digest('hex');
const round = Number(optionValue('--round') || 1);
const candidates = discoverCandidates(catalog, rawMatches, {
  percentageThresholdExclusive: 70,
  limit: round === 1 ? 20 : 10,
  round
});

const output = {
  generatedAt: new Date().toISOString(),
  catalogGeneratedAt: catalog.generatedAt,
  datafutSource: 'authenticated_session_read',
  datafutRawPath: path.relative(projectDir, rawPath).replace(/\\/g, '/'),
  datafutRawSha256: rawSha256,
  percentageThresholdExclusive: 70,
  round,
  publishable: false,
  candidates
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Discovery completo: ${candidates.length} candidato(s) exacto(s) guardado(s).`);
