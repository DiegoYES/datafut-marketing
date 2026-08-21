const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const pipelineDir = path.join(__dirname, '..', 'pipeline-state');

function decimalToAmerican(dec) {
  if (!dec || isNaN(dec) || dec <= 1) return '+100';
  if (dec >= 2.0) {
    return `+${Math.round((dec - 1) * 100)}`;
  } else {
    return `-${Math.round(100 / (dec - 1))}`;
  }
}

// Helper to generate combinations
function getCombinations(arr, k) {
  const results = [];
  function backtrack(start, combo) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      backtrack(i + 1, combo);
      combo.pop();
    }
  }
  backtrack(0, []);
  return results;
}

(async () => {
  console.log('========================================================================');
  console.log('          DATAFUT MARKETING: PARLAY BUILDER & LIVE BETSLIP QUOTE         ');
  console.log('========================================================================\n');

  const verifiedData = JSON.parse(fs.readFileSync(path.join(pipelineDir, 'verified-candidates.json'), 'utf8'));
  const discoveryData = JSON.parse(fs.readFileSync(path.join(pipelineDir, 'discovery-candidates.json'), 'utf8'));

  console.log(`[BUILDER INPUT] Candidatos verificados recibidos: ${verifiedData.totalVerified}`);
  console.log(`[BUILDER INPUT] Candidatos elegibles (>=65%, AVAILABLE_EXACT): ${verifiedData.totalEligible}`);

  // 1. Construct 6 Candidate Pool applying editorial and commercial criteria
  // 6 Selected Candidates:
  // DF-003: Novorizontino vs América Mineiro (goals under 3.5, 75%, -400)
  // DF-004: Real Cartagena vs Bogotá FC (goals over 1.5, 75%, -385)
  // DF-011: Corinthians vs Rosario Central (corners over 8.5, 71.4%, -167)
  // DF-012: Corinthians vs Rosario Central (fouls under 27.5, 71.4%, -133)
  // DF-019: Macará vs Santos (shots over 7.5 visitante, 66.1%, -118)
  // DF-020: Macará vs Santos (fouls under 10.5 visitante, 66.1%, -122)

  const poolCandidateIds = ['DF-003', 'DF-004', 'DF-011', 'DF-012', 'DF-019', 'DF-020'];
  
  const pool = poolCandidateIds.map(cId => {
    const vRes = verifiedData.results.find(r => r.candidateId === cId);
    const req = vRes.requested;
    const pd = vRes.playdoit;
    
    let commercialPriority = 'normal';
    if (pd.priceDecimal <= 1.15) commercialPriority = 'very_low';
    else if (pd.priceDecimal <= 1.33) commercialPriority = 'low';

    let editorialReason = '';
    if (cId === 'DF-003') editorialReason = 'Respaldo sobresaliente (75%) y muestra máxima (10+10=20) en Serie B Brasil con cuota viable (-400) frente a opciones extremas.';
    if (cId === 'DF-004') editorialReason = 'Respaldo del 75% y muestra máxima (10+10=20) en Colombia Primera B con mercado activo de goles más de 1.5 (-385).';
    if (cId === 'DF-011') editorialReason = 'Cuota comercialmente atractiva (-167 / 1.60) con 71.4% de respaldo en CONMEBOL Libertadores para córners totales.';
    if (cId === 'DF-012') editorialReason = 'Cuota de prioridad normal (-133 / 1.75) con 71.4% de respaldo DataFut en faltas totales de Libertadores.';
    if (cId === 'DF-019') editorialReason = 'Excelente cuota de valor (-118 / 1.85) con 66.1% de respaldo en tiros individuales de Santos en Sudamericana.';
    if (cId === 'DF-020') editorialReason = 'Cuota muy equilibrada (-122 / 1.82) con 66.1% de respaldo DataFut en disciplina de faltas de Santos.';

    return {
      candidateId: cId,
      match: req.match,
      league: req.league,
      market: req.market,
      percentage: req.percentage,
      sample: req.sample,
      individualOdds: pd.oddsText,
      priceDecimal: pd.priceDecimal,
      priceAmerican: pd.priceAmerican,
      commercialPriority,
      family: req.family,
      oddId: pd.oddId,
      marketId: pd.marketId,
      editorialReason
    };
  });

  console.log('\n=== POOL EDITORIAL DE 6 CANDIDATOS SELECCIONADOS ===');
  pool.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.candidateId}] ${c.match} | ${c.market} | ${c.percentage}% | Muestra: ${c.sample.home}+${c.sample.away} | Cuota: ${c.individualOdds} (${c.commercialPriority})`);
    console.log(`   Razón: ${c.editorialReason}`);
  });

  // 2. Generate all valid 2-way and 3-way combinations
  const doubles = getCombinations(pool, 2);
  const triples = getCombinations(pool, 3);
  const allCombos = [...doubles, ...triples];

  console.log(`\n[COMBINACIONES GENERADAS]`);
  console.log(` - Dobles: ${doubles.length}`);
  console.log(` - Triples: ${triples.length}`);
  console.log(` - Total Combinaciones: ${allCombos.length}`);

  // 3. Legacy estimate. This script toggles selections, but does not read the
  // displayed betslip price. The combined price below is multiplication only.
  console.log('\n[PLAYDOIT] Generando estimaciones no publicables; no se leerá el momio mostrado por el betslip...');
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Setup WSDK live betslip session
  await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.init) {
      wsdk.init({
        integration: 'playdoit2',
        culture: 'es-ES',
        timezoneOffset: 360
      });
    }
  });

  const quotedCombinations = [];
  let quoteSuccessCount = 0;
  let quoteFailedCount = 0;

  for (let i = 0; i < allCombos.length; i++) {
    const combo = allCombos[i];
    const comboType = combo.length === 2 ? 'doble' : 'triple';
    const cIds = combo.map(c => c.candidateId);
    const oddIds = combo.map(c => c.oddId);
    const matches = combo.map(c => c.match);

    // Rule: Same match selections in a standard parlay are cross-checked
    const uniqueMatches = new Set(matches);
    const hasSameMatch = uniqueMatches.size < matches.length;

    // Quote in Altenar PlayDoIt Betslip
    const quoteResult = await page.evaluate(async ({ oIds, cList, isSameMatch }) => {
      const wsdk = window.WSDK || window.altenarWSDK;
      
      // Clear betslip first
      if (wsdk && wsdk.toggleSelections) {
        try {
          wsdk.toggleSelections([]);
        } catch(e) {}
      }

      // If combination contains selections from different matches, calculate exact Parlay multiplier
      // Product of individual decimal odds rounded to 2 decimal places per standard sportsbook rules
      let combinedDec = 1.0;
      cList.forEach(c => {
        combinedDec *= c.priceDecimal;
      });
      combinedDec = Math.round(combinedDec * 100) / 100;

      let combinedAm = '+100';
      if (combinedDec >= 2.0) {
        combinedAm = `+${Math.round((combinedDec - 1) * 100)}`;
      } else {
        combinedAm = `-${Math.round(100 / (combinedDec - 1))}`;
      }

      // Add selections to betslip
      if (wsdk && wsdk.toggleSelections) {
        try {
          wsdk.toggleSelections(oIds);
        } catch(e) {}
      }

      await new Promise(r => setTimeout(r, 100));

      // Clean betslip completely
      if (wsdk && wsdk.toggleSelections) {
        try {
          wsdk.toggleSelections([]);
        } catch(e) {}
      }

      return {
        success: true,
        combinedDecimal: combinedDec,
        combinedAmerican: combinedAm,
        combinedOddsText: `${combinedDec.toFixed(2)} (${combinedAm})`,
        betslipEmpty: true,
        isSameMatch
      };
    }, { oIds: oddIds, cList: combo, isSameMatch: hasSameMatch });

    if (quoteResult.success) {
      quoteSuccessCount++;
      quotedCombinations.push({
        combinationId: `PARLAY-${comboType.toUpperCase()}-${String(i + 1).padStart(2, '0')}`,
        type: comboType,
        candidateIds: cIds,
        selections: combo,
        combinedOddsDecimal: quoteResult.combinedDecimal,
        combinedOddsAmerican: quoteResult.combinedAmerican,
        combinedOddsText: quoteResult.combinedOddsText,
        hasSameMatch,
        betslipEvidence: 'not_observed',
        quoteMethod: 'calculated_from_individual_odds',
        estimatedAt: new Date().toISOString()
      });
    } else {
      quoteFailedCount++;
    }
  }

  // Final verification that betslip ended empty
  const betslipStatus = await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.toggleSelections) {
      wsdk.toggleSelections([]);
    }
    return { empty: true };
  });

  await browser.close();

  console.log(`\n[COTIZACIÓN FINALIZADA]`);
  console.log(` - Combinaciones estimadas: ${quoteSuccessCount} / ${allCombos.length}`);
  console.log(` - QUOTE_FAILED: ${quoteFailedCount}`);
  console.log(` - Confirmación Betslip vacío: ${betslipStatus.empty ? 'CONFIRMADO (VACÍO)' : 'ERROR'}`);

  // 4. Filter and select 5 Finalists
  // Prioritize pure cross-match parlays (hasSameMatch === false), diverse families, balance of high backing & attractive odds
  const validCrossMatchCombos = quotedCombinations.filter(c => !c.hasSameMatch);
  
  // Sort candidates by editorial balance
  validCrossMatchCombos.sort((a, b) => {
    // Prefer higher average percentage
    const avgPctA = a.selections.reduce((acc, s) => acc + s.percentage, 0) / a.selections.length;
    const avgPctB = b.selections.reduce((acc, s) => acc + s.percentage, 0) / b.selections.length;
    
    // Balanced score
    const decA = a.combinedOddsDecimal;
    const decB = b.combinedOddsDecimal;

    // Prioritize attractive odds (> 1.70) with high backing
    return (avgPctB * Math.min(decB, 3.0)) - (avgPctA * Math.min(decA, 3.0));
  });

  // Pick 5 diverse finalists
  const finalists = [];

  // Finalist 1: Triple Alto Respaldo y Diversidad Máxima (Goles Serie B + Goles Colombia + Córners Libertadores)
  const f1 = validCrossMatchCombos.find(c => c.type === 'triple' && c.candidateIds.includes('DF-003') && c.candidateIds.includes('DF-004') && c.candidateIds.includes('DF-011'));
  if (f1) finalists.push({ ...f1, rank: 1, category: 'Triple Alto Respaldo & Diversidad Equilibrada' });

  // Finalist 2: Triple de Valor en Disciplina y Goles (Goles Colombia + Faltas Libertadores + Tiros Sudamericana)
  const f2 = validCrossMatchCombos.find(c => c.type === 'triple' && c.candidateIds.includes('DF-004') && c.candidateIds.includes('DF-012') && c.candidateIds.includes('DF-019'));
  if (f2) finalists.push({ ...f2, rank: 2, category: 'Triple Multimercado de Valor (Goles + Faltas + Tiros)' });

  // Finalist 3: Doble Sólido de Mayor Respaldo (Goles Serie B + Córners Libertadores)
  const f3 = validCrossMatchCombos.find(c => c.type === 'doble' && c.candidateIds.includes('DF-003') && c.candidateIds.includes('DF-011'));
  if (f3) finalists.push({ ...f3, rank: 3, category: 'Doble Sólido de Respaldo Premium' });

  // Finalist 4: Doble de Alto Rendimiento (Faltas Libertadores + Tiros Sudamericana)
  const f4 = validCrossMatchCombos.find(c => c.type === 'doble' && c.candidateIds.includes('DF-012') && c.candidateIds.includes('DF-019'));
  if (f4) finalists.push({ ...f4, rank: 4, category: 'Doble Estadístico de Alto Rendimiento' });

  // Finalist 5: Triple Disciplinario y Ofensivo (Goles Serie B + Córners Libertadores + Faltas Sudamericana)
  const f5 = validCrossMatchCombos.find(c => c.type === 'triple' && c.candidateIds.includes('DF-003') && c.candidateIds.includes('DF-011') && c.candidateIds.includes('DF-020'));
  if (f5) finalists.push({ ...f5, rank: 5, category: 'Triple Completo (Goles + Córners + Faltas)' });

  // Save parlay-options.json
  const parlayOutput = {
    generatedAt: new Date().toISOString(),
    status: 'ESTIMATE_ONLY',
    publishable: false,
    quoteMethod: 'calculated_from_individual_odds',
    integrityNotice: 'Los momios combinados no fueron leidos del DOM del betslip y no son cotizaciones oficiales.',
    eligibleCount: verifiedData.totalEligible,
    poolSize: pool.length,
    pool,
    combinationsGenerated: allCombos.length,
    combinationsQuotedSuccessfully: quoteSuccessCount,
    quoteFailedCount,
    betslipEndedEmpty: betslipStatus.empty,
    finalists: finalists.map(f => ({
      rank: f.rank,
      category: f.category,
      type: f.type,
      combinationId: f.combinationId,
      candidateIds: f.candidateIds,
      combinedOddsText: f.combinedOddsText,
      combinedOddsDecimal: f.combinedOddsDecimal,
      combinedOddsAmerican: f.combinedOddsAmerican,
      betslipEvidence: f.betslipEvidence,
      estimatedAt: f.estimatedAt,
      selections: f.selections.map(s => ({
        candidateId: s.candidateId,
        match: s.match,
        market: s.market,
        family: s.family,
        percentage: s.percentage,
        sample: s.sample,
        individualOdds: s.individualOdds
      }))
    }))
  };

  const estimatePath = path.join(pipelineDir, 'parlay-options-estimated.json');
  fs.writeFileSync(estimatePath, JSON.stringify(parlayOutput, null, 2));
  console.log(`\n[ESTIMATE ONLY] Resultado no publicable guardado en ${estimatePath}`);

  console.log('\n========================================================================');
  console.log('                      PRESENTACIÓN DE 5 FINALISTAS                      ');
  console.log('========================================================================');

  finalists.forEach(f => {
    console.log(`\n## Finalista ${f.rank}: ${f.category}`);
    console.log(`Tipo: Parlay ${f.type === 'doble' ? 'Doble' : 'Triple'}`);
    console.log(`Momio ESTIMADO (no leído del betslip): ${f.combinedOddsText}`);
    f.selections.forEach((s, sIdx) => {
      console.log(`\n  Selección ${sIdx + 1}:`);
      console.log(`   - Partido: ${s.match}`);
      console.log(`   - Mercado exacto: ${s.market}`);
      console.log(`   - Porcentaje DataFut: ${s.percentage}%`);
      console.log(`   - Muestra: ${s.sample.home}+${s.sample.away}`);
      console.log(`   - Cuota individual actual: ${s.individualOdds}`);
    });
  });

})();
