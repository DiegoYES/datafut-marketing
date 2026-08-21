const v = require('../pipeline-state/verified-candidates.json');

console.log('=== ALL 20 VERIFIED CANDIDATES ===');
v.results.forEach((res, i) => {
  const req = res.requested;
  const pd = res.playdoit;
  console.log(`[${i+1}] ${res.candidateId} | ${req.match} | ${req.market} | ${req.percentage}% | Cuota: ${pd.oddsText} | Fam: ${req.family} | Muestra: ${req.sample.home}+${req.sample.away}`);
});
