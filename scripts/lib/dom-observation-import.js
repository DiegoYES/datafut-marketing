const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  classifyMarket,
  normalizeText,
  parseSelection,
  sameText
} = require('./playdoit-semantics');
const { validateDomMarketEvidence } = require('./dom-evidence');

const PLAYDOIT_ORIGIN = 'https://www.playdoit.mx';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoTimestamp(value) {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableDomId(...parts) {
  return `dom-${sha256(parts.map(normalizeText).join('|')).slice(0, 20)}`;
}

function hasPlaydoitEventUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.origin === PLAYDOIT_ORIGIN && /(?:^|&)eventId=\d+(?:&|$)/.test(parsed.hash);
  } catch {
    return false;
  }
}

function containsLiteral(haystack, needle) {
  return normalizeText(haystack).includes(normalizeText(needle));
}

function validateSelectors(selectors, required, expected, prefix, errors) {
  required.forEach(key => {
    if (!isNonEmptyString(selectors?.[key])) {
      errors.push(`${prefix}.selectors.${key} es obligatorio.`);
      return;
    }
    if (expected?.[key] && !expected[key].includes(selectors[key])) {
      errors.push(`${prefix}.selectors.${key} no coincide con la configuracion DOM verificada.`);
    }
  });
}

function validateScreenshot(screenshot, validateArtifact, prefix, errors) {
  if (!screenshot || typeof screenshot !== 'object') {
    errors.push(`${prefix}.screenshot es obligatorio.`);
    return;
  }
  if (!isNonEmptyString(screenshot.path) || !/^[a-f0-9]{64}$/i.test(screenshot.sha256 || '')) {
    errors.push(`${prefix}.screenshot debe contener path y sha256 validos.`);
    return;
  }
  if (validateArtifact && !validateArtifact(screenshot)) {
    errors.push(`${prefix}.screenshot no es un PNG local autentico con el SHA declarado.`);
  }
}

function validateCatalogObservation(observation, options = {}) {
  const errors = [];
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    return { valid: false, errors: ['La observacion de Catalog debe ser un objeto.'] };
  }
  if (observation.schemaVersion !== 1) errors.push('schemaVersion debe ser 1.');
  if (observation.captureType !== 'playdoit_catalog') {
    errors.push('captureType debe ser "playdoit_catalog".');
  }
  if (observation.source !== 'live_dom') errors.push('source debe ser "live_dom".');
  if (!isIsoTimestamp(observation.observedAt)) errors.push('observedAt debe ser ISO-8601.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observation.targetDate || '')) {
    errors.push('targetDate debe usar YYYY-MM-DD.');
  }
  if (observation.navigationMode !== 'chrome_extension') {
    errors.push('navigationMode debe ser "chrome_extension".');
  }
  if (!Array.isArray(observation.events) || observation.events.length === 0) {
    errors.push('events debe contener al menos un evento observado.');
    return { valid: false, errors };
  }

  const eventIds = new Set();
  observation.events.forEach((event, eventIndex) => {
    const prefix = `events[${eventIndex}]`;
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      errors.push(`${prefix} debe ser un objeto.`);
      return;
    }
    if (!isIsoTimestamp(event.observedAt)) errors.push(`${prefix}.observedAt debe ser ISO-8601.`);
    if (!hasPlaydoitEventUrl(event.url)) errors.push(`${prefix}.url no es un evento de PlayDoIt.`);
    if (!isNonEmptyString(event.eventId)) errors.push(`${prefix}.eventId es obligatorio.`);
    if (eventIds.has(String(event.eventId))) errors.push(`${prefix}.eventId esta duplicado.`);
    eventIds.add(String(event.eventId));
    ['homeTeam', 'awayTeam', 'eventText', 'league', 'rawText'].forEach(key => {
      if (!isNonEmptyString(event[key])) errors.push(`${prefix}.${key} es obligatorio.`);
    });
    if (event.visible !== true) errors.push(`${prefix}.visible debe ser true.`);
    if (
      isNonEmptyString(event.eventText) &&
      (!containsLiteral(event.eventText, event.homeTeam) || !containsLiteral(event.eventText, event.awayTeam))
    ) {
      errors.push(`${prefix}.eventText no contiene ambos equipos visibles.`);
    }
    validateSelectors(
      event.selectors,
      ['marketContainer', 'selection'],
      options.selectorConfig?.selectors,
      prefix,
      errors
    );
    validateScreenshot(event.screenshot, options.validateArtifact, prefix, errors);
    if (!Array.isArray(event.markets) || event.markets.length === 0) {
      errors.push(`${prefix}.markets debe contener mercados visibles.`);
      return;
    }
    event.markets.forEach((market, marketIndex) => {
      const marketPrefix = `${prefix}.markets[${marketIndex}]`;
      if (!isNonEmptyString(market?.marketText) || !isNonEmptyString(market?.rawText)) {
        errors.push(`${marketPrefix}.marketText y rawText son obligatorios.`);
        return;
      }
      if (!containsLiteral(market.rawText, market.marketText)) {
        errors.push(`${marketPrefix}.rawText no contiene marketText.`);
      }
      if (!containsLiteral(event.rawText, market.rawText)) {
        errors.push(`${marketPrefix}.rawText no pertenece al texto DOM del evento.`);
      }
      const semantics = classifyMarket(market.marketText, event.homeTeam, event.awayTeam);
      if (!semantics.valid) {
        errors.push(`${marketPrefix}.marketText no demuestra semantica exacta: ${semantics.reason}.`);
      }
      if (!Array.isArray(market.selections) || market.selections.length === 0) {
        errors.push(`${marketPrefix}.selections debe contener selecciones.`);
        return;
      }
      market.selections.forEach((selection, selectionIndex) => {
        const selectionPrefix = `${marketPrefix}.selections[${selectionIndex}]`;
        if (!isNonEmptyString(selection?.selectionText) || !isNonEmptyString(selection?.oddsText)) {
          errors.push(`${selectionPrefix}.selectionText y oddsText son obligatorios.`);
          return;
        }
        const parsed = parseSelection(selection.selectionText);
        if (!parsed.valid) errors.push(`${selectionPrefix}.selectionText no contiene direccion y linea.`);
        if (!containsLiteral(market.rawText, selection.selectionText) || !containsLiteral(market.rawText, selection.oddsText)) {
          errors.push(`${selectionPrefix} no aparece completo dentro del contenedor de mercado.`);
        }
      });
    });
  });

  return { valid: errors.length === 0, errors };
}

function buildCatalogFromObservation(observation, metadata = {}) {
  const matches = observation.events.map((event, eventIndex) => {
    const markets = event.markets.map((market, marketIndex) => {
      const semantics = classifyMarket(market.marketText, event.homeTeam, event.awayTeam);
      const directions = new Map();
      market.selections.forEach((selection, selectionIndex) => {
        const parsed = parseSelection(selection.selectionText);
        if (!parsed.valid) return;
        if (!directions.has(parsed.direction)) directions.set(parsed.direction, []);
        const lines = directions.get(parsed.direction);
        if (lines.some(line => Number(line.line) === Number(parsed.line))) return;
        lines.push({
          line: parsed.line,
          oddsText: selection.oddsText,
          oddsDecimal: Number.isFinite(Number(selection.oddsDecimal)) ? Number(selection.oddsDecimal) : null,
          rawSelection: selection.selectionText,
          oddId: selection.selectionId || stableDomId(event.eventId, marketIndex, selectionIndex, selection.selectionText)
        });
      });
      return {
        marketId: market.marketId || stableDomId(event.eventId, marketIndex, market.marketText),
        marketText: market.marketText,
        subject: semantics.subject,
        statistic: semantics.statistic,
        scope: semantics.scope,
        period: semantics.period,
        family: semantics.statistic,
        directions: [...directions.entries()].map(([direction, lines]) => ({ direction, lines }))
      };
    });
    return {
      matchId: event.matchId || `PD-DOM-${String(eventIndex + 1).padStart(3, '0')}`,
      eventId: String(event.eventId),
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      match: event.eventText,
      league: event.league,
      startTime: event.startTime || null,
      eventUrl: event.url,
      marketCoverage: event.marketCoverage || 'PARTIAL',
      markets
    };
  });
  const firstScreenshot = observation.events[0].screenshot;
  return {
    generatedAt: observation.observedAt,
    targetDate: observation.targetDate,
    targetWindow: observation.targetWindow || 'eventos observados en el DOM durante la captura',
    targetTimezone: observation.targetTimezone || 'America/Mexico_City',
    navigationMode: 'headed',
    evidenceSource: 'live_dom',
    catalogStatus: 'VERIFIED',
    marketCoverage: matches.every(match => match.marketCoverage === 'COMPLETE') ? 'COMPLETE' : 'PARTIAL',
    totalMatchesCataloged: matches.length,
    totalStructuredMarkets: matches.reduce((total, match) => total + match.markets.length, 0),
    domEvidence: {
      source: 'live_dom',
      verificationMethod: 'dom_observation',
      observationPath: metadata.observationPath || null,
      observationSha256: metadata.observationSha256 || null,
      screenshot: firstScreenshot
    },
    integrityNotice: 'Todos los mercados incluidos proceden de contenedores visibles del DOM; Catalog no convierte candidatos en AVAILABLE_EXACT.',
    matches
  };
}

function validateBetslipCrossCheck(candidate, observation, errors) {
  const prefix = `candidateObservations.${candidate.candidateId}.betslip`;
  const betslip = observation.betslip;
  if (!betslip || typeof betslip !== 'object' || Array.isArray(betslip)) {
    errors.push(`${prefix} es obligatorio para AVAILABLE_EXACT.`);
    return;
  }
  ['eventText', 'marketText', 'selectionText', 'oddsText', 'rawText'].forEach(key => {
    if (!isNonEmptyString(betslip[key])) errors.push(`${prefix}.${key} es obligatorio.`);
  });
  if (!isIsoTimestamp(betslip.observedAt)) errors.push(`${prefix}.observedAt debe ser ISO-8601.`);
  if (betslip.selectionCount !== 1) errors.push(`${prefix}.selectionCount debe ser 1.`);
  if (betslip.cleanupEmpty !== true) errors.push(`${prefix}.cleanupEmpty debe ser true.`);
  if (!isIsoTimestamp(betslip.cleanupObservedAt)) {
    errors.push(`${prefix}.cleanupObservedAt debe ser ISO-8601.`);
  }
  const expected = {
    eventText: observation.eventText,
    marketText: observation.marketText,
    selectionText: observation.selectionText,
    oddsText: observation.oddsText
  };
  Object.entries(expected).forEach(([key, value]) => {
    if (!sameText(betslip[key], value)) errors.push(`${prefix}.${key} no coincide con el mercado observado.`);
    if (isNonEmptyString(betslip.rawText) && !containsLiteral(betslip.rawText, value)) {
      errors.push(`${prefix}.rawText no contiene ${key}.`);
    }
  });
}

function buildMarketEvidence(candidate, observation, selectorConfig) {
  const derivedMarket = classifyMarket(
    observation.marketText,
    observation.homeTeam,
    observation.awayTeam
  );
  const derivedSelection = parseSelection(observation.selectionText);
  return {
    schemaVersion: 1,
    source: 'live_dom',
    verificationMethod: 'dom_observation',
    observedAt: observation.observedAt,
    url: observation.url,
    visible: observation.visible,
    eventText: observation.eventText,
    marketText: observation.marketText,
    selectionText: observation.selectionText,
    oddsText: observation.oddsText,
    selectionId: observation.selectionId || stableDomId(
      candidate.candidateId,
      observation.marketText,
      observation.selectionText
    ),
    observedSemantics: {
      subject: derivedMarket.subject,
      statistic: derivedMarket.statistic,
      scope: derivedMarket.scope,
      direction: derivedSelection.direction,
      line: derivedSelection.line,
      period: derivedMarket.period
    },
    selectors: {
      marketContainer: selectorConfig.selectors.marketContainer[0],
      selection: selectorConfig.selectors.selection[0]
    },
    rawText: observation.rawText,
    screenshot: observation.screenshot,
    betslipCrossCheck: observation.betslip
  };
}

function requestedFromCandidate(candidate) {
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

function validateVerificationObservation(catalog, discovery, observation, options = {}) {
  const errors = [];
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    return { valid: false, errors: ['La observacion de Verification debe ser un objeto.'] };
  }
  if (observation.schemaVersion !== 1) errors.push('schemaVersion debe ser 1.');
  if (observation.captureType !== 'playdoit_verification') {
    errors.push('captureType debe ser "playdoit_verification".');
  }
  if (observation.source !== 'live_dom') errors.push('source debe ser "live_dom".');
  if (observation.navigationMode !== 'chrome_extension') {
    errors.push('navigationMode debe ser "chrome_extension".');
  }
  if (!isIsoTimestamp(observation.observedAt)) errors.push('observedAt debe ser ISO-8601.');
  if (observation.catalogGeneratedAt !== catalog.generatedAt) {
    errors.push('catalogGeneratedAt no coincide con Catalog.');
  }
  if (observation.discoveryGeneratedAt !== discovery.generatedAt) {
    errors.push('discoveryGeneratedAt no coincide con Discovery.');
  }
  if (!Array.isArray(observation.candidateObservations)) {
    errors.push('candidateObservations debe ser un arreglo.');
    return { valid: false, errors };
  }
  const candidateIds = new Set((discovery.candidates || []).map(candidate => candidate.candidateId));
  const seen = new Set();
  observation.candidateObservations.forEach((item, index) => {
    const prefix = `candidateObservations[${index}]`;
    if (!candidateIds.has(item?.candidateId)) errors.push(`${prefix}.candidateId no pertenece a Discovery.`);
    if (seen.has(item?.candidateId)) errors.push(`${prefix}.candidateId esta duplicado.`);
    seen.add(item?.candidateId);
    ['observedAt', 'url', 'homeTeam', 'awayTeam', 'eventText', 'marketText', 'selectionText', 'oddsText', 'rawText']
      .forEach(key => {
        if (!isNonEmptyString(item?.[key])) errors.push(`${prefix}.${key} es obligatorio.`);
      });
    if (!isIsoTimestamp(item?.observedAt)) errors.push(`${prefix}.observedAt debe ser ISO-8601.`);
    if (!hasPlaydoitEventUrl(item?.url)) errors.push(`${prefix}.url no es un evento de PlayDoIt.`);
    if (item?.visible !== true) errors.push(`${prefix}.visible debe ser true.`);
    validateScreenshot(item?.screenshot, options.validateArtifact, prefix, errors);
    const candidate = (discovery.candidates || []).find(entry => entry.candidateId === item?.candidateId);
    if (candidate) validateBetslipCrossCheck(candidate, item, errors);
  });
  return { valid: errors.length === 0, errors };
}

function buildVerificationFromObservation(catalog, discovery, observation, options = {}) {
  const observationsById = new Map(
    observation.candidateObservations.map(item => [item.candidateId, item])
  );
  const results = (discovery.candidates || []).map(candidate => {
    const requested = requestedFromCandidate(candidate);
    const item = observationsById.get(candidate.candidateId);
    if (!item) {
      return {
        candidateId: candidate.candidateId,
        percentage: Number(candidate.percentage),
        datafutCardId: candidate.datafutCard?.cardId,
        status: 'NOT_VERIFIED',
        reason: 'No existe observacion DOM para este candidato en la ejecucion actual.',
        editorialEligible: false,
        evidenceSource: 'not_observed',
        requested,
        playdoit: null
      };
    }
    const match = (catalog.matches || []).find(entry => entry.matchId === candidate.catalogMatchId) || {};
    const domEvidence = buildMarketEvidence(candidate, item, options.selectorConfig);
    const evidenceValidation = validateDomMarketEvidence(requested, domEvidence, match);
    const betslipErrors = [];
    validateBetslipCrossCheck(candidate, item, betslipErrors);
    const screenshotValid = options.validateArtifact ? options.validateArtifact(item.screenshot) : true;
    const available = evidenceValidation.valid && betslipErrors.length === 0 && screenshotValid;
    return {
      candidateId: candidate.candidateId,
      percentage: Number(candidate.percentage),
      datafutCardId: candidate.datafutCard?.cardId,
      status: available ? 'AVAILABLE_EXACT' : 'NOT_VERIFIED',
      reason: available ? null : [...evidenceValidation.errors, ...betslipErrors].join(' '),
      editorialEligible: available && Number(candidate.percentage) > 70,
      evidenceSource: available ? 'live_dom' : 'not_observed',
      requested,
      playdoit: available ? {
        matchText: item.eventText,
        marketText: item.marketText,
        selectionText: item.selectionText,
        oddsText: item.oddsText,
        priceDecimal: Number.isFinite(Number(item.priceDecimal)) ? Number(item.priceDecimal) : null,
        marketId: item.marketId || null,
        oddId: domEvidence.selectionId
      } : null,
      domEvidence
    };
  });
  const totalEligible = results.filter(result => result.status === 'AVAILABLE_EXACT').length;
  return {
    verifiedAt: observation.observedAt,
    discoveryGeneratedAt: discovery.generatedAt,
    navigationMode: 'headed',
    evidenceSource: totalEligible > 0 ? 'live_dom' : 'not_observed',
    verificationMethod: totalEligible > 0 ? 'dom_observation' : 'not_observed',
    totalCandidatesReviewed: results.length,
    totalEligible,
    publishable: totalEligible > 0,
    integrityNotice: totalEligible > 0
      ? 'AVAILABLE_EXACT fue derivado por codigo desde mercado acotado y comprobacion exacta en el boleto.'
      : 'Ningun candidato reunio evidencia DOM exacta completa.',
    results
  };
}

function readObservation(projectDir, observationPath) {
  const resolved = path.resolve(projectDir, observationPath);
  if (resolved !== projectDir && !resolved.startsWith(`${projectDir}${path.sep}`)) {
    throw new Error('La observacion debe estar dentro del proyecto.');
  }
  const buffer = fs.readFileSync(resolved);
  return {
    path: resolved,
    relativePath: path.relative(projectDir, resolved).replace(/\\/g, '/'),
    sha256: sha256(buffer),
    document: JSON.parse(buffer.toString('utf8'))
  };
}

module.exports = {
  buildCatalogFromObservation,
  buildVerificationFromObservation,
  readObservation,
  stableDomId,
  validateCatalogObservation,
  validateVerificationObservation
};
