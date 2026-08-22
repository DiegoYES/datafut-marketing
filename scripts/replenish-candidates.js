const fs = require('node:fs');
const path = require('node:path');
const { candidateKey, discoverCandidates } = require('./lib/discovery');
const { readJson } = require('./lib/validation');

const projectDir = path.resolve(__dirname, '..');
const stateDir = path.join(projectDir, 'pipeline-state');
const rawPath = path.resolve(projectDir, process.argv[2] || 'scripts/datafut-live-raw.json');
const statePath = path.join(stateDir, 'replenishment-state.json');
const discoveryPath = path.join(stateDir, 'discovery-candidates.json');
const verificationPath = path.join(stateDir, 'verified-candidates.json');
const eligiblePath = path.join(stateDir, 'eligible-candidates.json');

const catalog = readJson(path.join(stateDir, 'playdoit-catalog.json'));
const discovery = readJson(discoveryPath);
const verification = readJson(verificationPath);
const rawMatches = readJson(rawPath);

if (verification.discoveryGeneratedAt !== discovery.generatedAt) {
  throw new Error('Verification no corresponde a la ronda actual de Discovery.');
}

const previous = fs.existsSync(statePath)
  ? readJson(statePath)
  : { catalogGeneratedAt: catalog.generatedAt, rounds: [], evaluatedKeys: [], eligible: [] };
if (previous.catalogGeneratedAt !== catalog.generatedAt) {
  throw new Error('El historial de reposicion pertenece a otro catalogo. Inicia una ronda nueva.');
}

const discoveryById = new Map((discovery.candidates || []).map(item => [item.candidateId, item]));
const resultById = new Map((verification.results || []).map(item => [item.candidateId, item]));
const definitiveFailures = new Set([
  'LINE_MISMATCH',
  'SCOPE_MISMATCH',
  'MARKET_MISMATCH',
  'PERIOD_MISMATCH',
  'NOT_AVAILABLE',
  'EVENT_STARTED',
  'MARKET_NOT_VISIBLE'
]);

const evaluatedKeys = new Set(previous.evaluatedKeys || []);
const eligibleByKey = new Map((previous.eligible || []).map(item => [item.candidateKey, item]));
const roundResults = [];

for (const candidate of discovery.candidates || []) {
  const result = resultById.get(candidate.candidateId);
  if (!result) continue;
  const key = candidate.candidateKey || candidateKey(candidate);
  const definitive = result.status === 'AVAILABLE_EXACT' || definitiveFailures.has(result.status);
  if (definitive) evaluatedKeys.add(key);
  if (
    result.status === 'AVAILABLE_EXACT' &&
    result.editorialEligible !== false &&
    Number(candidate.percentage) > 70
  ) {
    eligibleByKey.set(key, {
      candidateKey: key,
      discovery: candidate,
      verification: result,
      verifiedAt: verification.verifiedAt
    });
  }
  roundResults.push({ candidateId: candidate.candidateId, candidateKey: key, status: result.status });
}

const currentRound = Number(discovery.round || 1);
const eligible = [...eligibleByKey.values()];
let status = 'TARGET_REACHED';
let nextCandidates = [];

const eventStarted = roundResults.some(item => item.status === 'EVENT_STARTED');
if (eventStarted) {
  status = 'REFRESH_CATALOG_REQUIRED';
} else if (eligible.length < 6 && currentRound < 4) {
  nextCandidates = discoverCandidates(catalog, rawMatches, {
    percentageThresholdExclusive: 70,
    limit: 10,
    round: currentRound + 1,
    excludedKeys: [...evaluatedKeys]
  });
  status = nextCandidates.length > 0 ? 'NEXT_ROUND_READY' : 'EXHAUSTED';
} else if (eligible.length < 6) {
  status = 'MAX_ROUNDS_REACHED';
}

const rounds = [
  ...(previous.rounds || []).filter(item => item.round !== currentRound),
  {
    round: currentRound,
    discoveryGeneratedAt: discovery.generatedAt,
    verifiedAt: verification.verifiedAt,
    results: roundResults
  }
].sort((left, right) => left.round - right.round);

const state = {
  updatedAt: new Date().toISOString(),
  catalogGeneratedAt: catalog.generatedAt,
  targetEligible: 6,
  maximumRounds: 4,
  status,
  eligibleCount: eligible.length,
  evaluatedKeys: [...evaluatedKeys],
  eligible,
  rounds
};
fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
fs.writeFileSync(eligiblePath, `${JSON.stringify({
  generatedAt: state.updatedAt,
  catalogGeneratedAt: catalog.generatedAt,
  eligibleCount: eligible.length,
  candidates: eligible
}, null, 2)}\n`);

if (status === 'NEXT_ROUND_READY') {
  fs.writeFileSync(discoveryPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    catalogGeneratedAt: catalog.generatedAt,
    datafutSource: 'authenticated_session_read',
    percentageThresholdExclusive: 70,
    round: currentRound + 1,
    replacementForRound: currentRound,
    excludedCandidateKeys: [...evaluatedKeys],
    publishable: false,
    candidates: nextCandidates
  }, null, 2)}\n`);
}

console.log(`Reposicion: ${status}. Elegibles acumulados: ${eligible.length}/6.`);
if (nextCandidates.length > 0) {
  console.log(`Ronda ${currentRound + 1}: ${nextCandidates.length} candidato(s) nuevo(s) requieren Verification.`);
}
if (status === 'REFRESH_CATALOG_REQUIRED') {
  console.log('El evento ya inicio: refresca Catalog antes de buscar reemplazos.');
}
