const path = require('node:path');
const { auditPipelineState } = require('./lib/pipeline-audit');
const { loadCertificationContext } = require('./lib/certified-content');

const projectDir = path.resolve(__dirname, '..');
const audit = auditPipelineState(projectDir);
if (audit.errors.length > 0) {
  throw new Error(`No se pueden presentar finalistas:\n- ${audit.errors.join('\n- ')}`);
}

const context = loadCertificationContext(projectDir);
const pool = new Map((context.eligiblePool.candidates || []).map(entry => [
  entry.discovery.candidateId,
  entry
]));
const output = {
  generatedAt: new Date().toISOString(),
  source: 'pipeline_state_certified_only',
  eligiblePoolGeneratedAt: context.eligiblePool.generatedAt,
  individual: (context.formatOptions.routes?.individual?.options || []).map(option => {
    const entry = pool.get(option.candidate.candidateId);
    return {
      optionId: option.optionId,
      candidateId: entry.discovery.candidateId,
      match: entry.discovery.match,
      market: entry.discovery.market,
      percentage: entry.discovery.percentage,
      sample: entry.discovery.sample,
      odds: entry.verification.playdoit.oddsText,
      datafutCardId: entry.discovery.datafutCard.cardId
    };
  }),
  parlays: (context.formatOptions.routes?.parlay?.options || [])
    .filter(option => option.status === 'READY_FOR_USER_SELECTION')
    .map(option => ({
      optionId: option.optionId,
      candidateIds: option.candidateIds,
      combinedOdds: option.combinedOdds,
      quoteMethod: option.quoteMethod,
      selections: option.candidateIds.map(id => {
        const entry = pool.get(id);
        return {
          candidateId: id,
          match: entry.discovery.match,
          market: entry.discovery.market,
          percentage: entry.discovery.percentage,
          datafutCardId: entry.discovery.datafutCard.cardId
        };
      })
    })),
  combinadas: (context.formatOptions.routes?.combinada?.options || [])
    .filter(option => option.status === 'READY_FOR_USER_SELECTION')
    .map(option => ({
      optionId: option.optionId,
      candidateIds: option.candidateIds,
      combinedOdds: option.combinedOdds,
      quoteMethod: option.quoteMethod,
      selections: option.candidateIds.map(id => {
        const entry = pool.get(id);
        return {
          candidateId: id,
          match: entry.discovery.match,
          market: entry.discovery.market,
          percentage: entry.discovery.percentage,
          datafutCardId: entry.discovery.datafutCard.cardId
        };
      })
    }))
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`\n================================================================================`);
  console.log(`                     FINALISTAS CERTIFICADOS DATAFUT`);
  console.log(`================================================================================\n`);
  
  if (output.parlays.length > 0) {
    console.log(`🎯 PARLAYS (Momio oficial leído de PlayDoIt):`);
    console.log(`--------------------------------------------------------------------------------`);
    output.parlays.forEach((p, idx) => {
      const type = p.candidateIds.length === 2 ? 'Doble' : 'Triple 🔥';
      console.log(`[${idx + 1}] Opción: ${p.optionId} (${type} | Momio: ${p.combinedOdds})`);
      p.selections.forEach((s, sIdx) => {
        console.log(`    ${sIdx + 1}. ${s.match}: ${s.market} (${s.percentage}%)`);
      });
      console.log('');
    });
  }

  if (output.individual.length > 0) {
    console.log(`📌 PICKS INDIVIDUALES:`);
    console.log(`--------------------------------------------------------------------------------`);
    output.individual.forEach((ind, idx) => {
      console.log(`[${String.fromCharCode(65 + idx)}] ${ind.optionId} | ${ind.match}: ${ind.market} | ${ind.percentage}% | Momio: ${ind.odds}`);
    });
    console.log('');
  }

  console.log(`================================================================================`);
  console.log(`Para elegir y congelar usa:`);
  console.log(`  npm run datafut -- freeze-content --option <optionId> --date ${context.catalog.targetDate}`);
  console.log(`================================================================================\n`);
}
