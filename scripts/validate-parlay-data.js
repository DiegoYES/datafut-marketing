const path = require('path');
const { readJson } = require('./lib/validation');
const { validateCertifiedParlayData } = require('./lib/certified-content');

const input = process.argv[2] || 'parlay-data.json';
const inputPath = path.resolve(process.cwd(), input);
const projectDir = path.resolve(__dirname, '..');

try {
  const data = readJson(inputPath);
  const { errors, warnings } = validateCertifiedParlayData(data, projectDir);

  warnings.forEach(warning => console.warn(`ADVERTENCIA: ${warning}`));

  if (errors.length > 0) {
    errors.forEach(error => console.error(`ERROR: ${error}`));
    console.error(`Entrada invalida: ${errors.length} error(es).`);
    process.exitCode = 1;
  } else {
    console.log(
      `Entrada valida: ${path.relative(process.cwd(), inputPath)} ` +
      `(${data.picks.length} picks, procedencia oficial certificada).`
    );
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
