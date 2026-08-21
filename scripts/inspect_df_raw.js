const fs = require('fs');
const path = require('path');

const dfMatches = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));

console.log('=== MATCHES IN DATAFUT RAW FILE ===\n');
dfMatches.forEach((m, idx) => {
  console.log(`[${idx+1}] ${m.title || m.header} (${m.picks ? m.picks.length : 0} picks)`);
});
