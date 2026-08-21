const v = require('../pipeline-state/verified-candidates.json');

console.log('=== CANDIDATE POOL ANALYSIS (20 ELIGIBLE CANDIDATES) ===\n');

v.results.forEach((res, i) => {
  const req = res.requested;
  const pd = res.playdoit;
  const priceDec = pd.priceDecimal;
  const priceAm = pd.priceAmerican;

  let commercialPriority = 'normal';
  if (priceDec <= 1.15 || (priceAm.startsWith('-') && parseInt(priceAm.slice(1)) >= 500)) {
    commercialPriority = 'very_low (-500 o peor)';
  } else if (priceDec <= 1.33 || (priceAm.startsWith('-') && parseInt(priceAm.slice(1)) >= 300)) {
    commercialPriority = 'low (-300 a -500)';
  } else {
    commercialPriority = 'normal (mejor que -300)';
  }

  console.log(`[${res.candidateId}] Partido: ${req.match}`);
  console.log(`      Mercado: ${req.market} (${req.family})`);
  console.log(`      Respaldo: ${req.percentage}% | Muestra: ${req.sample.home}+${req.sample.away} (${req.sample.home+req.sample.away})`);
  console.log(`      Cuota PlayDoIt: ${pd.oddsText} -> Prioridad Comercial: ${commercialPriority}`);
  console.log(`      Odd ID: ${pd.oddId} | Market ID: ${pd.marketId}\n`);
});
