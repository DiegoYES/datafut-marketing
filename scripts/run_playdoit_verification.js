const fs = require('node:fs');
const path = require('node:path');
const { readJson } = require('./lib/validation');

const projectDir = path.resolve(__dirname, '..');
const catalogPath = path.join(projectDir, 'pipeline-state', 'playdoit-catalog.json');
const discoveryPath = path.join(projectDir, 'pipeline-state', 'discovery-candidates.json');
const outputPath = path.join(projectDir, 'pipeline-state', 'verified-candidates.json');
const eligiblePath = path.join(projectDir, 'pipeline-state', 'eligible-candidates.json');
const replenishmentPath = path.join(projectDir, 'pipeline-state', 'replenishment-state.json');
const formatOptionsPath = path.join(projectDir, 'pipeline-state', 'format-options.json');

function requestedFrom(candidate) {
  return {
    match: candidate.match,
    subject: candidate.subject,
    statistic: candidate.statistic,
    scope: candidate.scope,
    direction: candidate.direction,
    line: Number(candidate.line),
    period: candidate.period,
    market: candidate.market
  };
}

function writeBlocked(catalog, discovery, reason) {
  const verifiedAt = new Date().toISOString();
  const results = (discovery.candidates || []).map(candidate => ({
    candidateId: candidate.candidateId,
    percentage: Number(candidate.percentage),
    datafutCardId: candidate.datafutCard?.cardId,
    status: 'NOT_VERIFIED',
    reason,
    editorialEligible: false,
    evidenceSource: 'not_observed',
    requested: requestedFrom(candidate),
    playdoit: null
  }));
  const output = {
    verifiedAt,
    discoveryGeneratedAt: discovery.generatedAt,
    navigationMode: 'not_started',
    evidenceSource: 'not_observed',
    verificationMethod: 'not_observed',
    totalCandidatesReviewed: results.length,
    totalEligible: 0,
    publishable: false,
    integrityNotice: reason,
    results
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  const eligibleOutput = {
    generatedAt: verifiedAt,
    catalogGeneratedAt: catalog?.generatedAt || null,
    eligibleCount: 0,
    status: 'INVALIDATED_BY_VERIFICATION',
    candidates: []
  };
  fs.writeFileSync(eligiblePath, `${JSON.stringify(eligibleOutput, null, 2)}\n`);
  fs.writeFileSync(replenishmentPath, `${JSON.stringify({
    updatedAt: verifiedAt,
    catalogGeneratedAt: catalog?.generatedAt || null,
    status: 'VERIFICATION_BLOCKED',
    eligibleCount: 0,
    evaluatedKeys: [],
    eligible: [],
    rounds: []
  }, null, 2)}\n`);
  fs.writeFileSync(formatOptionsPath, `${JSON.stringify({
    generatedAt: verifiedAt,
    eligiblePoolGeneratedAt: eligibleOutput.generatedAt,
    userSelectionRequired: true,
    publishable: false,
    status: 'VERIFICATION_BLOCKED',
    routes: {
      individual: { options: [] },
      parlay: { options: [] },
      combinada: { options: [] }
    }
  }, null, 2)}\n`);
  console.error(`[NOT VERIFIED] ${reason}`);
  process.exitCode = 1;
}

const catalog = readJson(catalogPath);
const discovery = readJson(discoveryPath);

if (!discovery || !Array.isArray(discovery.candidates)) {
  throw new Error('Discovery candidates no esta disponible.');
}

if (
  !catalog ||
  catalog.catalogStatus !== 'VERIFIED' ||
  catalog.evidenceSource !== 'live_dom'
) {
  writeBlocked(
    catalog,
    discovery,
    'Verification bloqueada: Catalog no posee evidencia live_dom VERIFIED. La API de Altenar no puede producir AVAILABLE_EXACT.'
  );
} else {
  writeBlocked(
    catalog,
    discovery,
    'Verification bloqueada: falta un adaptador de captura DOM real. No se permite convertir respuestas API ni semantica declarada por el modelo en AVAILABLE_EXACT.'
  );
}
