const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('path');
const { readJson } = require('../scripts/lib/validation');
const {
  validateBetslipDomEvidence,
  validateDomMarketEvidence
} = require('../scripts/lib/dom-evidence');
const { validateDomSelectorConfig } = require('../scripts/lib/dom-selector-config');
const { validatePngArtifact } = require('../scripts/lib/pipeline-audit');

const fixture = readJson(path.join(__dirname, 'fixtures', 'playdoit-dom-evidence.json'));

let passed = 0;
let failed = 0;

function test(name, callback) {
  try {
    callback();
    passed += 1;
    console.log(`OK: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FALLO: ${name}`);
    console.error(`  ${error.stack || error.message}`);
  }
}

test('acepta evidencia DOM exacta de un mercado', () => {
  const result = validateDomMarketEvidence(fixture.candidate, fixture.marketEvidence);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('rechaza una linea distinta aunque el resto del texto coincida', () => {
  const evidence = structuredClone(fixture.marketEvidence);
  evidence.observedSemantics.line = 3.5;
  const result = validateDomMarketEvidence(fixture.candidate, evidence);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /Linea distinta/);
});

test('rechaza evidencia API presentada como verificacion exacta', () => {
  const evidence = structuredClone(fixture.marketEvidence);
  evidence.source = 'live_api';
  const result = validateDomMarketEvidence(fixture.candidate, evidence);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /source debe ser "live_dom"/);
});

test('rechaza tarjetas de equipo disfrazadas como total del partido', () => {
  const candidate = {
    candidateId: 'DF-SCOPE-001',
    match: 'Everton vs Universidad de Concepción',
    subject: 'Everton vs Universidad de Concepción',
    statistic: 'yellow_cards',
    scope: 'match',
    direction: 'over',
    line: 3.5,
    period: 'full_time'
  };
  const evidence = structuredClone(fixture.marketEvidence);
  evidence.eventText = candidate.match;
  evidence.marketText = 'Total de tarjetas U. de Concepción';
  evidence.selectionText = 'Más de 3,5';
  evidence.oddsText = '+120';
  evidence.rawText = `${evidence.marketText} ${evidence.selectionText} ${evidence.oddsText}`;
  evidence.observedSemantics = {
    subject: candidate.subject,
    statistic: candidate.statistic,
    scope: candidate.scope,
    direction: candidate.direction,
    line: candidate.line,
    period: candidate.period
  };
  const result = validateDomMarketEvidence(candidate, evidence);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /scope|subject/);
});

test('acepta la abreviatura visible cuando conserva alcance de equipo', () => {
  const candidate = {
    candidateId: 'DF-SCOPE-002',
    match: 'Everton vs Universidad de Concepción',
    subject: 'Universidad de Concepción',
    statistic: 'yellow_cards',
    scope: 'team',
    direction: 'over',
    line: 3.5,
    period: 'full_time'
  };
  const evidence = structuredClone(fixture.marketEvidence);
  evidence.eventText = candidate.match;
  evidence.marketText = 'Total de tarjetas U. de Concepción';
  evidence.selectionText = 'Más de 3,5';
  evidence.oddsText = '+120';
  evidence.rawText = `${evidence.marketText} ${evidence.selectionText} ${evidence.oddsText}`;
  evidence.observedSemantics = {
    subject: candidate.subject,
    statistic: candidate.statistic,
    scope: candidate.scope,
    direction: candidate.direction,
    line: candidate.line,
    period: candidate.period
  };
  const result = validateDomMarketEvidence(candidate, evidence);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('acepta una lectura DOM completa del betslip', () => {
  const result = validateBetslipDomEvidence(
    ['DF-TEST-001', 'DF-TEST-002'],
    fixture.betslipEvidence
  );
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('rechaza un momio calculado o filas incompletas', () => {
  const evidence = structuredClone(fixture.betslipEvidence);
  evidence.quoteMethod = 'calculated_from_individual_odds';
  evidence.selectionRows.pop();
  const result = validateBetslipDomEvidence(
    ['DF-TEST-001', 'DF-TEST-002'],
    evidence
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /betslip_dom_read/);
  assert.match(result.errors.join('\n'), /se esperaban 2/);
});

test('rechaza evidencia sin captura hasheada o sin limpieza', () => {
  const evidence = structuredClone(fixture.betslipEvidence);
  delete evidence.screenshot.sha256;
  evidence.cleanup.empty = false;
  const result = validateBetslipDomEvidence(
    ['DF-TEST-001', 'DF-TEST-002'],
    evidence
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /SHA-256/);
  assert.match(result.errors.join('\n'), /betslip vacio/);
});

test('rechaza texto renombrado como archivo PNG', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'datafut-evidence-'));
  const screenshotPath = path.join(tempDir, 'fake.png');
  const buffer = Buffer.from('BETSLIP_FABRICADO_POR_EL_SCRIPT', 'utf8');
  fs.writeFileSync(screenshotPath, buffer);
  const result = validatePngArtifact(tempDir, {
    path: 'fake.png',
    sha256: crypto.createHash('sha256').update(buffer).digest('hex')
  });
  assert.equal(result, false);
});

test('acepta la configuracion observada en el DOM real de PlayDoIt', () => {
  const config = readJson(path.join(__dirname, '..', 'config', 'playdoit-dom.json'));
  const result = validateDomSelectorConfig(config);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('acepta solamente selectores especificos con prueba de navegador', () => {
  const config = {
    version: 1,
    status: 'VERIFIED_LIVE_DOM',
    targetOrigin: 'https://www.playdoit.mx',
    selectors: {
      marketContainer: ['[data-testid="event-123-market-total"]'],
      selection: ['[data-testid="event-123-under-2-5"]'],
      betslipContainer: ['[data-testid="sportsbook-betslip"]'],
      selectionRow: ['[data-testid="betslip-selection-row"]'],
      combinedOdds: ['[data-testid="betslip-combined-odds"]']
    },
    matchingContract: {
      event: 'exact_text_or_explicit_alias',
      marketTitle: 'exact_text',
      selectionScope: 'descendant_of_matched_market',
      semanticDerivation: 'from_dom_text_only',
      betslipCrossCheck: 'exact_event_market_selection_odds'
    },
    verification: {
      observedAt: '2026-08-21T20:00:00.000Z',
      screenshotSha256: 'c'.repeat(64),
      screenshotPath: 'captures/evidence/selectors.png',
      browser: 'in-app-browser'
    }
  };
  const result = validateDomSelectorConfig(config);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('rechaza selectores genericos aunque se marquen como verificados', () => {
  const config = {
    version: 1,
    status: 'VERIFIED_LIVE_DOM',
    targetOrigin: 'https://www.playdoit.mx',
    selectors: {
      marketContainer: ['[class*="market"]'],
      selection: ['[class*="odd"]'],
      betslipContainer: ['[class*="betslip"]'],
      selectionRow: ['[class*="selection"]'],
      combinedOdds: ['[class*="price"]']
    },
    verification: {
      observedAt: '2026-08-21T20:00:00.000Z',
      screenshotSha256: 'd'.repeat(64),
      screenshotPath: 'captures/evidence/selectors.png',
      browser: 'in-app-browser'
    }
  };
  const result = validateDomSelectorConfig(config);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /demasiado amplio/);
});

test('rechaza buscar una seleccion fuera del mercado exacto', () => {
  const config = readJson(path.join(__dirname, '..', 'config', 'playdoit-dom.json'));
  config.matchingContract.selectionScope = 'global_text_search';
  const result = validateDomSelectorConfig(config);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /descendant_of_matched_market/);
});

if (failed > 0) {
  console.error(`Pruebas de contrato fallidas: ${failed}; correctas: ${passed}.`);
  process.exitCode = 1;
} else {
  console.log(`Pruebas de contrato correctas: ${passed}.`);
}
