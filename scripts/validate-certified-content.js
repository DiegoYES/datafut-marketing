const path = require('node:path');
const { readJson } = require('./lib/validation');
const { validateCertifiedContent } = require('./lib/certified-content');

const projectDir = path.resolve(__dirname, '..');
const input = process.argv[2];
if (!input) throw new Error('Falta el archivo de contenido.');
const inputPath = path.resolve(projectDir, input);
const result = validateCertifiedContent(readJson(inputPath), projectDir);
result.warnings.forEach(warning => console.warn(`ADVERTENCIA: ${warning}`));
if (result.errors.length > 0) {
  result.errors.forEach(error => console.error(`ERROR: ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Contenido certificado: ${path.relative(projectDir, inputPath)}`);
}
