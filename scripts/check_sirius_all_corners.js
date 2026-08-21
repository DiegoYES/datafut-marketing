const fs = require('fs');
const path = require('path');

const dfScraped = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));
const sirius = dfScraped.find(m => m.title.includes('Sirius') || m.header.includes('Sirius'));

console.log('=== ALL CORNERS & GOALS PICKS FOR SIRIUS IN DATAFUT ===\n');
if (sirius && sirius.picks) {
  const cornerPicks = sirius.picks.filter(p => p.rawTitle.toLowerCase().includes('córner') || p.rawTitle.toLowerCase().includes('gol'));
  cornerPicks.forEach(p => {
    console.log(`"${p.rawTitle}" -> ${p.percentage}% | Muestra: ${p.sampleLine}`);
    console.log(`  Evidencia: ${JSON.stringify(p.evidenceText)}`);
  });
}
