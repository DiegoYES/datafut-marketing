const fs = require('fs');
const path = require('path');

const rendersDir = path.join(__dirname, 'renders');

const topReels = [
  {
    name: 'Reel 1: Sirius vs. IF Brommapojkarna',
    market: 'Más de 1.5 goles (82.6%)',
    league: 'Allsvenskan (Suecia)',
    file: 'datafut-sirius-brommapojkarna-over15-2026-08-10.mp4'
  },
  {
    name: 'Reel 2: Unión Santa Fe vs. Central Córdoba',
    market: 'Menos de 3.5 goles (73.1%)',
    league: 'Primera División (Argentina)',
    file: 'datafut-union-central-under35-2026-08-10-v6.mp4'
  }
];

console.log('--- VERIFYING TOP 2 DATAFUT REELS FOR TODAY ---');

topReels.forEach((r, idx) => {
  const filePath = path.join(rendersDir, r.file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`\n[${idx + 1}] ${r.name}`);
    console.log(`    Liga: ${r.league}`);
    console.log(`    Mercado: ${r.market}`);
    console.log(`    Archivo MP4: ${r.file}`);
    console.log(`    Ruta Absoluta: ${filePath}`);
    console.log(`    Tamaño: ${sizeMb} MB`);
    console.log(`    Estado: LISTO PARA PUBLICAR ✓`);
  } else {
    console.log(`\n[${idx + 1}] Error: File not found: ${r.file}`);
  }
});
