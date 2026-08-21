const fs = require('fs');
const path = require('path');
const { readJson } = require('./validation');

function auditPipelineState(projectDir) {
  const stateDir = path.join(projectDir, 'pipeline-state');
  const errors = [];
  const warnings = [];
  const summary = {};

  function loadState(fileName) {
    const filePath = path.join(stateDir, fileName);
    if (!fs.existsSync(filePath)) {
      warnings.push(`No existe pipeline-state/${fileName}.`);
      return null;
    }
    return readJson(filePath);
  }

  const catalog = loadState('playdoit-catalog.json');
  if (catalog) {
    summary.catalog = {
      generatedAt: catalog.generatedAt,
      evidenceSource: catalog.evidenceSource,
      matches: Array.isArray(catalog.matches) ? catalog.matches.length : 0
    };
    if (!['live_api', 'live_dom'].includes(catalog.evidenceSource)) {
      warnings.push(`Catalogo con evidencia ${JSON.stringify(catalog.evidenceSource)}.`);
    }
  }

  const verified = loadState('verified-candidates.json');
  if (verified) {
    const eligibleCount = Number(verified.totalEligible || 0);
    summary.verification = {
      verifiedAt: verified.verifiedAt,
      evidenceSource: verified.evidenceSource,
      eligibleCount,
      publishable: verified.publishable === true
    };

    if (eligibleCount > 0) {
      if (verified.evidenceSource !== 'live_dom') {
        errors.push('Hay candidatos elegibles sin evidencia global live_dom.');
      }
      if (verified.verificationMethod !== 'dom_observation') {
        errors.push('Hay candidatos elegibles sin verificationMethod="dom_observation".');
      }
      if (verified.publishable !== true) {
        errors.push('Hay candidatos elegibles, pero verified-candidates.json no declara publishable=true.');
      }

      const eligibleResults = Array.isArray(verified.results)
        ? verified.results.filter(result => result.status === 'AVAILABLE_EXACT')
        : [];
      if (eligibleResults.length < eligibleCount) {
        errors.push('totalEligible supera los resultados AVAILABLE_EXACT disponibles.');
      }
      const withoutDomEvidence = eligibleResults.filter(
        result => result.evidenceSource !== 'live_dom' || !result.domEvidence
      );
      if (withoutDomEvidence.length > 0) {
        errors.push(
          `${withoutDomEvidence.length} candidato(s) AVAILABLE_EXACT carecen de evidencia DOM individual.`
        );
      }
    }
  }

  const parlays = loadState('parlay-options.json');
  if (parlays) {
    const finalists = Array.isArray(parlays.finalists) ? parlays.finalists : [];
    summary.parlays = {
      generatedAt: parlays.generatedAt,
      finalists: finalists.length,
      quoteMethod: parlays.quoteMethod || null,
      publishable: parlays.publishable === true
    };

    if (finalists.length > 0) {
      if (parlays.quoteMethod !== 'betslip_dom_read') {
        errors.push('Los finalistas no declaran quoteMethod="betslip_dom_read".');
      }
      if (parlays.publishable !== true) {
        errors.push('Hay finalistas, pero parlay-options.json no declara publishable=true.');
      }
      const withoutBetslipEvidence = finalists.filter(
        finalist => finalist.betslipEvidence !== 'live_dom' || !finalist.domEvidence
      );
      if (withoutBetslipEvidence.length > 0) {
        errors.push(
          `${withoutBetslipEvidence.length} finalista(s) carecen de lectura DOM demostrable del betslip.`
        );
      }
    }
  }

  return { errors, warnings, summary };
}

module.exports = { auditPipelineState };
