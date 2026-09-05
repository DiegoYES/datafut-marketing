const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { auditPipelineState } = require('./lib/pipeline-audit');
const { readJson } = require('./lib/validation');
const { validateCertifiedParlayData } = require('./lib/certified-content');

const projectDir = path.resolve(__dirname, '..');
const manifest = readJson(path.join(projectDir, 'config', 'pipeline-manifest.json'));
const domConfig = readJson(path.join(projectDir, 'config', 'playdoit-dom.json'));

function usage() {
  console.log(`DataFut Marketing

Uso:
  npm run datafut -- status
  npm run datafut -- login-datafut
  npm run datafut -- audit
  npm run datafut -- catalog-preview
  npm run datafut -- catalog-dom --observation <archivo.json>
  npm run datafut -- discover --raw <archivo.json>
  npm run datafut -- discover-live [--date YYYY-MM-DD]
  npm run datafut -- discover-dom --observation <archivo.json>
  npm run datafut -- verify
  npm run datafut -- verify-dom --observation <archivo.json>
  npm run datafut -- replenish [--raw <archivo.json>]
  npm run datafut -- options
  npm run datafut -- parlays
  npm run datafut -- parlays-dom --observation <archivo.json>
  npm run datafut -- finalists
  npm run datafut -- freeze-content --option <optionId> --date YYYY-MM-DD [--output <archivo.json>]
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
  const limitArg = optionValue(args, '--limit');
  const discoverArgs = [path.join('scripts', 'discover-datafut-candidates.js'), rawArg];
  if (limitArg) discoverArgs.push('--limit', limitArg);
  run(process.execPath, discoverArgs);
}

function discoverLive(args) {
  const dateArg = optionValue(args, '--date');
  const limitArg = optionValue(args, '--limit');
  const extractArgs = [path.join('scripts', 'extract_datafut_live.js')];
  if (dateArg) extractArgs.push('--date', dateArg);
  run(process.execPath, extractArgs);
  const discoverArgs = [
    path.join('scripts', 'discover-datafut-candidates.js'),
    path.join('scripts', 'datafut-live-raw.json')
  ];
  if (limitArg) discoverArgs.push('--limit', limitArg);
  run(process.execPath, discoverArgs);
}

function discoverDom(args) {
  let observationArg = optionValue(args, '--observation');
  const catalogPath = path.join(projectDir, 'pipeline-state', 'playdoit-catalog.json');
  const catalog = fs.existsSync(catalogPath) ? readJson(catalogPath) : null;
  const targetDate = catalog?.targetDate;
  const defaultFile = targetDate ? path.join('captures', 'dom', `datafut-discovery-observation-${targetDate}.json`) : null;

  if (observationArg && fs.existsSync(path.resolve(projectDir, observationArg))) {
    run(process.execPath, [path.join('scripts', 'import-datafut-dom-discovery.js'), observationArg]);
  } else if (defaultFile && fs.existsSync(path.resolve(projectDir, defaultFile))) {
    run(process.execPath, [path.join('scripts', 'import-datafut-dom-discovery.js'), defaultFile]);
  } else {
    console.log('No existe archivo de observacion de Discovery; ejecutando extraccion en vivo autenticada (discover-live)...');
    discoverLive(args);
    return;
  }
  run(process.execPath, [
    path.join('scripts', 'discover-datafut-candidates.js'),
    path.join('scripts', 'datafut-live-raw.json')
  ]);
}

function buildOptions() {
  run(process.execPath, [path.join('scripts', 'build-format-options.js')]);
}

function loginDatafut() {
  run(process.execPath, [path.join('login-datafut.js')]);
}

function buildCatalogPreview() {
  run(process.execPath, [path.join('scripts', 'build_playdoit_catalog.js')]);
}

function importDomCatalog(args) {
  let observationArg = optionValue(args, '--observation');
  if (!observationArg) {
    const domDir = path.join(projectDir, 'captures', 'dom');
    const catalogFiles = fs.readdirSync(domDir).filter(f => f.startsWith('playdoit-catalog-observation-') && f.endsWith('.json')).sort();
    if (catalogFiles.length > 0) {
      observationArg = path.join('captures', 'dom', catalogFiles[catalogFiles.length - 1]);
    }
  }
  if (!observationArg) throw new Error('Falta --observation <archivo.json>.');
  run(process.execPath, [path.join('scripts', 'import-playdoit-dom-catalog.js'), observationArg]);
}

function verify() {
  run(process.execPath, [path.join('scripts', 'run_playdoit_verification.js')]);
}

function importDomVerification(args) {
  let observationArg = optionValue(args, '--observation');
  if (!observationArg) {
    const catalogPath = path.join(projectDir, 'pipeline-state', 'playdoit-catalog.json');
    if (fs.existsSync(catalogPath)) {
      const catalog = readJson(catalogPath);
      const defaultFile = path.join('captures', 'dom', `playdoit-verification-observation-${catalog.targetDate}.json`);
      if (fs.existsSync(path.resolve(projectDir, defaultFile))) {
        observationArg = defaultFile;
      }
    }
  }
  if (!observationArg) throw new Error('Falta --observation <archivo.json>.');
  run(process.execPath, [path.join('scripts', 'import-playdoit-dom-verification.js'), observationArg]);
}

function buildParlays() {
  run(process.execPath, [path.join('scripts', 'run_parlay_builder.js')]);
}

function importDomParlays(args) {
  let observationArg = optionValue(args, '--observation');
  if (!observationArg) {
    const catalogPath = path.join(projectDir, 'pipeline-state', 'playdoit-catalog.json');
    if (fs.existsSync(catalogPath)) {
      const catalog = readJson(catalogPath);
      const target = path.join('captures', 'dom', `playdoit-betslip-observation-${catalog.targetDate}.json`);
      if (!fs.existsSync(path.resolve(projectDir, target))) {
        run(process.execPath, [path.join('scripts', 'build-betslip-observation.js')]);
      }
      observationArg = target;
    }
  } else if (!fs.existsSync(path.resolve(projectDir, observationArg))) {
    run(process.execPath, [path.join('scripts', 'build-betslip-observation.js')]);
  }
  if (!observationArg) throw new Error('Falta --observation <archivo.json>.');
  run(process.execPath, [path.join('scripts', 'import-playdoit-betslip-quotes.js'), observationArg]);
}

function replenish(args) {
  const rawArg = optionValue(args, '--raw') || path.join('scripts', 'datafut-live-raw.json');
  run(process.execPath, [path.join('scripts', 'replenish-candidates.js'), rawArg]);
}

function printFinalists() {
  run(process.execPath, [path.join('scripts', 'print-certified-finalists.js')]);
}

function freezeContent(args) {
  const commandArgs = [path.join('scripts', 'freeze-certified-content.js')];
  for (const name of ['--option', '--date', '--output']) {
    const value = optionValue(args, name);
    if (value) commandArgs.push(name, value);
  }
  run(process.execPath, commandArgs);
}

function render(args) {
  const inputArg = optionValue(args, '--input');
  if (!inputArg) throw new Error('Falta --input <archivo.json>.');

  const inputPath = path.resolve(projectDir, inputArg);
  const data = readJson(inputPath);
  const validation = validateCertifiedParlayData(data, projectDir);
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
  else if (command === 'login-datafut') loginDatafut();
  else if (command === 'audit') audit();
  else if (command === 'catalog-preview') buildCatalogPreview();
  else if (command === 'catalog-dom') importDomCatalog(args);
  else if (command === 'discover') discover(args);
  else if (command === 'discover-live') discoverLive(args);
  else if (command === 'discover-dom') discoverDom(args);
  else if (command === 'verify') verify();
  else if (command === 'verify-dom') importDomVerification(args);
  else if (command === 'replenish') replenish(args);
  else if (command === 'options') buildOptions();
  else if (command === 'parlays') buildParlays();
  else if (command === 'parlays-dom') importDomParlays(args);
  else if (command === 'finalists') printFinalists();
  else if (command === 'freeze-content') freezeContent(args);
  else if (command === 'render') render(args);
  else throw new Error(`Comando desconocido: ${command}`);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
