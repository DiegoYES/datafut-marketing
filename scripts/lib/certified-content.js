const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { readJson, validateParlayData } = require('./validation');

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalize(value[key])])
  );
}

function hashObject(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function loadCertificationContext(projectDir) {
  const stateDir = path.join(projectDir, 'pipeline-state');
  const required = [
    'playdoit-catalog.json',
    'eligible-candidates.json',
    'format-options.json',
    'parlay-options.json'
  ];
  const missing = required.filter(file => !fs.existsSync(path.join(stateDir, file)));
  if (missing.length > 0) {
    throw new Error(`Faltan archivos oficiales: ${missing.join(', ')}.`);
  }
  return {
    catalog: readJson(path.join(stateDir, 'playdoit-catalog.json')),
    eligiblePool: readJson(path.join(stateDir, 'eligible-candidates.json')),
    formatOptions: readJson(path.join(stateDir, 'format-options.json')),
    parlayOptions: readJson(path.join(stateDir, 'parlay-options.json'))
  };
}

function candidateMap(context) {
  return new Map(
    (context.eligiblePool?.candidates || []).map(entry => [
      entry.discovery?.candidateId,
      entry
    ])
  );
}

function catalogMatchMap(context) {
  return new Map(
    (context.catalog?.matches || []).map(match => [match.matchId, match])
  );
}

function findCertifiedParlay(context, optionId) {
  const option = (context.formatOptions?.routes?.parlay?.options || [])
    .find(item => item.optionId === optionId);
  if (!option) throw new Error(`La opcion ${optionId} no existe en format-options.json.`);
  if (option.status !== 'READY_FOR_USER_SELECTION') {
    throw new Error(`La opcion ${optionId} no esta READY_FOR_USER_SELECTION.`);
  }
  if (option.quoteMethod !== 'betslip_dom_read' || !option.combinedOdds) {
    throw new Error(`La opcion ${optionId} no tiene una cuota DOM certificada.`);
  }

  const ids = option.candidateIds || [];
  const key = [...ids].sort().join('|');
  const finalist = (context.parlayOptions?.finalists || []).find(item =>
    [...(item.candidateIds || [])].sort().join('|') === key
  );
  if (!finalist) throw new Error(`La opcion ${optionId} no existe entre los finalistas oficiales.`);
  if (
    context.parlayOptions?.publishable !== true ||
    finalist.quoteMethod !== 'betslip_dom_read' ||
    finalist.betslipEvidence !== 'live_dom' ||
    finalist.combinedOddsText !== option.combinedOdds
  ) {
    throw new Error(`La opcion ${optionId} perdio su evidencia de boleto.`);
  }
  if (![2, 3].includes(ids.length) || new Set(ids).size !== ids.length) {
    throw new Error(`La opcion ${optionId} no contiene 2 o 3 candidatos distintos.`);
  }
  return { option, finalist };
}

function certifiedPick(entry, match) {
  const discovery = entry.discovery;
  const verification = entry.verification;
  const smoothed = discovery?.datafutCard?.smoothedPercentages || [];
  if (!discovery || !verification || !match || smoothed.length !== 2) {
    throw new Error(`El candidato ${discovery?.candidateId || '(sin id)'} esta incompleto.`);
  }
  if (
    verification.status !== 'AVAILABLE_EXACT' ||
    verification.evidenceSource !== 'live_dom' ||
    verification.datafutCardId !== discovery.datafutCard?.cardId ||
    Number(verification.percentage) !== Number(discovery.percentage) ||
    Number(discovery.percentage) <= 70
  ) {
    throw new Error(`El candidato ${discovery.candidateId} no conserva una cadena certificada.`);
  }

  return {
    candidateId: discovery.candidateId,
    datafutCardId: discovery.datafutCard.cardId,
    league: match.league,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    market: discovery.market,
    percentage: Number(discovery.percentage),
    individualOdds: verification.playdoit?.oddsText || null,
    sampleText: `Muestra ${discovery.sample.home} local / ${discovery.sample.away} visitante`,
    evidence: [
      {
        label: `${match.homeTeam} (fuente local)`,
        value: `${Number(smoothed[0]).toFixed(1)}%`,
        detail: 'tasa suavizada de la tarjeta DataFut exacta'
      },
      {
        label: `${match.awayTeam} (fuente visitante)`,
        value: `${Number(smoothed[1]).toFixed(1)}%`,
        detail: 'tasa suavizada de la tarjeta DataFut exacta'
      }
    ]
  };
}

function certificationCore(data) {
  return {
    schemaVersion: data.provenance?.schemaVersion,
    source: data.provenance?.source,
    optionId: data.provenance?.optionId,
    catalogGeneratedAt: data.provenance?.catalogGeneratedAt,
    eligiblePoolGeneratedAt: data.provenance?.eligiblePoolGeneratedAt,
    verificationGeneratedAt: data.provenance?.verificationGeneratedAt,
    parlayOptionsGeneratedAt: data.provenance?.parlayOptionsGeneratedAt,
    candidateIds: data.provenance?.candidateIds,
    combinedOdds: data.combinedOdds,
    picks: (data.picks || []).map(pick => ({
      candidateId: pick.candidateId,
      datafutCardId: pick.datafutCardId,
      league: pick.league,
      homeTeam: pick.homeTeam,
      awayTeam: pick.awayTeam,
      market: pick.market,
      percentage: pick.percentage,
      individualOdds: pick.individualOdds,
      sampleText: pick.sampleText,
      evidence: pick.evidence
    }))
  };
}

function baseProvenance(context, optionId, candidateIds, generatedAt) {
  return {
    schemaVersion: 1,
    source: 'pipeline_state',
    optionId,
    catalogGeneratedAt: context.catalog.generatedAt,
    eligiblePoolGeneratedAt: context.eligiblePool.generatedAt,
    verificationGeneratedAt: context.parlayOptions.verificationGeneratedAt,
    parlayOptionsGeneratedAt: context.parlayOptions.generatedAt,
    candidateIds: [...candidateIds],
    generatedAt,
    certificationHash: null
  };
}

function assertCatalogDate(context, date) {
  if (date !== context.catalog?.targetDate) {
    throw new Error(`La fecha ${date} no coincide con el Catalog ${context.catalog?.targetDate}.`);
  }
}

function buildCertifiedParlayData(context, optionId, date, generatedAt = new Date().toISOString()) {
  assertCatalogDate(context, date);
  const { option, finalist } = findCertifiedParlay(context, optionId);
  const candidates = candidateMap(context);
  const matches = catalogMatchMap(context);
  const picks = option.candidateIds.map(candidateId => {
    const entry = candidates.get(candidateId);
    if (!entry) throw new Error(`El candidato ${candidateId} no existe en eligible-candidates.json.`);
    return certifiedPick(entry, matches.get(entry.discovery.catalogMatchId));
  });

  const data = {
    format: 'parlay-de-datos',
    date,
    title: 'PARLAY DE DATOS',
    subtitle: `Momio ${finalist.combinedOddsText} en PlayDoIt · leido del boleto`,
    combinedOdds: finalist.combinedOddsText,
    musicPreset: 'analysis',
    picks,
    ctaTitle: `¿LE ENTRAS AL MOMIO ${finalist.combinedOddsText}?`,
    ctaText: 'Consulta el analisis completo en data-fut.com',
    probabilityNotice: 'Los porcentajes son respaldos individuales y no representan probabilidad conjunta.',
    disclaimer: 'Estimaciones basadas en datos historicos. No garantizan resultados.',
    provenance: baseProvenance(context, optionId, option.candidateIds, generatedAt)
  };
  data.provenance.certificationHash = hashObject(certificationCore(data));
  return data;
}

function individualCore(data) {
  return {
    schemaVersion: data.provenance?.schemaVersion,
    source: data.provenance?.source,
    optionId: data.provenance?.optionId,
    catalogGeneratedAt: data.provenance?.catalogGeneratedAt,
    eligiblePoolGeneratedAt: data.provenance?.eligiblePoolGeneratedAt,
    verificationGeneratedAt: data.provenance?.verificationGeneratedAt,
    candidateIds: data.provenance?.candidateIds,
    candidateId: data.candidateId,
    datafutCardId: data.datafutCardId,
    date: data.date,
    league: data.league,
    match: data.match,
    homeTeam: data.homeTeam,
    awayTeam: data.awayTeam,
    market: data.market,
    percentage: data.percentage,
    individualOdds: data.individualOdds,
    probability: data.probability,
    sample: data.sample,
    sampleText: data.sampleText,
    evidence: data.evidence
  };
}

function buildCertifiedIndividualData(context, optionId, date, generatedAt = new Date().toISOString()) {
  assertCatalogDate(context, date);
  const option = (context.formatOptions?.routes?.individual?.options || [])
    .find(item => item.optionId === optionId);
  if (!option || option.status !== 'READY_FOR_USER_SELECTION') {
    throw new Error(`La opcion individual ${optionId} no esta READY_FOR_USER_SELECTION.`);
  }
  const entry = candidateMap(context).get(option.candidate?.candidateId);
  const match = catalogMatchMap(context).get(entry?.discovery?.catalogMatchId);
  const pick = certifiedPick(entry || {}, match);
  const data = {
    format: 'promo-video',
    date,
    candidateId: pick.candidateId,
    datafutCardId: pick.datafutCardId,
    hookBadge: 'PICK CERTIFICADO',
    hookTitle: 'OJO CON ESTE PARTIDO',
    league: pick.league,
    match: `${pick.homeTeam} vs ${pick.awayTeam}`,
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    market: pick.market,
    percentage: pick.percentage,
    individualOdds: pick.individualOdds,
    probability: `${pick.percentage.toFixed(1)}%`,
    sample: pick.sampleText,
    sampleText: pick.sampleText,
    evidence: pick.evidence.map(item => ({
      team: item.label,
      label: item.detail,
      value: item.value
    })),
    ctaQuestion: '¿LE ENTRAS A ESTE PICK?',
    ctaLabel: 'ESTADISTICAS COMPLETAS EN:',
    ctaUrl: 'data-fut.com',
    ctaSubtext: 'Herramientas de datos para apostadores deportivos',
    disclaimer: 'Estimaciones basadas en datos historicos. No garantizan resultados.',
    provenance: baseProvenance(context, optionId, [pick.candidateId], generatedAt)
  };
  data.provenance.certificationHash = hashObject(individualCore(data));
  return data;
}

function validateCertifiedIndividualDataAgainstContext(data, context) {
  const errors = [];
  const warnings = [];
  try {
    if (data?.format !== 'promo-video') errors.push('format debe ser "promo-video".');
    const expected = buildCertifiedIndividualData(
      context,
      data?.provenance?.optionId,
      data?.date,
      data?.provenance?.generatedAt
    );
    const actualCore = individualCore(data);
    if (JSON.stringify(canonicalize(actualCore)) !== JSON.stringify(canonicalize(individualCore(expected)))) {
      errors.push('El pick individual no coincide exactamente con el pipeline certificado.');
    }
    if (data?.provenance?.certificationHash !== hashObject(actualCore)) {
      errors.push('provenance.certificationHash no corresponde al pick individual actual.');
    }
    if (data?.provenance?.certificationHash !== expected.provenance.certificationHash) {
      errors.push('La certificacion individual no coincide con los estados oficiales actuales.');
    }
  } catch (error) {
    errors.push(error.message);
  }
  return { errors: [...new Set(errors)], warnings };
}

function combinadaCore(data) {
  const asParlay = { ...data, picks: data.selections || [] };
  return certificationCore(asParlay);
}

function buildCertifiedCombinadaData(context, optionId, date, generatedAt = new Date().toISOString()) {
  assertCatalogDate(context, date);
  const option = (context.formatOptions?.routes?.combinada?.options || [])
    .find(item => item.optionId === optionId);
  if (
    !option ||
    option.status !== 'READY_FOR_USER_SELECTION' ||
    option.compatibility !== 'COMPATIBLE' ||
    option.quoteMethod !== 'betslip_dom_read' ||
    option.betslipEvidence !== 'live_dom' ||
    !option.domEvidence ||
    !option.combinedOdds
  ) {
    throw new Error(`La combinada ${optionId} no tiene compatibilidad y cuota DOM certificadas.`);
  }
  const candidates = candidateMap(context);
  const matches = catalogMatchMap(context);
  const selections = (option.candidateIds || []).map(id => {
    const entry = candidates.get(id);
    return certifiedPick(entry || {}, matches.get(entry?.discovery?.catalogMatchId));
  });
  if (![2, 3].includes(selections.length)) throw new Error('La combinada debe tener 2 o 3 selecciones.');
  const matchIds = (option.candidateIds || []).map(id => candidates.get(id)?.discovery?.catalogMatchId);
  if (new Set(matchIds).size !== 1) throw new Error('La combinada mezcla partidos distintos.');
  const data = {
    format: 'combinada-de-datos',
    date,
    title: 'COMBINADA DEL PARTIDO',
    subtitle: `Momio ${option.combinedOdds} en PlayDoIt · leido del Bet Builder`,
    combinedOdds: option.combinedOdds,
    musicPreset: 'analysis',
    selections,
    ctaTitle: `¿LE ENTRAS AL MOMIO ${option.combinedOdds}?`,
    ctaText: 'Consulta el analisis completo en data-fut.com',
    probabilityNotice: 'Los porcentajes son respaldos individuales y no representan probabilidad conjunta.',
    disclaimer: 'Estimaciones basadas en datos historicos. No garantizan resultados.',
    provenance: baseProvenance(context, optionId, option.candidateIds, generatedAt)
  };
  data.provenance.certificationHash = hashObject(combinadaCore(data));
  return data;
}

function validateCertifiedCombinadaDataAgainstContext(data, context) {
  const errors = [];
  const warnings = [];
  try {
    const expected = buildCertifiedCombinadaData(
      context,
      data?.provenance?.optionId,
      data?.date,
      data?.provenance?.generatedAt
    );
    const actualCore = combinadaCore(data);
    if (JSON.stringify(canonicalize(actualCore)) !== JSON.stringify(canonicalize(combinadaCore(expected)))) {
      errors.push('La combinada no coincide exactamente con el pipeline certificado.');
    }
    if (data?.provenance?.certificationHash !== hashObject(actualCore)) {
      errors.push('provenance.certificationHash no corresponde a la combinada actual.');
    }
    if (data?.provenance?.certificationHash !== expected.provenance.certificationHash) {
      errors.push('La certificacion de combinada no coincide con los estados oficiales actuales.');
    }
  } catch (error) {
    errors.push(error.message);
  }
  return { errors: [...new Set(errors)], warnings };
}

function validateCertifiedParlayDataAgainstContext(data, context) {
  const result = validateParlayData(data);
  const errors = [...result.errors];
  const warnings = [...result.warnings];

  try {
    if (data?.provenance?.schemaVersion !== 1) errors.push('provenance.schemaVersion debe ser 1.');
    if (data?.provenance?.source !== 'pipeline_state') {
      errors.push('provenance.source debe ser "pipeline_state".');
    }
    const optionId = data?.provenance?.optionId;
    const expected = buildCertifiedParlayData(context, optionId, data?.date, data?.provenance?.generatedAt);
    const expectedCore = certificationCore(expected);
    const actualCore = certificationCore(data);
    if (JSON.stringify(canonicalize(actualCore)) !== JSON.stringify(canonicalize(expectedCore))) {
      errors.push('Los picks o porcentajes no coinciden exactamente con el pipeline certificado.');
    }
    if (data?.provenance?.certificationHash !== hashObject(actualCore)) {
      errors.push('provenance.certificationHash no corresponde al contenido actual.');
    }
    if (data?.provenance?.certificationHash !== expected.provenance.certificationHash) {
      errors.push('La certificacion no coincide con los estados oficiales actuales.');
    }
    if (!String(data?.subtitle || '').includes(expected.combinedOdds)) {
      errors.push('subtitle no contiene el momio combinado certificado.');
    }
  } catch (error) {
    errors.push(error.message);
  }
  return { errors: [...new Set(errors)], warnings };
}

function validateCertifiedParlayData(data, projectDir) {
  const { auditPipelineState } = require('./pipeline-audit');
  const audit = auditPipelineState(projectDir);
  const result = validateCertifiedParlayDataAgainstContext(data, loadCertificationContext(projectDir));
  if (audit.errors.length > 0) {
    result.errors.push(`El audit del pipeline fallo: ${audit.errors.join(' | ')}`);
  }
  return result;
}

function buildCertifiedContent(context, optionId, date, generatedAt = new Date().toISOString()) {
  if (optionId?.startsWith('IND-')) {
    return buildCertifiedIndividualData(context, optionId, date, generatedAt);
  }
  if (optionId?.startsWith('COM-')) {
    return buildCertifiedCombinadaData(context, optionId, date, generatedAt);
  }
  return buildCertifiedParlayData(context, optionId, date, generatedAt);
}

function validateCertifiedContent(data, projectDir) {
  const { auditPipelineState } = require('./pipeline-audit');
  const audit = auditPipelineState(projectDir);
  const context = loadCertificationContext(projectDir);
  let result;
  if (data?.format === 'promo-video') {
    result = validateCertifiedIndividualDataAgainstContext(data, context);
  } else if (data?.format === 'combinada-de-datos') {
    result = validateCertifiedCombinadaDataAgainstContext(data, context);
  } else {
    result = validateCertifiedParlayDataAgainstContext(data, context);
  }
  if (audit.errors.length > 0) {
    result.errors.push(`El audit del pipeline fallo: ${audit.errors.join(' | ')}`);
  }
  return result;
}

module.exports = {
  buildCertifiedCombinadaData,
  buildCertifiedContent,
  buildCertifiedIndividualData,
  buildCertifiedParlayData,
  certificationCore,
  hashObject,
  loadCertificationContext,
  validateCertifiedCombinadaDataAgainstContext,
  validateCertifiedContent,
  validateCertifiedIndividualDataAgainstContext,
  validateCertifiedParlayData,
  validateCertifiedParlayDataAgainstContext
};
