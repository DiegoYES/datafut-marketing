const fs = require('fs');
const path = require('path');

function decimalToAmerican(dec) {
  if (!dec || isNaN(dec) || dec <= 1) return '+100';
  if (dec >= 2.0) {
    return `+${Math.round((dec - 1) * 100)}`;
  } else {
    return `-${Math.round(100 / (dec - 1))}`;
  }
}

// 1. Aldosivi vs Union: Más de 2.5 tarjetas amarillas (78.6% | 1.56 / -180)
// 2. Bohemians vs Derry: Más de 1.5 goles (78.6% | 1.36 / -275)
// 3. Alianza Atletico vs Sporting Cristal: Menos de 10.5 córners totales (75.0% | 1.45 / -220) [Prioridad Normal]
// 4. FC Cajamarca vs Grau: Menos de 10.5 córners totales (71.4% | 1.25 / -400)
// 5. Dundalk vs Galway: Más de 1.5 goles (82.1% | 1.17 / -600)
// 6. Alianza Atletico vs Sporting Cristal: Menos de 11.5 córners totales (82.1% | 1.27 / -367)

const cleanPool = [
  {
    candidateId: 'DFM-01',
    match: 'Aldosivi vs Unión Santa Fe',
    league: 'Argentina Liga Profesional',
    timeCDMX: '11:30',
    market: 'Más de 2.5 tarjetas amarillas totales',
    scope: 'match',
    percentage: 78.6,
    sample: { home: 10, away: 10 },
    oddsDecimal: 1.56,
    oddsAmerican: '-180',
    oddsText: '1.56 (-180)',
    evidence: 'Aldosivi cumplió 10/10 (100%) y Unión Santa Fe 8/10 (80%) en sus últimos partidos.'
  },
  {
    candidateId: 'DFM-02',
    match: 'Bohemians vs Derry City',
    league: 'Irlanda Premier Division',
    timeCDMX: '12:45',
    market: 'Más de 1.5 goles',
    scope: 'match',
    percentage: 78.6,
    sample: { home: 10, away: 10 },
    oddsDecimal: 1.36,
    oddsAmerican: '-275',
    oddsText: '1.36 (-275)',
    evidence: 'Bohemians cumplió 10/10 (100%) y Derry City 8/10 (80%) en sus partidos recientes.'
  },
  {
    candidateId: 'DFM-03',
    match: 'Alianza Atlético vs Sporting Cristal',
    league: 'Perú Liga 1',
    timeCDMX: '14:00',
    market: 'Menos de 10.5 córners totales',
    scope: 'match',
    percentage: 75.0,
    sample: { home: 10, away: 10 },
    oddsDecimal: 1.45,
    oddsAmerican: '-220',
    oddsText: '1.45 (-220)',
    evidence: 'Alianza Atlético cumplió 9/10 (90%) y Sporting Cristal 8/10 (80%) bajo la línea de 10.5 córners.'
  },
  {
    candidateId: 'DFM-04',
    match: 'FC Cajamarca vs Atlético Grau',
    league: 'Perú Liga 1',
    timeCDMX: '11:00',
    market: 'Menos de 10.5 córners totales',
    scope: 'match',
    percentage: 71.4,
    sample: { home: 10, away: 10 },
    oddsDecimal: 1.25,
    oddsAmerican: '-400',
    oddsText: '1.25 (-400)',
    evidence: 'FC Cajamarca cumplió 9/10 (90%) y Grau 7/10 (70%) en control de córners.'
  },
  {
    candidateId: 'DFM-05',
    match: 'Dundalk vs Galway United',
    league: 'Irlanda Premier Division',
    timeCDMX: '12:45',
    market: 'Más de 1.5 goles',
    scope: 'match',
    percentage: 82.1,
    sample: { home: 10, away: 10 },
    oddsDecimal: 1.17,
    oddsAmerican: '-600',
    oddsText: '1.17 (-600)',
    evidence: 'Galway United cumplió 10/10 (100%) y Dundalk 9/10 (90%) en over 1.5 goles.'
  }
];

// Calculate Parlay combinations:
// Parlay 1: Doble Directo (Aldosivi Tarjetas + Bohemians Goles)
const p1Dec = Math.round(1.56 * 1.36 * 100) / 100;
const p1Am = decimalToAmerican(p1Dec);

// Parlay 2: Doble Sudamericano/Internacional (Aldosivi Tarjetas + Alianza Atlético Córners -10.5)
const p2Dec = Math.round(1.56 * 1.45 * 100) / 100;
const p2Am = decimalToAmerican(p2Dec);

// Parlay 3: Doble Ofensivo & Córners (Bohemians Goles + Alianza Atlético Córners -10.5)
const p3Dec = Math.round(1.36 * 1.45 * 100) / 100;
const p3Am = decimalToAmerican(p3Dec);

// Parlay 4: Triple Internacional (Aldosivi Tarjetas + Bohemians Goles + Alianza Atlético Córners)
const p4Dec = Math.round(1.56 * 1.36 * 1.45 * 100) / 100;
const p4Am = decimalToAmerican(p4Dec);

// Parlay 5: Triple Multiliga (FC Cajamarca Córners + Bohemians Goles + Aldosivi Tarjetas)
const p5Dec = Math.round(1.25 * 1.36 * 1.56 * 100) / 100;
const p5Am = decimalToAmerican(p5Dec);

console.log('=== CLEAN PARLAYS (CORRECTED SCOPE) ===\n');
console.log(`Parlay 1 (Doble): ${p1Dec} (${p1Am})`);
console.log(`Parlay 2 (Doble): ${p2Dec} (${p2Am})`);
console.log(`Parlay 3 (Doble): ${p3Dec} (${p3Am})`);
console.log(`Parlay 4 (Triple): ${p4Dec} (${p4Am})`);
console.log(`Parlay 5 (Triple): ${p5Dec} (${p5Am})`);
