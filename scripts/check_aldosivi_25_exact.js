const fs = require('fs');
const path = require('path');

const dfScraped = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));
const aldosivi = dfScraped.find(m => m.title.includes('Aldosivi') || m.header.includes('Aldosivi'));

console.log('=== ALL 2.5 CARD PICKS FOR ALDOSIVI IN DATAFUT ===\n');
if (aldosivi && aldosivi.picks) {
  const p25 = aldosivi.picks.filter(p => p.rawTitle.includes('2.5') && (p.rawTitle.toLowerCase().includes('tarjeta') || p.rawTitle.toLowerCase().includes('amarilla')));
  p25.forEach(p => {
    console.log(`- "${p.rawTitle}" -> ${p.percentage}% | Muestra: ${p.sampleLine}`);
    console.log(`  Evidencia: ${JSON.stringify(p.evidenceText)}\n`);
  });
}
