const fs = require('fs');
const path = require('path');

const dfScraped = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));
const aldosivi = dfScraped.find(m => m.title.includes('Aldosivi') || m.header.includes('Aldosivi'));

console.log('=== CARD PICKS >= 65% FOR ALDOSIVI IN DATAFUT ===\n');
if (aldosivi && aldosivi.picks) {
  const cardPicks = aldosivi.picks.filter(p => (p.rawTitle.toLowerCase().includes('tarjeta') || p.rawTitle.toLowerCase().includes('amarilla')) && p.percentage >= 65);
  cardPicks.forEach(p => {
    console.log(`"${p.rawTitle}" -> ${p.percentage}% | Muestra: ${p.sampleLine}`);
    console.log(`  Evidencia: ${JSON.stringify(p.evidenceText)}\n`);
  });
}
