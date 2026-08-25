const fs = require('node:fs');
const path = require('node:path');
const { auditPipelineState } = require('./lib/pipeline-audit');
const {
  buildCertifiedContent,
  loadCertificationContext,
  validateCertifiedContent,
  validateCertifiedParlayDataAgainstContext
} = require('./lib/certified-content');

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const projectDir = path.resolve(__dirname, '..');
const optionId = optionValue('--option');
const date = optionValue('--date');
const outputArg = optionValue('--output');

if (!optionId) throw new Error('Falta --option <optionId> elegido por el usuario.');
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error('Falta --date YYYY-MM-DD.');
}

const audit = auditPipelineState(projectDir);
if (audit.errors.length > 0) {
  throw new Error(`Pipeline no certificable:\n- ${audit.errors.join('\n- ')}`);
}

const context = loadCertificationContext(projectDir);
const data = buildCertifiedContent(context, optionId, date);
const validation = data.format === 'parlay-de-datos'
  ? validateCertifiedParlayDataAgainstContext(data, context)
  : validateCertifiedContent(data, projectDir);
if (validation.errors.length > 0) {
  throw new Error(`No se pudo congelar contenido:\n- ${validation.errors.join('\n- ')}`);
}

const defaultOutput = data.format === 'promo-video'
  ? 'promo-data.json'
  : data.format === 'combinada-de-datos'
    ? 'combinada-data.json'
    : 'parlay-data.json';
const outputPath = path.resolve(projectDir, outputArg || defaultOutput);
if (outputPath !== projectDir && !outputPath.startsWith(`${projectDir}${path.sep}`)) {
  throw new Error('El archivo de salida debe estar dentro del proyecto.');
}
if (path.extname(outputPath).toLowerCase() !== '.json') {
  throw new Error('El archivo de salida debe tener extension .json.');
}
const stateDir = path.join(projectDir, 'pipeline-state');
if (outputPath === stateDir || outputPath.startsWith(`${stateDir}${path.sep}`)) {
  throw new Error('freeze-content no puede escribir dentro de pipeline-state.');
}
fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Contenido certificado: ${path.relative(projectDir, outputPath)}`);
console.log(`Opcion: ${optionId}`);
console.log(`Candidatos: ${data.provenance.candidateIds.join(', ')}`);
console.log(`Momio DOM: ${data.combinedOdds || data.individualOdds}`);
console.log(`SHA-256 de certificacion: ${data.provenance.certificationHash}`);
