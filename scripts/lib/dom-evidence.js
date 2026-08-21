const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoTimestamp(value) {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function validateScreenshot(screenshot, prefix, errors) {
  if (!screenshot || typeof screenshot !== 'object') {
    errors.push(`${prefix}.screenshot es obligatorio.`);
    return;
  }
  if (!isNonEmptyString(screenshot.path)) {
    errors.push(`${prefix}.screenshot.path es obligatorio.`);
  }
  if (!isNonEmptyString(screenshot.sha256) || !SHA256_PATTERN.test(screenshot.sha256)) {
    errors.push(`${prefix}.screenshot.sha256 debe ser un SHA-256 hexadecimal.`);
  }
}

function validateCommonDomEvidence(evidence, prefix, errors) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    errors.push(`${prefix} debe ser un objeto.`);
    return false;
  }
  if (evidence.schemaVersion !== 1) errors.push(`${prefix}.schemaVersion debe ser 1.`);
  if (evidence.source !== 'live_dom') errors.push(`${prefix}.source debe ser "live_dom".`);
  if (!isIsoTimestamp(evidence.observedAt)) errors.push(`${prefix}.observedAt debe ser ISO-8601.`);
  if (!isNonEmptyString(evidence.url) || !/^https:\/\/([^.]+\.)?playdoit\.mx\//i.test(evidence.url)) {
    errors.push(`${prefix}.url debe pertenecer a playdoit.mx por HTTPS.`);
  }
  if (evidence.visible !== true) errors.push(`${prefix}.visible debe ser true.`);
  if (!isNonEmptyString(evidence.rawText)) errors.push(`${prefix}.rawText es obligatorio.`);
  validateScreenshot(evidence.screenshot, prefix, errors);
  return true;
}

function validateDomMarketEvidence(candidate, evidence) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['candidate debe ser un objeto.'] };
  }
  if (!validateCommonDomEvidence(evidence, 'domEvidence', errors)) {
    return { valid: false, errors };
  }

  if (evidence.verificationMethod !== 'dom_observation') {
    errors.push('domEvidence.verificationMethod debe ser "dom_observation".');
  }
  ['marketContainer', 'selection'].forEach(key => {
    if (!evidence.selectors || !isNonEmptyString(evidence.selectors[key])) {
      errors.push(`domEvidence.selectors.${key} es obligatorio.`);
    }
  });
  ['eventText', 'marketText', 'selectionText', 'oddsText', 'selectionId'].forEach(key => {
    if (!isNonEmptyString(evidence[key])) errors.push(`domEvidence.${key} es obligatorio.`);
  });

  const observed = evidence.observedSemantics;
  if (!observed || typeof observed !== 'object') {
    errors.push('domEvidence.observedSemantics es obligatorio.');
  } else {
    ['subject', 'statistic', 'scope', 'direction', 'period'].forEach(key => {
      if (candidate[key] !== undefined && observed[key] !== candidate[key]) {
        errors.push(`Semantica distinta en ${key}: esperado ${candidate[key]}, observado ${observed[key]}.`);
      }
    });
    if (candidate.line !== undefined && Number(observed.line) !== Number(candidate.line)) {
      errors.push(`Linea distinta: esperada ${candidate.line}, observada ${observed.line}.`);
    }
  }

  if (isNonEmptyString(candidate.match) && evidence.eventText !== candidate.match) {
    errors.push(`Partido distinto: esperado "${candidate.match}", observado "${evidence.eventText}".`);
  }

  return { valid: errors.length === 0, errors };
}

function validateBetslipDomEvidence(expectedCandidateIds, evidence) {
  const errors = [];
  if (!Array.isArray(expectedCandidateIds) || ![2, 3].includes(expectedCandidateIds.length)) {
    return { valid: false, errors: ['expectedCandidateIds debe contener 2 o 3 IDs.'] };
  }
  if (!validateCommonDomEvidence(evidence, 'domEvidence', errors)) {
    return { valid: false, errors };
  }

  if (evidence.quoteMethod !== 'betslip_dom_read') {
    errors.push('domEvidence.quoteMethod debe ser "betslip_dom_read".');
  }
  ['betslipContainer', 'selectionRow', 'combinedOdds'].forEach(key => {
    if (!evidence.selectors || !isNonEmptyString(evidence.selectors[key])) {
      errors.push(`domEvidence.selectors.${key} es obligatorio.`);
    }
  });
  if (!isNonEmptyString(evidence.combinedOddsText)) {
    errors.push('domEvidence.combinedOddsText es obligatorio.');
  }
  if (!Array.isArray(evidence.selectionRows)) {
    errors.push('domEvidence.selectionRows debe ser un arreglo.');
  } else {
    if (evidence.selectionRows.length !== expectedCandidateIds.length) {
      errors.push(
        `El betslip contiene ${evidence.selectionRows.length} filas; se esperaban ${expectedCandidateIds.length}.`
      );
    }
    const observedIds = evidence.selectionRows.map(row => row && row.candidateId);
    expectedCandidateIds.forEach(candidateId => {
      if (observedIds.filter(id => id === candidateId).length !== 1) {
        errors.push(`El candidato ${candidateId} no aparece exactamente una vez en el betslip.`);
      }
    });
    evidence.selectionRows.forEach((row, index) => {
      if (!row || !isNonEmptyString(row.rawText)) {
        errors.push(`domEvidence.selectionRows[${index}].rawText es obligatorio.`);
      }
    });
  }

  if (!evidence.cleanup || evidence.cleanup.empty !== true) {
    errors.push('domEvidence.cleanup.empty debe confirmar un betslip vacio.');
  }
  if (!evidence.cleanup || !isIsoTimestamp(evidence.cleanup.observedAt)) {
    errors.push('domEvidence.cleanup.observedAt debe ser ISO-8601.');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateBetslipDomEvidence,
  validateDomMarketEvidence
};
