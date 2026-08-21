const fs = require('fs');
const path = require('path');

// Audit Aldosivi vs Union Santa Fe
const dfScraped = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));
const aldosiviDf = dfScraped.find(m => m.title.includes('Aldosivi') || m.header.includes('Aldosivi'));

console.log('=== AUDITORÍA FORENSE COMPLETA: ALDOSIVI VS UNIÓN SANTA FE ===\n');

// PlayDoIt actual card markets for this match:
const playdoitCardMarkets = [
  { marketName: 'Total de tarjetas (Partido)', scope: 'match', lines: [
    { line: 4.5, overPrice: 1.40, underPrice: 2.55 },
    { line: 5.5, overPrice: 1.75, underPrice: 1.90 },
    { line: 6.5, overPrice: 2.30, underPrice: 1.50 }
  ]},
  { marketName: 'Total de tarjetas Aldosivi (Equipo Local)', scope: 'team_home', lines: [
    { line: 2.5, overPrice: 1.56, underPrice: 2.14 }
  ]},
  { marketName: 'Total de tarjetas Unión de Santa Fe (Equipo Visitante)', scope: 'team_away', lines: [
    { line: 2.5, overPrice: 1.71, underPrice: 1.90 }
  ]}
];

console.log('--- MERCADOS REALES VISIBLES EN PLAYDOIT ---');
playdoitCardMarkets.forEach(m => {
  console.log(`\nMercado: "${m.marketName}" [Alcance: ${m.scope}]`);
  m.lines.forEach(l => {
    console.log(`  - Más de ${l.line}: ${l.overPrice} | Menos de ${l.line}: ${l.underPrice}`);
  });
});

console.log('\n--- EVALUANDO CRUCE CON DATAFUT (>= 65.0%) ---');

// Check exact cruces
const validIntersections = [];

aldosiviDf.picks.forEach(p => {
  if (p.percentage < 65.0) return;
  const raw = p.rawTitle.toLowerCase();
  
  // 1. Check if it's match total cards
  if (raw.includes('tarjetas registradas totales') || raw.includes('tarjetas amarillas totales') || raw.includes('tarjetas totales')) {
    const isOver = raw.startsWith('más de') || raw.startsWith('mas de');
    const isUnder = raw.startsWith('menos de');
    const num = parseFloat((raw.match(/\d+(\.\d+)?/) || [0])[0]);

    // Check against PlayDoIt match cards
    const matchMkt = playdoitCardMarkets.find(m => m.scope === 'match');
    const lineFound = matchMkt.lines.find(l => l.line === num);

    if (lineFound) {
      const price = isOver ? lineFound.overPrice : lineFound.underPrice;
      validIntersections.push({
        marketDataFut: p.rawTitle,
        percentage: p.percentage,
        scope: 'PARTIDO COMPLETO (Ambos equipos)',
        marketPlayDoIt: `Total de tarjetas: ${isOver ? 'Más de' : 'Menos de'} ${num}`,
        cuotaPlayDoIt: price,
        evidencia: p.evidenceText[0]
      });
    }
  }

  // 2. Check if it's local team cards (Aldosivi)
  if (raw.includes('tarjetas registradas del local') || raw.includes('tarjetas amarillas del local') || raw.includes('tarjetas del local')) {
    const isOver = raw.startsWith('más de') || raw.startsWith('mas de');
    const isUnder = raw.startsWith('menos de');
    const num = parseFloat((raw.match(/\d+(\.\d+)?/) || [0])[0]);

    // Check against PlayDoIt local team cards
    const homeMkt = playdoitCardMarkets.find(m => m.scope === 'team_home');
    const lineFound = homeMkt.lines.find(l => l.line === num);

    if (lineFound) {
      const price = isOver ? lineFound.overPrice : lineFound.underPrice;
      validIntersections.push({
        marketDataFut: p.rawTitle,
        percentage: p.percentage,
        scope: 'SOLO ALDOSIVI (Equipo Local)',
        marketPlayDoIt: `Total de tarjetas Aldosivi: ${isOver ? 'Más de' : 'Menos de'} ${num}`,
        cuotaPlayDoIt: price,
        evidencia: p.evidenceText[0]
      });
    }
  }
});

console.log(`\nIntersecciones 100% VÁLIDAS encontradas en Aldosivi vs Unión Santa Fe: ${validIntersections.length}\n`);
validIntersections.forEach((v, i) => {
  console.log(`[Opción ${i+1}]`);
  console.log(`  - Mercado DataFut: "${v.marketDataFut}" (${v.percentage}%)`);
  console.log(`  - Alcance Real: ${v.scope}`);
  console.log(`  - Mercado PlayDoIt: "${v.marketPlayDoIt}" -> Cuota: ${v.cuotaPlayDoIt}`);
  console.log(`  - Evidencia: ${v.evidencia}\n`);
});
