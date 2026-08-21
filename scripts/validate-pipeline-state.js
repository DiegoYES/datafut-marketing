const path = require('path');
const { auditPipelineState } = require('./lib/pipeline-audit');

const projectDir = path.resolve(__dirname, '..');

try {
  const result = auditPipelineState(projectDir);
  console.log(JSON.stringify(result.summary, null, 2));
  result.warnings.forEach(warning => console.warn(`ADVERTENCIA: ${warning}`));
  result.errors.forEach(error => console.error(`ERROR DE INTEGRIDAD: ${error}`));

  if (result.errors.length > 0) {
    console.error(`Estado no publicable: ${result.errors.length} problema(s) de procedencia.`);
    process.exitCode = 1;
  } else {
    console.log('Estado del pipeline publicable segun las reglas de procedencia.');
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
