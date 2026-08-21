const fs = require('fs');
const path = require('path');

const dfScraped = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));
const sirius = dfScraped.find(m => m.title.includes('Sirius') || m.header.includes('Sirius'));

console.log('=== TOP 15 PICKS FOR SIRIUS VS BK HACKEN ===\n');
if (sirius && sirius.picks) {
  const topPicks = sirius.picks.filter(p => p.percentage >= 70);
  topPicks.slice(0, 15).forEach((p, idx) => {
    console.log(`[${idx+1}] ${p.rawTitle} (${p.percentage}%)`);
    console.log(`     ${p.evidenceText[0]}\n`);
  });
}
