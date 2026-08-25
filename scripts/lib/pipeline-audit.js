const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readJson } = require('./validation');
const {
  validateBetslipDomEvidence,
  validateDomMarketEvidence
} = require('./dom-evidence');
const { validateDomSelectorConfig } = require('./dom-selector-config');
const { isTrivialCandidate } = require('./discovery');
const {
  sameCandidateSemantics,
  sha256,
  validateDatafutCard
} = require('./datafut-provenance');
const { classifyMarket, normalizeText } = require('./playdoit-semantics');

function validatePngArtifact(projectDir, screenshot) {
  if (!screenshot || typeof screenshot.path !== 'string') return false;
  const artifactPath = path.resolve(projectDir, screenshot.path);
  if (artifactPath !== projectDir && !artifactPath.startsWith(`${projectDir}${path.sep}`)) return false;
  if (!fs.existsSync(artifactPath)) return false;
  const buffer = fs.readFileSync(artifactPath);
  if (buffer.length < 1024) return false;
  const pngSignature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) return false;
  const actualSha = crypto.createHash('sha256').update(buffer).digest('hex');
  return actualSha === screenshot.sha256;
}

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
    if (catalog.catalogStatus === 'VERIFIED') {
      if (catalog.evidenceSource !== 'live_dom') {
        errors.push('Catalog VERIFIED no puede proceder de API u otra fuente distinta de live_dom.');
      }
      if (
        catalog.domEvidence?.source !== 'live_dom' ||
        catalog.domEvidence?.verificationMethod !== 'dom_observation' ||
        !validatePngArtifact(projectDir, catalog.domEvidence?.screenshot)
      ) {
        errors.push('Catalog VERIFIED carece de una captura PNG DOM autentica y verificable.');
      }
    }

    for (const match of catalog.matches || []) {
      const seenMarkets = new Set();
      for (const market of match.markets || []) {
        const key = [market.marketId, market.subject, market.statistic, market.scope, market.period]
          .map(normalizeText)
          .join('|');
        if (seenMarkets.has(key)) {
          errors.push(`Catalog contiene mercado duplicado en ${match.matchId}: ${market.marketText}.`);
        }
        seenMarkets.add(key);
        const derived = classifyMarket(market.marketText, match.homeTeam, match.awayTeam);
        if (
          !derived.valid ||
          normalizeText(derived.subject) !== normalizeText(market.subject) ||
          derived.statistic !== market.statistic ||
          derived.scope !== market.scope ||
          derived.period !== market.period
        ) {
          errors.push(`Catalog declara semantica que no se deriva de marketText en ${match.matchId}: ${market.marketText}.`);
        }
      }
    }
  }

  const discovery = loadState('discovery-candidates.json');
  if (discovery) {
    const candidates = Array.isArray(discovery.candidates) ? discovery.candidates : [];
    const discoveryById = new Map(candidates.map(candidate => [candidate.candidateId, candidate]));
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
    if (catalog?.catalogStatus !== 'VERIFIED' || catalog?.evidenceSource !== 'live_dom') {
      errors.push('Discovery se genero desde un Catalog que no esta VERIFIED con live_dom.');
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
    const invalidDatafutCards = candidates.filter(candidate => !validateDatafutCard(candidate).valid);
    if (invalidDatafutCards.length > 0) {
      errors.push(
        `${invalidDatafutCards.length} candidato(s) no estan ligados a una tarjeta DataFut integra.`
      );
    }

    const rawRelativePath = discovery.datafutRawPath;
    const rawPath = rawRelativePath ? path.resolve(projectDir, rawRelativePath) : null;
    const insideProject = rawPath && (
      rawPath === projectDir || rawPath.startsWith(`${projectDir}${path.sep}`)
    );
    if (!insideProject || !fs.existsSync(rawPath)) {
      errors.push('Discovery no enlaza una extraccion DataFut local valida.');
    } else {
      const actualRawSha256 = sha256(fs.readFileSync(rawPath));
      if (actualRawSha256 !== discovery.datafutRawSha256) {
        errors.push('La extraccion DataFut cambio despues de generar Discovery.');
      }
      try {
        const rawDocument = readJson(rawPath);
        if (
          !rawDocument ||
          Array.isArray(rawDocument) ||
          rawDocument.datafutSource !== 'authenticated_session_read' ||
          rawDocument.catalogGeneratedAt !== catalog?.generatedAt ||
          rawDocument.targetDate !== catalog?.targetDate ||
          !Array.isArray(rawDocument.matches)
        ) {
          errors.push('La extraccion DataFut no coincide con la fuente, catalogo y fecha oficiales.');
        }
      } catch (error) {
        errors.push(`No se pudo validar la extraccion DataFut: ${error.message}`);
      }
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
      const discoveryById = new Map(
        (discovery?.candidates || []).map(candidate => [candidate.candidateId, candidate])
      );
      const brokenDatafutLinks = eligibleResults.filter(result => {
        const candidate = discoveryById.get(result.candidateId);
        return !candidate ||
          result.datafutCardId !== candidate.datafutCard?.cardId ||
          Number(result.percentage) !== Number(candidate.percentage) ||
          !sameCandidateSemantics(result.requested, candidate);
      });
      if (brokenDatafutLinks.length > 0) {
        errors.push(
          `${brokenDatafutLinks.length} candidato(s) AVAILABLE_EXACT perdieron su vinculo con la tarjeta DataFut.`
        );
      }
      const invalidDomEvidence = eligibleResults.filter(result => {
        const candidate = discoveryById.get(result.candidateId);
        const match = (catalog?.matches || []).find(item => item.matchId === candidate?.catalogMatchId);
        const validation = validateDomMarketEvidence(result.requested, result.domEvidence, match || {});
        return result.evidenceSource !== 'live_dom' || !validation.valid ||
          !validatePngArtifact(projectDir, result.domEvidence?.screenshot);
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
        return finalist.betslipEvidence !== 'live_dom' || !validation.valid ||
          !validatePngArtifact(projectDir, finalist.domEvidence?.screenshot);
      });
      if (invalidBetslipEvidence.length > 0) {
        errors.push(
          `${invalidBetslipEvidence.length} finalista(s) carecen de lectura DOM valida del betslip.`
        );
      }
    }
  }

  const eligiblePool = loadState('eligible-candidates.json');
  const eligiblePoolEntries = Array.isArray(eligiblePool?.candidates)
    ? eligiblePool.candidates
    : [];
  if (eligiblePool) {
    summary.eligiblePool = {
      generatedAt: eligiblePool.generatedAt,
      eligibleCount: Number(eligiblePool.eligibleCount || 0)
    };
    if (!catalog || eligiblePool.catalogGeneratedAt !== catalog.generatedAt) {
      errors.push('El pool elegible pertenece a otro Catalog.');
    }
    if (eligiblePoolEntries.some(item => {
      const match = (catalog?.matches || []).find(entry => entry.matchId === item.discovery?.catalogMatchId);
      const domValidation = validateDomMarketEvidence(
        item.verification?.requested,
        item.verification?.domEvidence,
        match || {}
      );
      return Number(item.discovery?.percentage) <= 70 ||
        item.verification?.status !== 'AVAILABLE_EXACT' ||
        item.verification?.evidenceSource !== 'live_dom' ||
        !validateDatafutCard(item.discovery).valid ||
        item.verification?.datafutCardId !== item.discovery?.datafutCard?.cardId ||
        Number(item.verification?.percentage) !== Number(item.discovery?.percentage) ||
        !sameCandidateSemantics(item.verification?.requested, item.discovery) ||
        !domValidation.valid ||
        !validatePngArtifact(projectDir, item.verification?.domEvidence?.screenshot);
    })) {
      errors.push('El pool elegible contiene candidatos sin cadena integra DataFut → Verification.');
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
    const eligibleById = new Map(eligiblePoolEntries.map(item => [
      item.discovery?.candidateId,
      item
    ]));
    if (individualOptions.some(option => {
      const shown = option.candidate || {};
      const entry = eligibleById.get(shown.candidateId);
      return !entry ||
        shown.catalogMatchId !== entry.discovery?.catalogMatchId ||
        normalizeText(shown.match) !== normalizeText(entry.discovery?.match) ||
        normalizeText(shown.market) !== normalizeText(entry.discovery?.market) ||
        Number(shown.percentage) !== Number(entry.discovery?.percentage) ||
        shown.individualOdds !== entry.verification?.playdoit?.oddsText;
    })) {
      errors.push('Una opcion individual no coincide exactamente con el pool elegible.');
    }
    const unknownOptionCandidates = [...parlayCandidates, ...combinadaCandidates]
      .flatMap(option => option.candidateIds || [])
      .filter(candidateId => !eligibleById.has(candidateId));
    if (unknownOptionCandidates.length > 0) {
      errors.push('Las opciones de formato contienen candidatos ajenos al pool elegible.');
    }
    if (parlayCandidates.some(option => {
      const matchIds = Array.isArray(option.matchIds) ? option.matchIds : [];
      return matchIds.length < 2 || new Set(matchIds).size !== matchIds.length;
    })) {
      errors.push('Una opcion de parlay normal mezcla piernas del mismo partido.');
    }
    if (parlayCandidates.some(option => {
      if (option.status !== 'READY_FOR_USER_SELECTION') return false;
      const key = [...(option.candidateIds || [])].sort().join('|');
      const finalist = (parlays?.finalists || []).find(item =>
        [...(item.candidateIds || [])].sort().join('|') === key
      );
      return option.quoteMethod !== 'betslip_dom_read' ||
        !option.combinedOdds ||
        !finalist ||
        finalist.quoteMethod !== 'betslip_dom_read' ||
        finalist.combinedOddsText !== option.combinedOdds;
    })) {
      errors.push('Una opcion de parlay READY no coincide con un finalista DOM oficial.');
    }
    if (combinadaCandidates.some(option =>
      option.compatibility === 'COMPATIBLE' &&
      (
        option.quoteMethod !== 'betslip_dom_read' ||
        option.betslipEvidence !== 'live_dom' ||
        !option.combinedOdds ||
        !validateBetslipDomEvidence(option.candidateIds, option.domEvidence).valid ||
        !validatePngArtifact(projectDir, option.domEvidence?.screenshot)
      )
    )) {
      errors.push('Una combinada se declara compatible sin evidencia DOM integra del Bet Builder.');
    }
  }

  const hasPublishableCandidates = verified && Number(verified.totalEligible || 0) > 0;
  const hasFinalists = parlays && Array.isArray(parlays.finalists) && parlays.finalists.length > 0;
  if ((hasPublishableCandidates || hasFinalists) && !selectorValidation.valid) {
    errors.push('La configuracion de selectores DOM no esta verificada para automatizacion publicable.');
  }
  if (
    selectorValidation.valid &&
    !validatePngArtifact(projectDir, {
      path: selectorConfig.verification?.screenshotPath,
      sha256: selectorConfig.verification?.screenshotSha256
    })
  ) {
    errors.push('La prueba de selectores no apunta a una captura PNG autentica y verificable.');
  }

  return { errors, warnings, summary };
}

module.exports = { auditPipelineState, validatePngArtifact };
