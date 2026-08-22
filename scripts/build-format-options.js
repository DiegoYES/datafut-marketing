const fs = require('fs');
const path = require('path');
const { readJson } = require('./lib/validation');
const { buildFormatOptions } = require('./lib/format-options');

const projectDir = path.resolve(__dirname, '..');
const stateDir = path.join(projectDir, 'pipeline-state');
const discovery = readJson(path.join(stateDir, 'discovery-candidates.json'));
const verification = readJson(path.join(stateDir, 'verified-candidates.json'));

if (verification.discoveryGeneratedAt !== discovery.generatedAt) {
  throw new Error('Verification no pertenece al Discovery actual. Ejecuta una ronda coherente.');
}

const output = buildFormatOptions(discovery, verification);
const outputPath = path.join(stateDir, 'format-options.json');
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(`Opciones guardadas en ${path.relative(projectDir, outputPath)}:`);
console.log(`- Picks individuales: ${output.routes.individual.options.length}`);
console.log(`- Parlays entre partidos distintos: ${output.routes.parlay.options.length}`);
console.log(`- Combinadas del mismo partido por comprobar: ${output.routes.combinada.options.length}`);
console.log('Ninguna opcion fue elegida, cotizada, apostada ni publicada.');
