const fs = require('fs');
const path = require('path');

const allPicks = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_raw_datafut_picks.json'), 'utf8'));

console.log(`Total picks available: ${allPicks.length}`);

// Function to check if a pick is trivial
function isTrivialMarket(t) {
  const low = t.toLowerCase();
  
  // Over 0.5 match goals
  if (/más de 0\.5 goles/i.test(low) && !low.includes('local') && !low.includes('visitante') && !low.includes('tiempo') && !low.includes('mitad')) {
    return true;
  }
  
  // Over 0.5 or 1.5 shots on target (trivial if <= 1.5)
  if ((low.includes('tiro a puerta') || low.includes('tiros a puerta')) && low.startsWith('más de')) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }

  // Over 0.5 cards / yellow cards (trivial if <= 0.5)
  if ((low.includes('tarjeta') || low.includes('amarilla')) && low.startsWith('más de')) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 0.5) return true;
  }

  // Over 0.5 / 1.5 corners (trivial if <= 1.5)
  if ((low.includes('córner') || low.includes('corner')) && low.startsWith('más de')) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }

  // Over <= 2.5 fouls (trivial)
  if (low.includes('falta') && low.startsWith('más de')) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 2.5) return true;
  }

  return false;
}

const nonTrivial = allPicks.filter(p => !isTrivialMarket(p.rawTitle) && p.percentage !== null);
console.log(`Non-trivial picks count: ${nonTrivial.length}`);

// Inspect non-trivial picks by match
const byMatch = {};
nonTrivial.forEach(p => {
  if (!byMatch[p.match]) byMatch[p.match] = [];
  byMatch[p.match].push(p);
});

for (const [m, list] of Object.entries(byMatch)) {
  console.log(`\nMatch: ${m} (${list.length} non-trivial picks)`);
  list.sort((a, b) => b.percentage - a.percentage);
  list.slice(0, 10).forEach((p, idx) => {
    console.log(`  [${idx+1}] ${p.rawTitle} (${p.percentage}%) [${p.sampleLine}]`);
  });
}
