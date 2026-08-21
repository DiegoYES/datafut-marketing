const fs = require('fs');
const path = require('path');

const picks = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_raw_datafut_picks.json'), 'utf8'));

console.log('Total picks:', picks.length);

// Group by rawTitle patterns / families
const titleCategories = new Set();
picks.forEach(p => {
  const t = p.rawTitle;
  if (t.includes('gol')) titleCategories.add('goles');
  if (t.includes('córner') || t.includes('corner')) titleCategories.add('corners');
  if (t.includes('falta')) titleCategories.add('faltas');
  if (t.includes('tarjeta')) titleCategories.add('tarjetas');
  if (t.includes('tiro a puerta') || t.includes('tiros a puerta')) titleCategories.add('tiros_a_puerta');
  else if (t.includes('tiro')) titleCategories.add('tiros');
  if (t.includes('marca') || t.includes('anota')) titleCategories.add('equipo_anota');
  if (t.includes('tiempo') || t.includes('mitad')) titleCategories.add('mitad');
});

console.log('Categories detected:', Array.from(titleCategories));

// Let's see some top picks sorted by percentage
const validPicks = picks.filter(p => {
  // Exclude trivial Over 0.5 match goals
  if (/más de 0\.5 goles$/i.test(p.rawTitle) || /over 0\.5 goals/i.test(p.rawTitle)) return false;
  return p.percentage !== null;
});

validPicks.sort((a, b) => b.percentage - a.percentage);

console.log('\nTop 25 valid picks by percentage:');
validPicks.slice(0, 25).forEach((p, idx) => {
  console.log(`[${idx+1}] [${p.league}] ${p.match} -> ${p.rawTitle} (${p.percentage}%) [${p.sampleLine}]`);
  console.log(`     Evidence: ${p.evidenceText[0] || 'N/A'}`);
});
