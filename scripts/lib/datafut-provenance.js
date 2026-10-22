const crypto = require('node:crypto');

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const SEMANTIC_FIELDS = [
  'subject',
  'statistic',
  'scope',
  'direction',
  'line',
  'period'
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizedEvidence(evidenceText) {
  return Array.isArray(evidenceText) ? evidenceText.map(String) : [];
}

function cardPayload({ sourceUrl, rawTitle, percentage, evidenceText, fullSnippet }) {
  return {
    sourceUrl: String(sourceUrl || ''),
    rawTitle: String(rawTitle || ''),
    displayedPercentage: Number(percentage),
    evidenceText: normalizedEvidence(evidenceText),
    fullSnippet: String(fullSnippet || '')
  };
}

function parseSmoothedPercentages(evidenceText) {
  // Match Center redacta "con suavizado: X%"; el Comparador (misma regla de
  // promedio de dos fuentes) redacta "Al suavizar la muestra: X%".
  return [...normalizedEvidence(evidenceText).join(' ').matchAll(/(?:con suavizado|al suavizar la muestra):\s*(\d+(?:[.,]\d+)?)%/gi)]
    .map(match => Number(match[1].replace(',', '.')));
}

function roundedAverage(values) {
  if (!Array.isArray(values) || values.length !== 2) return null;
  return Math.round(((values[0] + values[1]) / 2) * 10) / 10;
}

function createDatafutCard({ sourceUrl, pick, semantics }) {
  const payload = cardPayload({
    sourceUrl,
    rawTitle: pick.rawTitle,
    percentage: pick.percentage,
    evidenceText: pick.evidenceText,
    fullSnippet: pick.fullSnippet
  });
  const smoothedPercentages = parseSmoothedPercentages(payload.evidenceText);
  return {
    schemaVersion: 1,
    source: 'datafut_authenticated_dom',
    cardId: sha256(JSON.stringify(payload)),
    ...payload,
    smoothedPercentages,
    computedPercentage: roundedAverage(smoothedPercentages),
    semantics: Object.fromEntries(
      SEMANTIC_FIELDS.map(field => [field, semantics[field]])
    )
  };
}

function equalValue(field, left, right) {
  return field === 'line' ? Number(left) === Number(right) : left === right;
}

function validateDatafutCard(candidate) {
  const errors = [];
  const card = candidate?.datafutCard;
  if (!card || typeof card !== 'object' || Array.isArray(card)) {
    return { valid: false, errors: ['datafutCard es obligatorio.'] };
  }
  if (card.schemaVersion !== 1) errors.push('datafutCard.schemaVersion debe ser 1.');
  if (card.source !== 'datafut_authenticated_dom') {
    errors.push('datafutCard.source debe ser "datafut_authenticated_dom".');
  }
  if (!SHA256_PATTERN.test(card.cardId || '')) {
    errors.push('datafutCard.cardId debe ser un SHA-256 hexadecimal.');
  }

  const payload = cardPayload({
    sourceUrl: card.sourceUrl,
    rawTitle: card.rawTitle,
    percentage: card.displayedPercentage,
    evidenceText: card.evidenceText,
    fullSnippet: card.fullSnippet
  });
  if (card.cardId !== sha256(JSON.stringify(payload))) {
    errors.push('datafutCard.cardId no coincide con el contenido exacto de la tarjeta.');
  }
  if (!payload.fullSnippet) errors.push('datafutCard.fullSnippet es obligatorio.');
  if (!payload.fullSnippet.startsWith(`${payload.rawTitle} ${payload.displayedPercentage}%`)) {
    errors.push('datafutCard.fullSnippet no inicia con el titulo y porcentaje exactos.');
  }
  if (payload.evidenceText.some(evidence => !payload.fullSnippet.includes(evidence))) {
    errors.push('datafutCard.fullSnippet no contiene literalmente toda su evidencia.');
  }
  if (payload.rawTitle !== candidate.market) {
    errors.push('El titulo DataFut no coincide con candidate.market.');
  }
  if (payload.sourceUrl !== candidate.sourceUrl) {
    errors.push('La URL DataFut no coincide con candidate.sourceUrl.');
  }
  if (payload.displayedPercentage !== Number(candidate.percentage)) {
    errors.push('El porcentaje del candidato no coincide con el porcentaje mostrado por la tarjeta.');
  }
  if (JSON.stringify(payload.evidenceText) !== JSON.stringify(candidate.evidence || [])) {
    errors.push('La evidencia del candidato no coincide con la tarjeta DataFut.');
  }

  const smoothed = parseSmoothedPercentages(payload.evidenceText);
  const comparadorCard = card.captureRoute === 'comparador_state_url';
  const computedPercentage = comparadorCard && smoothed.length === 1
    ? Math.round(smoothed[0] * 10) / 10
    : roundedAverage(smoothed);
  if (comparadorCard ? smoothed.length !== 1 : smoothed.length !== 2) {
    errors.push(comparadorCard
      ? 'La tarjeta comparador debe contener exactamente una tasa "al suavizar la muestra" (fuente disponible).'
      : 'La tarjeta debe contener exactamente dos tasas "con suavizado".');
  } else if (Math.abs(computedPercentage - payload.displayedPercentage) > 0.11) {
    errors.push(
      `El porcentaje mostrado ${payload.displayedPercentage}% no coincide con el promedio ` +
      `${computedPercentage}% de sus dos fuentes.`
    );
  }
  if (JSON.stringify(card.smoothedPercentages) !== JSON.stringify(smoothed)) {
    errors.push('datafutCard.smoothedPercentages no coincide con la evidencia literal.');
  }
  if (Number(card.computedPercentage) !== Number(computedPercentage)) {
    errors.push('datafutCard.computedPercentage no coincide con las tasas suavizadas.');
  }

  for (const field of SEMANTIC_FIELDS) {
    if (!card.semantics || !equalValue(field, card.semantics[field], candidate[field])) {
      errors.push(`La semantica DataFut no coincide en ${field}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function sameCandidateSemantics(left, right) {
  if (!left || !right) return false;
  return SEMANTIC_FIELDS.every(field => equalValue(field, left[field], right[field])) &&
    left.match === right.match;
}

module.exports = {
  createDatafutCard,
  parseSmoothedPercentages,
  roundedAverage,
  sameCandidateSemantics,
  sha256,
  validateDatafutCard
};
