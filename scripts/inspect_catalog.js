const catalog = require('../pipeline-state/playdoit-catalog.json');

console.log('=== PLAYDOIT CATALOG SUMMARY ===');
console.log('Generated At:', catalog.generatedAt);
console.log('Catalog Status:', catalog.catalogStatus);
console.log('Evidence Source:', catalog.evidenceSource);
console.log('Navigation Mode:', catalog.navigationMode);
console.log('Total Matches Cataloged:', catalog.totalMatchesCataloged);

catalog.matches.forEach(m => {
  console.log(`\nMatch [${m.matchId}] ${m.homeTeam} vs ${m.awayTeam} (Raw: ${m.totalRawMarkets}, Structured: ${m.markets.length})`);
  const families = [...new Set(m.markets.map(x => x.family))];
  console.log('  Families:', families.join(', '));
  m.markets.forEach(mkt => {
    const dStr = (mkt.directions || []).map(d => d.direction + ': [' + d.lines.map(l => l.line + ' (' + l.oddsText + ')').join(', ') + ']').join(' | ');
    if (dStr) console.log('    - ' + mkt.marketText + ' (' + mkt.statistic + ', ' + mkt.scope + '): ' + dStr);
  });
});
