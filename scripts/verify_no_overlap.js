const fs = require('fs');
const path = require('path');

const p1Dir = path.join(__dirname, '..', 'renders', '2026-08-21__parlay-de-datos__estudiantes-rio-cuarto-menos-de-2-5-goles-totales__audax-italiano-menos-de-10-5-corners-totales__v4');
const p2Dir = path.join(__dirname, '..', 'renders', '2026-08-21__parlay-de-datos__audax-italiano-mas-de-1-5-goles-totales__san-diego-wave-menos-de-3-5-goles-totales');

// Check manifest in latest render directories
const renders = fs.readdirSync(path.join(__dirname, '..', 'renders')).filter(f => f.includes('2026-08-21__parlay-de-datos'));

console.log('Renders encontrados:');
renders.forEach(r => {
  const mPath = path.join(__dirname, '..', 'renders', r, 'narration-manifest.json');
  if (fs.existsSync(mPath)) {
    const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
    console.log(`\nPaquete: ${r}`);
    console.log(`Duración video: ${m.totalVideoDurationSeconds}s`);
    m.blocks.forEach(b => {
      console.log(`  - [${b.id}] ${b.startSeconds}s -> ${b.endSeconds}s (duración: ${b.durationSeconds}s)`);
    });
  }
});
