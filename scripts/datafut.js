const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { auditPipelineState } = require('./lib/pipeline-audit');
const { readJson, validateParlayData } = require('./lib/validation');

const projectDir = path.resolve(__dirname, '..');
const manifest = readJson(path.join(projectDir, 'config', 'pipeline-manifest.json'));
const domConfig = readJson(path.join(projectDir, 'config', 'playdoit-dom.json'));

function usage() {
  console.log(`DataFut Marketing

Uso:
  npm run datafut -- status
  npm run datafut -- audit
  npm run datafut -- discover --raw <archivo.json>
  npm run datafut -- discover-live [--date YYYY-MM-DD]
  npm run datafut -- replenish [--raw <archivo.json>]
  npm run datafut -- options
  npm run datafut -- render --input <archivo.json> [--date YYYY-MM-DD] [--dry-run]

El comando render genera archivos locales, pero nunca publica ni realiza apuestas.`);
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectDir,
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} termino con codigo ${result.status}.`);
  }
}

function showStatus() {
  console.log(`Pipeline manifest v${manifest.version}`);
  manifest.stages.forEach(stage => {
    console.log(`- ${stage.id}: ${stage.status.toUpperCase()} - ${stage.note}`);
  });
  console.log(`- playdoit-dom-selectors: ${domConfig.status}`);

  const audit = auditPipelineState(projectDir);
  console.log('\nEstado local:');
  console.log(JSON.stringify(audit.summary, null, 2));
  if (audit.errors.length > 0) {
    console.log(`\nPublicacion bloqueada por ${audit.errors.length} problema(s) de procedencia.`);
  }
}

function audit() {
  const result = auditPipelineState(projectDir);
  console.log(JSON.stringify(result.summary, null, 2));
  result.warnings.forEach(warning => console.warn(`ADVERTENCIA: ${warning}`));
  result.errors.forEach(error => console.error(`ERROR DE INTEGRIDAD: ${error}`));
  if (result.errors.length > 0) process.exitCode = 1;
}

function discover(args) {
  const rawArg = optionValue(args, '--raw');
  if (!rawArg) throw new Error('Falta --raw <archivo.json>.');
  run(process.execPath, [path.join('scripts', 'discover-datafut-candidates.js'), rawArg]);
}

function discoverLive(args) {
  const dateArg = optionValue(args, '--date');
  const extractArgs = [path.join('scripts', 'extract_datafut_live.js')];
  if (dateArg) extractArgs.push('--date', dateArg);
  run(process.execPath, extractArgs);
  run(process.execPath, [
    path.join('scripts', 'discover-datafut-candidates.js'),
    path.join('scripts', 'datafut-live-raw.json')
  ]);
}

function buildOptions() {
  run(process.execPath, [path.join('scripts', 'build-format-options.js')]);
}

function replenish(args) {
  const rawArg = optionValue(args, '--raw') || path.join('scripts', 'datafut-live-raw.json');
  run(process.execPath, [path.join('scripts', 'replenish-candidates.js'), rawArg]);
}

function render(args) {
  const inputArg = optionValue(args, '--input');
  if (!inputArg) throw new Error('Falta --input <archivo.json>.');

  const inputPath = path.resolve(projectDir, inputArg);
  const data = readJson(inputPath);
  const validation = validateParlayData(data);
  validation.warnings.forEach(warning => console.warn(`ADVERTENCIA: ${warning}`));
  if (validation.errors.length > 0) {
    throw new Error(`Entrada invalida:\n- ${validation.errors.join('\n- ')}`);
  }

  const expectedDate = optionValue(args, '--date');
  if (expectedDate && data.date !== expectedDate) {
    throw new Error(`La entrada tiene fecha ${data.date}, no ${expectedDate}.`);
  }

  console.log(`Entrada valida: ${path.relative(projectDir, inputPath)} (${data.date}, ${data.picks.length} picks).`);
  if (args.includes('--dry-run')) {
    console.log('Dry-run completo: no se genero voz, video ni ningun archivo.');
    return;
  }

  const workingDataPath = path.join(projectDir, 'parlay-data.json');
  const sameInput = path.normalize(inputPath).toLowerCase() === path.normalize(workingDataPath).toLowerCase();
  const previousData = fs.existsSync(workingDataPath) ? fs.readFileSync(workingDataPath) : null;

  try {
    if (!sameInput) {
      fs.copyFileSync(inputPath, workingDataPath);
    }
    run('py', ['generate-parlay-voice-dynamic.py']);
    run(process.execPath, ['render-parlay-video.js']);
  } finally {
    if (!sameInput) {
      if (previousData) fs.writeFileSync(workingDataPath, previousData);
      else if (fs.existsSync(workingDataPath)) fs.unlinkSync(workingDataPath);
    }
  }
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (!command || ['help', '--help', '-h'].includes(command)) usage();
  else if (command === 'status') showStatus();
  else if (command === 'audit') audit();
  else if (command === 'discover') discover(args);
  else if (command === 'discover-live') discoverLive(args);
  else if (command === 'replenish') replenish(args);
  else if (command === 'options') buildOptions();
  else if (command === 'render') render(args);
  else throw new Error(`Comando desconocido: ${command}`);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
