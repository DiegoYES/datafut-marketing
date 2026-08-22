const fs = require('fs');
const path = require('path');
const { readJson } = require('./validation');
const {
  validateBetslipDomEvidence,
  validateDomMarketEvidence
} = require('./dom-evidence');
const { validateDomSelectorConfig } = require('./dom-selector-config');
const { isTrivialCandidate } = require('./discovery');

function auditPipelineState(projectDir) {
  const stateDir = path.join(projectDir, 'pipeline-state');
  const errors = [];
  const warnings = [];
  const summary = {};
  const selectorConfigPath = path.join(projectDir, 'config', 'playdoit-dom.json');
  const selectorConfig = readJson(selectorConfigPath);
  const selectorValidation = validateDomSelectorConfig(selectorConfig);
  summary.domSelectors = {
    status: selectorConfig.status,
    valid: selectorValidation.valid
  };

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

  const discovery = loadState('discovery-candidates.json');
  if (discovery) {
    const candidates = Array.isArray(discovery.candidates) ? discovery.candidates : [];
    summary.discovery = {
      generatedAt: discovery.generatedAt,
      catalogGeneratedAt: discovery.catalogGeneratedAt,
      datafutSource: discovery.datafutSource,
      candidates: candidates.length,
      publishable: discovery.publishable === true
    };

    if (!catalog || discovery.catalogGeneratedAt !== catalog.generatedAt) {
      errors.push('Discovery no esta vinculado al catalogo PlayDoIt actual.');
    }
    if (discovery.datafutSource !== 'authenticated_session_read') {
      errors.push('Discovery no declara datafutSource="authenticated_session_read".');
    }
    if (discovery.publishable === true) {
      errors.push('Discovery no puede declararse publicable antes de Verification.');
    }
    if (discovery.percentageThresholdExclusive !== 70) {
      errors.push('Discovery no declara percentageThresholdExclusive=70.');
    }
    if (candidates.some(candidate => Number(candidate.percentage) <= 70)) {
      errors.push('Discovery contiene candidatos con porcentaje menor o igual a 70%.');
    }
    if (candidates.some(candidate => isTrivialCandidate(candidate))) {
      errors.push('Discovery contiene mercados over triviales que debieron filtrarse antes de Verification.');
    }
    if (candidates.some(candidate => candidate.status === 'AVAILABLE_EXACT')) {
      errors.push('Discovery no puede declarar AVAILABLE_EXACT.');
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
      if (!discovery || verified.discoveryGeneratedAt !== discovery.generatedAt) {
        errors.push('Verification pertenece a otra ronda o no enlaza el Discovery actual.');
      }
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
      if (eligibleResults.some(result => Number(result.percentage) <= 70)) {
        errors.push('Verification declara elegible un candidato con porcentaje menor o igual a 70%.');
      }
      const invalidDomEvidence = eligibleResults.filter(result => {
        const validation = validateDomMarketEvidence(result.requested, result.domEvidence);
        return result.evidenceSource !== 'live_dom' || !validation.valid;
      });
      if (invalidDomEvidence.length > 0) {
        errors.push(
          `${invalidDomEvidence.length} candidato(s) AVAILABLE_EXACT carecen de evidencia DOM valida.`
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
      if (!verified || parlays.verificationGeneratedAt !== verified.verifiedAt) {
        errors.push('Parlay Builder pertenece a otra verificacion o no declara su procedencia.');
      }
      if (parlays.quoteMethod !== 'betslip_dom_read') {
        errors.push('Los finalistas no declaran quoteMethod="betslip_dom_read".');
      }
      if (parlays.publishable !== true) {
        errors.push('Hay finalistas, pero parlay-options.json no declara publishable=true.');
      }
      const invalidBetslipEvidence = finalists.filter(finalist => {
        const validation = validateBetslipDomEvidence(finalist.candidateIds, finalist.domEvidence);
        return finalist.betslipEvidence !== 'live_dom' || !validation.valid;
      });
      if (invalidBetslipEvidence.length > 0) {
        errors.push(
          `${invalidBetslipEvidence.length} finalista(s) carecen de lectura DOM valida del betslip.`
        );
      }
    }
  }

  const eligiblePool = loadState('eligible-candidates.json');
  if (eligiblePool) {
    summary.eligiblePool = {
      generatedAt: eligiblePool.generatedAt,
      eligibleCount: Number(eligiblePool.eligibleCount || 0)
    };
    if (!catalog || eligiblePool.catalogGeneratedAt !== catalog.generatedAt) {
      errors.push('El pool elegible pertenece a otro Catalog.');
    }
    const accumulated = Array.isArray(eligiblePool.candidates) ? eligiblePool.candidates : [];
    if (accumulated.some(item =>
      Number(item.discovery?.percentage) <= 70 ||
      item.verification?.status !== 'AVAILABLE_EXACT' ||
      item.verification?.evidenceSource !== 'live_dom'
    )) {
      errors.push('El pool elegible contiene candidatos que no cumplen >70%, AVAILABLE_EXACT y live_dom.');
    }
  }

  const formatOptions = loadState('format-options.json');
  if (formatOptions) {
    const individualOptions = formatOptions.routes?.individual?.options || [];
    const parlayCandidates = formatOptions.routes?.parlay?.options || [];
    const combinadaCandidates = formatOptions.routes?.combinada?.options || [];
    summary.formats = {
      generatedAt: formatOptions.generatedAt,
      individual: individualOptions.length,
      parlay: parlayCandidates.length,
      combinada: combinadaCandidates.length,
      userSelectionRequired: formatOptions.userSelectionRequired === true,
      publishable: formatOptions.publishable === true
    };

    const linkedToEligiblePool =
      eligiblePool &&
      formatOptions.eligiblePoolGeneratedAt === eligiblePool.generatedAt;
    const linkedToCurrentVerification =
      verified &&
      formatOptions.verificationGeneratedAt === verified.verifiedAt;
    if (!linkedToEligiblePool && !linkedToCurrentVerification) {
      errors.push('Las opciones de formato no pertenecen al pool elegible ni a la Verification actual.');
    }
    if (formatOptions.userSelectionRequired !== true) {
      errors.push('Las opciones de formato deben exigir eleccion humana.');
    }
    if (formatOptions.publishable === true) {
      errors.push('Las opciones de formato no pueden ser publicables antes de la eleccion humana.');
    }
    if (parlayCandidates.some(option => {
      const matchIds = Array.isArray(option.matchIds) ? option.matchIds : [];
      return matchIds.length < 2 || new Set(matchIds).size !== matchIds.length;
    })) {
      errors.push('Una opcion de parlay normal mezcla piernas del mismo partido.');
    }
    if (combinadaCandidates.some(option =>
      option.compatibility === 'COMPATIBLE' &&
      (option.quoteMethod !== 'betslip_dom_read' || !option.combinedOdds)
    )) {
      errors.push('Una combinada se declara compatible sin cuota real leida del Bet Builder.');
    }
  }

  const hasPublishableCandidates = verified && Number(verified.totalEligible || 0) > 0;
  const hasFinalists = parlays && Array.isArray(parlays.finalists) && parlays.finalists.length > 0;
  if ((hasPublishableCandidates || hasFinalists) && !selectorValidation.valid) {
    errors.push('La configuracion de selectores DOM no esta verificada para automatizacion publicable.');
  }

  return { errors, warnings, summary };
}

module.exports = { auditPipelineState };
