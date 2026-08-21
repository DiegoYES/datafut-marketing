const fs = require('fs');
const path = require('path');

const allPicks = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_raw_datafut_picks.json'), 'utf8'));

// Filter only matches available in PlayDoIt
const targetMatches = ['LDU Quito vs Mirassol', 'Macará vs Santos', 'Leones FC vs Real Cundinamarca'];
const availableMatchPicks = allPicks.filter(p => targetMatches.includes(p.match));

console.log(`Picks for active PlayDoIt matches: ${availableMatchPicks.length}`);

// Group by match and inspect top picks
targetMatches.forEach(mName => {
  console.log(`\n=== MATCH: ${mName} ===`);
  const list = availableMatchPicks.filter(p => p.match === mName);
  list.sort((a, b) => b.percentage - a.percentage);
  list.forEach(p => {
    // Show non-trivial ones
    if (!/más de 0\.5 goles/i.test(p.rawTitle) && p.percentage !== null) {
      console.log(` - ${p.rawTitle.padEnd(45)} | %: ${p.percentage}% | Muestra: ${p.sampleLine}`);
    }
  });
});
