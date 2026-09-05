const { validateBetslipDomEvidence } = require('./dom-evidence');
const { normalizeText } = require('./playdoit-semantics');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoTimestamp(value) {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function containsLiteral(haystack, needle) {
  return normalizeText(haystack).includes(normalizeText(needle));
}

function candidateRecord(item) {
  if (item?.discovery && item?.verification) {
    return { discovery: item.discovery, verification: item.verification };
  }
  return { discovery: item?.discovery || {}, verification: item?.verification || item };
}

function validateBetslipQuoteObservation(eligibleItems, observation, options = {}) {
  const errors = [];
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    return { valid: false, errors: ['La observacion del betslip debe ser un objeto.'] };
  }
  if (observation.schemaVersion !== 1) errors.push('schemaVersion debe ser 1.');
  if (observation.captureType !== 'playdoit_betslip_quotes') {
    errors.push('captureType debe ser "playdoit_betslip_quotes".');
  }
  if (observation.source !== 'live_dom') errors.push('source debe ser "live_dom".');
  if (observation.navigationMode !== 'chrome_extension') {
    errors.push('navigationMode debe ser "chrome_extension".');
  }
  if (!isIsoTimestamp(observation.observedAt)) errors.push('observedAt debe ser ISO-8601.');
  if (!Array.isArray(observation.quotes) || observation.quotes.length === 0) {
    errors.push('quotes debe contener al menos una cotizacion DOM.');
    return { valid: false, errors };
  }

  const eligibleById = new Map(eligibleItems.map(item => {
    const record = candidateRecord(item);
    return [record.verification.candidateId, record];
  }));
  const quoteKeys = new Set();
  observation.quotes.forEach((quote, quoteIndex) => {
    const prefix = `quotes[${quoteIndex}]`;
    if (!Array.isArray(quote?.candidateIds) || ![2, 3].includes(quote.candidateIds.length)) {
      errors.push(`${prefix}.candidateIds debe contener 2 o 3 IDs.`);
      return;
    }
    if (new Set(quote.candidateIds).size !== quote.candidateIds.length) {
      errors.push(`${prefix}.candidateIds contiene duplicados.`);
    }
    const key = [...quote.candidateIds].sort().join('|');
    if (quoteKeys.has(key)) errors.push(`${prefix} repite una combinacion ya cotizada.`);
    quoteKeys.add(key);
    const records = quote.candidateIds.map(id => eligibleById.get(id));
    if (records.some(record => !record)) errors.push(`${prefix} contiene candidatos no elegibles.`);
    if (records.every(Boolean)) {
      const matches = records.map(record => record.verification.requested?.match);
      if (new Set(matches.map(normalizeText)).size !== matches.length) {
        errors.push(`${prefix} mezcla selecciones del mismo partido en un Parlay normal.`);
      }
    }
    if (!isIsoTimestamp(quote.observedAt)) errors.push(`${prefix}.observedAt debe ser ISO-8601.`);
    if (!/^https:\/\/([^.]+\.)?playdoit\.mx\//i.test(quote.url || '')) {
      errors.push(`${prefix}.url debe pertenecer a PlayDoIt.`);
    }
    if (quote.visible !== true) errors.push(`${prefix}.visible debe ser true.`);
    if (!/^[+-]\d+$/.test(quote.combinedOddsText || '')) {
      errors.push(`${prefix}.combinedOddsText debe ser una cuota americana leida del DOM.`);
    }
    if (!quote.screenshot || !options.validateArtifact?.(quote.screenshot)) {
      errors.push(`${prefix}.screenshot no es un PNG autentico con SHA valido.`);
    }
    const domEvidence = {
      schemaVersion: 1,
      source: 'live_dom',
      quoteMethod: 'betslip_dom_read',
      observedAt: quote.observedAt,
      url: quote.url,
      visible: quote.visible,
      combinedOddsText: quote.combinedOddsText,
      selectionRows: quote.selectionRows,
      selectors: {
        betslipContainer: options.selectorConfig?.selectors?.betslipContainer?.[0],
        selectionRow: options.selectorConfig?.selectors?.selectionRow?.[0],
        combinedOdds: options.selectorConfig?.selectors?.combinedOdds?.[0]
      },
      rawText: quote.rawText,
      screenshot: quote.screenshot,
      cleanup: quote.cleanup
    };
    const domValidation = validateBetslipDomEvidence(quote.candidateIds, domEvidence);
    domValidation.errors.forEach(error => errors.push(`${prefix}: ${error}`));
    if (records.every(Boolean) && Array.isArray(quote.selectionRows)) {
      quote.selectionRows.forEach((row, rowIndex) => {
        const record = eligibleById.get(row?.candidateId);
        if (!record) return;
        const expected = record.verification.playdoit;
        ['matchText', 'marketText', 'selectionText', 'oddsText'].forEach(field => {
          if (!isNonEmptyString(row?.[field]) || normalizeText(row[field]) !== normalizeText(expected?.[field])) {
            errors.push(`${prefix}.selectionRows[${rowIndex}].${field} no coincide con Verification.`);
          }
          if (isNonEmptyString(row?.rawText) && !containsLiteral(row.rawText, expected?.[field])) {
            errors.push(`${prefix}.selectionRows[${rowIndex}].rawText no contiene ${field}.`);
          }
        });
      });
    }
  });
  return { valid: errors.length === 0, errors };
}

function sampleSize(discovery) {
  return Number(discovery.sample?.home || 0) + Number(discovery.sample?.away || 0);
}

function commercialRank(value) {
  return { normal: 0, low: 1, very_low: 2, unknown: 3 }[value] ?? 3;
}

// Pisos editoriales de momio combinado (politica del operador, no probabi-
// lidad): dobles desde -150 hacia arriba, triples desde +100 hacia arriba.
// Un momio bajo no invalida la cotizacion; solo ordena peor al elegir.
function americanToDecimal(oddsText) {
  const n = Number(String(oddsText || '').replace('+', ''));
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

function meetsMomioFloor(quote) {
  const decimal = americanToDecimal(quote.combinedOddsText);
  if (!Number.isFinite(decimal)) return false;
  if (quote.candidateIds.length === 2) return decimal >= 1 + 100 / 150 - 1e-9;
  if (quote.candidateIds.length === 3) return decimal >= 2 - 1e-9;
  return false;
}

function compareQuotes(left, right, candidatesById) {
  const records = quote => quote.candidateIds.map(id => candidatesById.get(id));
  const leftRecords = records(left);
  const rightRecords = records(right);
  const leftWorstCommercial = Math.max(...leftRecords.map(record => commercialRank(record.discovery.commercialPriority)));
  const rightWorstCommercial = Math.max(...rightRecords.map(record => commercialRank(record.discovery.commercialPriority)));
  if (leftWorstCommercial !== rightWorstCommercial) return leftWorstCommercial - rightWorstCommercial;
  const leftFloor = Math.min(...leftRecords.map(record => Number(record.discovery.percentage)));
  const rightFloor = Math.min(...rightRecords.map(record => Number(record.discovery.percentage)));
  if (leftFloor !== rightFloor) return rightFloor - leftFloor;
  const leftSample = leftRecords.reduce((total, record) => total + sampleSize(record.discovery), 0);
  const rightSample = rightRecords.reduce((total, record) => total + sampleSize(record.discovery), 0);
  if (leftSample !== rightSample) return rightSample - leftSample;
  return left.candidateIds.join('|').localeCompare(right.candidateIds.join('|'));
}

function buildParlayOptionsFromObservation(eligibleItems, observation, options = {}) {
  const candidatesById = new Map(eligibleItems.map(item => {
    const record = candidateRecord(item);
    return [record.verification.candidateId, record];
  }));
  const sorted = [...observation.quotes].sort((a, b) => compareQuotes(a, b, candidatesById));
  const passing = sorted.filter(meetsMomioFloor);
  const bestDouble = passing.find(quote => quote.candidateIds.length === 2)
    || sorted.find(quote => quote.candidateIds.length === 2);
  const bestTriple = passing.find(quote => quote.candidateIds.length === 3)
    || sorted.find(quote => quote.candidateIds.length === 3);
  const chosen = [];
  if (bestDouble) chosen.push(bestDouble);
  if (bestTriple && bestTriple !== bestDouble) chosen.push(bestTriple);
  [...passing, ...sorted].forEach(quote => {
    if (chosen.length < 5 && !chosen.includes(quote)) chosen.push(quote);
  });
  const finalists = chosen.slice(0, 5).map((quote, index) => {
    const records = quote.candidateIds.map(id => candidatesById.get(id));
    return {
      rank: index + 1,
      type: quote.candidateIds.length === 2 ? 'doble' : 'triple',
      candidateIds: quote.candidateIds,
      combinedOddsText: quote.combinedOddsText,
      combinedOddsDecimal: Number.isFinite(Number(quote.combinedOddsDecimal))
        ? Number(quote.combinedOddsDecimal)
        : null,
      quoteMethod: 'betslip_dom_read',
      betslipEvidence: 'live_dom',
      quotedAt: quote.observedAt,
      meetsMomioFloor: meetsMomioFloor(quote),
      selections: records.map(record => ({
        candidateId: record.verification.candidateId,
        match: record.verification.requested.match,
        market: record.verification.playdoit.marketText,
        selection: record.verification.playdoit.selectionText,
        percentage: Number(record.discovery.percentage),
        sample: record.discovery.sample,
        individualOdds: record.verification.playdoit.oddsText
      })),
      editorialReason: 'Selecciones verificadas, partidos distintos y cuota conjunta leida directamente del boleto.',
      domEvidence: {
        schemaVersion: 1,
        source: 'live_dom',
        quoteMethod: 'betslip_dom_read',
        observedAt: quote.observedAt,
        url: quote.url,
        visible: true,
        combinedOddsText: quote.combinedOddsText,
        selectionRows: quote.selectionRows,
        selectors: {
          betslipContainer: options.selectorConfig.selectors.betslipContainer[0],
          selectionRow: options.selectorConfig.selectors.selectionRow[0],
          combinedOdds: options.selectorConfig.selectors.combinedOdds[0]
        },
        rawText: quote.rawText,
        screenshot: quote.screenshot,
        cleanup: quote.cleanup
      }
    };
  });
  return {
    generatedAt: observation.observedAt,
    verificationGeneratedAt: options.verificationGeneratedAt,
    status: finalists.length > 0 ? 'FINALISTS_READY' : 'NO_VALID_QUOTES',
    publishable: finalists.length > 0,
    quoteMethod: 'betslip_dom_read',
    eligibleCount: eligibleItems.length,
    combinationsEvaluated: observation.quotes.length,
    finalists,
    integrityNotice: 'Los porcentajes son respaldos individuales; ninguna probabilidad conjunta fue calculada. Los momios proceden del boleto DOM.'
  };
}

module.exports = {
  buildParlayOptionsFromObservation,
  validateBetslipQuoteObservation
};
