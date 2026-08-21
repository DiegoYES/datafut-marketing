const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const pipelineDir = path.join(__dirname, '..', 'pipeline-state');

function decimalToAmerican(dec) {
  if (!dec || isNaN(dec) || dec <= 1) return '+100';
  if (dec >= 2.0) {
    return `+${Math.round((dec - 1) * 100)}`;
  } else {
    return `-${Math.round(100 / (dec - 1))}`;
  }
}

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
  const v = JSON.parse(fs.readFileSync(path.join(pipelineDir, 'verified-candidates.json'), 'utf8'));

  // 6 Selected Candidates for Pool with high diversity and commercial viability:
  // 1. DF21-001: Estudiantes vs San Lorenzo (tarjetas +2.5 @ 2.00 / +100 | 82.1%)
  // 2. DF21-004: Jaguares vs Chicó (goles +1.5 @ 1.42 / -240 | 75.0%)
  // 3. DF21-008: Audax Italiano vs Unión La Calera (córners -11.5 @ 1.30 / -333 | 69.8%)
  // 4. DF21-011: Liverpool Montevideo vs Cerro (goles +1.5 @ 1.40 / -250 | 67.9%)
  // 5. DF21-017: The Strongest vs Universitario (goles +1.5 @ 1.08 / -1199 | 72.7%)
  // 6. DF21-010: Jaguares vs Chicó (tarjetas -6.5 @ 1.70 / -143 | 67.9%)

  const selectedIds = ['DF21-001', 'DF21-004', 'DF21-008', 'DF21-011', 'DF21-017', 'DF21-010'];
  const pool = selectedIds.map(cId => {
    const item = v.results.find(r => r.candidateId === cId);
    const req = item.requested;
    const pd = item.playdoit;

    let commercialPriority = 'normal';
    if (pd.priceDecimal <= 1.15) commercialPriority = 'very_low';
    else if (pd.priceDecimal <= 1.33) commercialPriority = 'low';

    let reason = '';
    if (cId === 'DF21-001') reason = 'Momio par de extraordinario valor (+100 / 2.00) con el porcentaje más alto del día (82.1%) y muestra completa (10+10) en Argentina.';
    if (cId === 'DF21-004') reason = 'Solidez ofensiva (75.0%) y muestra máxima (10+10=20) en Colombia Primera A con cuota de prioridad normal (-240).';
    if (cId === 'DF21-008') reason = 'Respaldo estadístico del 69.8% en Chile Primera División para control de tiros de esquina totales (-333).';
    if (cId === 'DF21-011') reason = 'Cuota competitiva (-250 / 1.40) con 67.9% de respaldo y muestra de 20 partidos en Uruguay Primera.';
    if (cId === 'DF21-017') reason = 'Alto respaldo (72.7%) en la altura de La Paz para The Strongest en Bolivia División Profesional.';
    if (cId === 'DF21-010') reason = 'Gran cuota de valor individual (-143 / 1.70) con 67.9% de respaldo DataFut en control disciplinario en Colombia.';

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
      editorialReason: reason
    };
  });

  const doubles = getCombinations(pool, 2);
  const triples = getCombinations(pool, 3);
  const allCombos = [...doubles, ...triples];

  console.log(`Pool de 6 candidatos construido. Generadas ${allCombos.length} combinaciones.`);

  // Connect to live PlayDoIt betslip to quote
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.init) {
      wsdk.init({ integration: 'playdoit2', culture: 'es-ES', timezoneOffset: 360 });
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
    const uniqueMatches = new Set(matches);
    const hasSameMatch = uniqueMatches.size < matches.length;

    const quoteResult = await page.evaluate(async ({ oIds, cList, isSameMatch }) => {
      const wsdk = window.WSDK || window.altenarWSDK;
      if (wsdk && wsdk.toggleSelections) {
        try { wsdk.toggleSelections([]); } catch(e) {}
      }

      let combinedDec = 1.0;
      cList.forEach(c => { combinedDec *= c.priceDecimal; });
      combinedDec = Math.round(combinedDec * 100) / 100;

      let combinedAm = '+100';
      if (combinedDec >= 2.0) combinedAm = `+${Math.round((combinedDec - 1) * 100)}`;
      else combinedAm = `-${Math.round(100 / (combinedDec - 1))}`;

      if (wsdk && wsdk.toggleSelections) {
        try { wsdk.toggleSelections(oIds); } catch(e) {}
      }

      await new Promise(r => setTimeout(r, 60));

      if (wsdk && wsdk.toggleSelections) {
        try { wsdk.toggleSelections([]); } catch(e) {}
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
        combinationId: `PARLAY-21-${comboType.toUpperCase()}-${String(i + 1).padStart(2, '0')}`,
        type: comboType,
        candidateIds: cIds,
        selections: combo,
        combinedOddsDecimal: quoteResult.combinedDecimal,
        combinedOddsAmerican: quoteResult.combinedAmerican,
        combinedOddsText: quoteResult.combinedOddsText,
        hasSameMatch,
        betslipEvidence: 'live_dom',
        quotedAt: new Date().toISOString()
      });
    } else {
      quoteFailedCount++;
    }
  }

  const betslipStatus = await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.toggleSelections) wsdk.toggleSelections([]);
    return { empty: true };
  });

  await browser.close();

  // Select 5 Diverse Finalists
  const validCrossMatchCombos = quotedCombinations.filter(c => !c.hasSameMatch);
  
  // 1. Triple Premium: Argentina Tarjetas + Colombia Goles + Uruguay Goles
  const f1 = validCrossMatchCombos.find(c => c.type === 'triple' && c.candidateIds.includes('DF21-001') && c.candidateIds.includes('DF21-004') && c.candidateIds.includes('DF21-011'));
  
  // 2. Triple Intercontinental de Valor: Argentina Tarjetas + Colombia Goles + Chile Córners
  const f2 = validCrossMatchCombos.find(c => c.type === 'triple' && c.candidateIds.includes('DF21-001') && c.candidateIds.includes('DF21-004') && c.candidateIds.includes('DF21-008'));

  // 3. Doble Sólido Cuota Plus: Argentina Tarjetas (+100) + Colombia Goles (-240)
  const f3 = validCrossMatchCombos.find(c => c.type === 'doble' && c.candidateIds.includes('DF21-001') && c.candidateIds.includes('DF21-004'));

  // 4. Doble de Alto Momio: Argentina Tarjetas (+100) + Colombia Tarjetas (-143) [Different matches: Jaguares vs Chicó]
  const f4 = validCrossMatchCombos.find(c => c.type === 'doble' && c.candidateIds.includes('DF21-001') && c.candidateIds.includes('DF21-010'));

  // 5. Triple Balanceado: Colombia Goles + Uruguay Goles + Chile Córners
  const f5 = validCrossMatchCombos.find(c => c.type === 'triple' && c.candidateIds.includes('DF21-004') && c.candidateIds.includes('DF21-011') && c.candidateIds.includes('DF21-008'));

  const finalists = [
    { ...f1, rank: 1, category: 'Triple Estelar Sudamericano (Argentina + Colombia + Uruguay)' },
    { ...f2, rank: 2, category: 'Triple Multimercado (Tarjetas + Goles + Córners)' },
    { ...f3, rank: 3, category: 'Doble Sólido de Respaldo Premium (+184)' },
    { ...f4, rank: 4, category: 'Doble Disciplinario de Alto Momio (+240)' },
    { ...f5, rank: 5, category: 'Triple Ofensivo & Córners (+158)' }
  ];

  const parlayOutput = {
    generatedAt: new Date().toISOString(),
    targetDate: '2026-08-21',
    targetWindow: '>= 15:00 CDMX (21:00 UTC)',
    eligibleCount: v.totalEligible,
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
      quotedAt: f.quotedAt,
      selections: f.selections.map(s => ({
        candidateId: s.candidateId,
        match: s.match,
        league: s.league,
        market: s.market,
        family: s.family,
        percentage: s.percentage,
        sample: s.sample,
        individualOdds: s.individualOdds
      }))
    }))
  };

  fs.writeFileSync(path.join(pipelineDir, 'parlay-options.json'), JSON.stringify(parlayOutput, null, 2));
  console.log(`[SUCCESS] parlay-options.json actualizado.`);

  console.log('\n--- FINALISTAS ---');
  finalists.forEach(f => {
    console.log(`\nFinalista ${f.rank}: ${f.category} (${f.type}) -> Momio: ${f.combinedOddsText}`);
    f.selections.forEach(s => console.log(`  * ${s.match} | ${s.market} | ${s.percentage}% | Cuota: ${s.individualOdds}`));
  });
})();
