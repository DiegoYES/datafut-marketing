const { normalizeText } = require('./playdoit-semantics');
const {
  parseSmoothedPercentages,
  roundedAverage
} = require('./datafut-provenance');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoTimestamp(value) {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function containsLiteral(haystack, needle) {
  return normalizeText(haystack).includes(normalizeText(needle));
}

function validateDatafutDomObservation(catalog, observation, options = {}) {
  const errors = [];
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    return { valid: false, errors: ['La observacion DataFut debe ser un objeto.'] };
  }
  if (observation.schemaVersion !== 1) errors.push('schemaVersion debe ser 1.');
  if (observation.captureType !== 'datafut_discovery') {
    errors.push('captureType debe ser "datafut_discovery".');
  }
  if (observation.source !== 'authenticated_chrome_dom') {
    errors.push('source debe ser "authenticated_chrome_dom".');
  }
  if (!isIsoTimestamp(observation.observedAt)) errors.push('observedAt debe ser ISO-8601.');
  if (observation.catalogGeneratedAt !== catalog.generatedAt) {
    errors.push('catalogGeneratedAt no coincide con Catalog.');
  }
  if (observation.targetDate !== catalog.targetDate) errors.push('targetDate no coincide con Catalog.');
  if (!Array.isArray(observation.matches) || observation.matches.length === 0) {
    errors.push('matches debe contener al menos un partido observado.');
    return { valid: false, errors };
  }
  const catalogIds = new Set((catalog.matches || []).map(match => match.matchId));
  const seenMatches = new Set();
  observation.matches.forEach((match, matchIndex) => {
    const prefix = `matches[${matchIndex}]`;
    if (!catalogIds.has(match?.catalogMatchId)) errors.push(`${prefix}.catalogMatchId no pertenece a Catalog.`);
    if (seenMatches.has(match?.catalogMatchId)) errors.push(`${prefix}.catalogMatchId esta duplicado.`);
    seenMatches.add(match?.catalogMatchId);
    if (!/^https:\/\/([^.]+\.)?data-fut\.com\/partido\.html/i.test(match?.url || '')) {
      errors.push(`${prefix}.url debe ser una ficha de partido DataFut.`);
    }
    if (!isNonEmptyString(match?.title)) errors.push(`${prefix}.title es obligatorio.`);
    if (!Array.isArray(match?.cards) || match.cards.length === 0) {
      errors.push(`${prefix}.cards debe contener tarjetas observadas.`);
      return;
    }
    const seenTitles = new Set();
    match.cards.forEach((card, cardIndex) => {
      const cardPrefix = `${prefix}.cards[${cardIndex}]`;
      if (!isNonEmptyString(card?.rawTitle)) errors.push(`${cardPrefix}.rawTitle es obligatorio.`);
      if (seenTitles.has(card?.rawTitle)) errors.push(`${cardPrefix}.rawTitle esta duplicado.`);
      seenTitles.add(card?.rawTitle);
      if (!Number.isFinite(Number(card?.displayedPercentage))) {
        errors.push(`${cardPrefix}.displayedPercentage debe ser numerico.`);
      }
      if (!isNonEmptyString(card?.sampleLine)) errors.push(`${cardPrefix}.sampleLine es obligatorio.`);
      if (!Array.isArray(card?.evidenceText) || card.evidenceText.length === 0) {
        errors.push(`${cardPrefix}.evidenceText es obligatorio.`);
      }
      if (!isNonEmptyString(card?.fullSnippet)) errors.push(`${cardPrefix}.fullSnippet es obligatorio.`);
      const expectedPrefix = `${card?.rawTitle} ${Number(card?.displayedPercentage)}%`;
      if (!String(card?.fullSnippet || '').startsWith(expectedPrefix)) {
        errors.push(`${cardPrefix}.fullSnippet no inicia con titulo y porcentaje exactos.`);
      }
      (card?.evidenceText || []).forEach((evidence, evidenceIndex) => {
        if (!containsLiteral(card.fullSnippet, evidence)) {
          errors.push(`${cardPrefix}.fullSnippet no contiene evidenceText[${evidenceIndex}].`);
        }
      });
      const smoothed = parseSmoothedPercentages(card?.evidenceText || []);
      const computed = roundedAverage(smoothed);
      if (smoothed.length !== 2) errors.push(`${cardPrefix} no contiene exactamente dos tasas suavizadas.`);
      if (computed !== Number(card?.displayedPercentage)) {
        errors.push(`${cardPrefix} muestra ${card?.displayedPercentage}% pero sus fuentes promedian ${computed}%.`);
      }
      if (!isNonEmptyString(card?.dialogText) || !containsLiteral(card.dialogText, card.rawTitle)) {
        errors.push(`${cardPrefix}.dialogText no demuestra el titulo de la tarjeta.`);
      }
      if (!card?.screenshot || !options.validateArtifact?.(card.screenshot)) {
        errors.push(`${cardPrefix}.screenshot no es un PNG autentico con SHA valido.`);
      }
    });
  });
  return { valid: errors.length === 0, errors };
}

function buildDatafutRawFromObservation(catalog, observation, metadata = {}) {
  return {
    extractedAt: observation.observedAt,
    datafutSource: 'authenticated_session_read',
    captureMethod: 'authenticated_chrome_dom_observation',
    observationPath: metadata.observationPath || null,
    observationSha256: metadata.observationSha256 || null,
    catalogGeneratedAt: catalog.generatedAt,
    targetDate: catalog.targetDate,
    matches: observation.matches.map(match => ({
      catalogMatchId: match.catalogMatchId,
      url: match.url,
      title: match.title,
      picks: match.cards.map(card => ({
        rawTitle: card.rawTitle,
        percentage: Number(card.displayedPercentage),
        sampleLine: card.sampleLine,
        evidenceText: card.evidenceText,
        fullSnippet: card.fullSnippet
      }))
    }))
  };
}

module.exports = {
  buildDatafutRawFromObservation,
  validateDatafutDomObservation
};
