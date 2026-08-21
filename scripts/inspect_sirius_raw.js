const fs = require('fs');
const path = require('path');

const dfScraped = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));

const sirius = dfScraped.find(m => m.title.includes('Sirius') || m.header.includes('Sirius'));

console.log('=== ALL PICKS FOR SIRIUS VS BK HACKEN IN DATAFUT ===\n');
if (sirius && sirius.picks) {
  sirius.picks.forEach((p, idx) => {
    console.log(`[${idx+1}] rawTitle: "${p.rawTitle}" | %: ${p.percentage}% | Muestra: ${p.sampleLine}`);
    console.log(`     Evidence: ${JSON.stringify(p.evidenceText)}`);
    console.log(`     FullLines: ${JSON.stringify(p.fullLines || [])}\n`);
  });
}
