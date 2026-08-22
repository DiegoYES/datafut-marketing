function combinations(items, size) {
  const output = [];

  function visit(start, selected) {
    if (selected.length === size) {
      output.push([...selected]);
      return;
    }

    for (let index = start; index < items.length; index += 1) {
      selected.push(items[index]);
      visit(index + 1, selected);
      selected.pop();
    }
  }

  visit(0, []);
  return output;
}

function candidateView(result, discoveryById) {
  const discovered = discoveryById.get(result.candidateId) || {};
  return {
    candidateId: result.candidateId,
    catalogMatchId: discovered.catalogMatchId || null,
    match: result.requested?.match || discovered.match || null,
    market: discovered.market || result.playdoit?.selectionText || null,
    percentage: Number(result.percentage ?? discovered.percentage),
    sample: discovered.sample || null,
    individualOdds: result.playdoit?.oddsText || discovered.playdoitOddsText || null
  };
}

function buildFormatOptions(discovery, verification, generatedAt = new Date().toISOString()) {
  const discoveryById = new Map(
    (discovery.candidates || []).map(candidate => [candidate.candidateId, candidate])
  );
  const eligible = (verification.results || [])
    .filter(result =>
      result.status === 'AVAILABLE_EXACT' &&
      result.editorialEligible === true &&
      Number(result.percentage) > 70
    )
    .map(result => candidateView(result, discoveryById));

  const individual = eligible.map(candidate => ({
    optionId: `IND-${candidate.candidateId}`,
    status: 'READY_FOR_USER_SELECTION',
    candidate
  }));

  const parlayCandidates = [];
  for (const size of [2, 3]) {
    for (const legs of combinations(eligible, size)) {
      const matchIds = legs.map(leg => leg.catalogMatchId || leg.match);
      if (new Set(matchIds).size !== legs.length) continue;
      parlayCandidates.push({
        optionId: `PAR-${legs.map(leg => leg.candidateId).join('-')}`,
        candidateIds: legs.map(leg => leg.candidateId),
        matchIds,
        status: 'REQUIRES_BETSLIP_QUOTE',
        quoteMethod: null,
        combinedOdds: null
      });
    }
  }

  const byMatch = new Map();
  for (const candidate of eligible) {
    const matchId = candidate.catalogMatchId || candidate.match;
    if (!byMatch.has(matchId)) byMatch.set(matchId, []);
    byMatch.get(matchId).push(candidate);
  }

  const combinadaCandidates = [];
  for (const [matchId, candidates] of byMatch) {
    for (const size of [2, 3]) {
      for (const legs of combinations(candidates, size)) {
        combinadaCandidates.push({
          optionId: `COM-${legs.map(leg => leg.candidateId).join('-')}`,
          candidateIds: legs.map(leg => leg.candidateId),
          matchId,
          match: legs[0].match,
          status: 'REQUIRES_BET_BUILDER_CHECK',
          compatibility: 'NOT_CHECKED',
          quoteMethod: null,
          combinedOdds: null
        });
      }
    }
  }

  return {
    generatedAt,
    discoveryGeneratedAt: discovery.generatedAt,
    verificationGeneratedAt: verification.verifiedAt,
    userSelectionRequired: true,
    publishable: false,
    routes: {
      individual: {
        status: individual.length > 0 ? 'READY' : 'NO_OPTIONS',
        options: individual
      },
      parlay: {
        status: parlayCandidates.length > 0
          ? 'REQUIRES_BETSLIP_QUOTE'
          : 'INSUFFICIENT_DISTINCT_MATCHES',
        rule: 'Cada pierna debe pertenecer a un partido distinto.',
        options: parlayCandidates
      },
      combinada: {
        status: combinadaCandidates.length > 0
          ? 'REQUIRES_BET_BUILDER_CHECK'
          : 'INSUFFICIENT_SAME_MATCH_MARKETS',
        rule: 'Las piernas comparten partido y requieren compatibilidad y cuota reales del Bet Builder.',
        options: combinadaCandidates
      }
    }
  };
}

function buildFormatOptionsFromEligiblePool(pool, generatedAt = new Date().toISOString()) {
  const entries = Array.isArray(pool.candidates) ? pool.candidates : [];
  const output = buildFormatOptions({
    generatedAt: null,
    candidates: entries.map(entry => entry.discovery)
  }, {
    verifiedAt: null,
    results: entries.map(entry => entry.verification)
  }, generatedAt);
  output.eligiblePoolGeneratedAt = pool.generatedAt;
  return output;
}

module.exports = { buildFormatOptions, buildFormatOptionsFromEligiblePool, combinations };
