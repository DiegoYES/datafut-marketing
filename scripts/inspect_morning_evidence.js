const fs = require('fs');
const path = require('path');

const dfScraped = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));

console.log('=== DETAILED EVIDENCE & REASONS FOR MORNING PICKS ===\n');

const targetPicks = [
  { matchName: 'Sirius vs BK Hacken', market: 'Más de 6.5 córners totales' },
  { matchName: 'Aldosivi vs Union Santa Fe', market: 'Más de 2.5 tarjetas amarillas totales' },
  { matchName: 'Alianza Atletico vs Sporting Cristal', market: 'Menos de 11.5 córners totales' },
  { matchName: 'Bohemians vs Derry City', market: 'Más de 1.5 goles' },
  { matchName: 'Dundalk vs Galway United', market: 'Más de 1.5 goles' },
  { matchName: 'FC Cajamarca vs Atletico Grau', market: 'Menos de 10.5 córners totales' }
];

for (const tp of targetPicks) {
  const mObj = dfScraped.find(m => m.title.includes(tp.matchName) || m.header.includes(tp.matchName));
  if (mObj) {
    const pObj = mObj.picks.find(p => p.rawTitle.toLowerCase().includes(tp.market.toLowerCase()) || tp.market.toLowerCase().includes(p.rawTitle.toLowerCase()));
    console.log(`--- [PARTIDO] ${mObj.title} ---`);
    console.log(`Mercado: ${tp.market}`);
    if (pObj) {
      console.log(`Porcentaje: ${pObj.percentage}%`);
      console.log(`Muestra: ${pObj.sampleLine}`);
      console.log(`Evidencia / De dónde sale: ${JSON.stringify(pObj.evidenceText)}`);
    } else {
      console.log('Pick exacto no encontrado en lista, buscando similares:');
      mObj.picks.slice(0, 5).forEach(p => console.log(` * ${p.rawTitle} (${p.percentage}%) - ${p.sampleLine}`));
    }
    console.log('\n');
  }
}
