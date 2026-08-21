const assert = require('node:assert/strict');
const path = require('path');
const { readJson } = require('../scripts/lib/validation');
const {
  validateBetslipDomEvidence,
  validateDomMarketEvidence
} = require('../scripts/lib/dom-evidence');
const { validateDomSelectorConfig } = require('../scripts/lib/dom-selector-config');

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

test('mantiene bloqueada la configuracion de selectores historicos', () => {
  const config = readJson(path.join(__dirname, '..', 'config', 'playdoit-dom.json'));
  const result = validateDomSelectorConfig(config);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /VERIFIED_LIVE_DOM/);
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
    verification: {
      observedAt: '2026-08-21T20:00:00.000Z',
      screenshotSha256: 'c'.repeat(64),
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
      browser: 'in-app-browser'
    }
  };
  const result = validateDomSelectorConfig(config);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /demasiado amplio/);
});

if (failed > 0) {
  console.error(`Pruebas de contrato fallidas: ${failed}; correctas: ${passed}.`);
  process.exitCode = 1;
} else {
  console.log(`Pruebas de contrato correctas: ${passed}.`);
}
