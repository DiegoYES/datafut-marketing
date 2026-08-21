const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { readJson } = require('./lib/validation');

const projectDir = path.resolve(__dirname, '..');
const baselinePath = path.join(projectDir, 'validation', 'golden-renders.json');

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function checkHash(filePath, expectedHash, label, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${label}: no existe ${path.relative(projectDir, filePath)}`);
    return;
  }

  const actualHash = sha256(filePath);
  if (actualHash !== expectedHash) {
    errors.push(`${label}: hash distinto; el archivo cambio desde la referencia`);
  }
}

try {
  const baseline = readJson(baselinePath);
  const errors = [];

  baseline.stableSources.forEach(source => {
    checkHash(
      path.join(projectDir, source.path),
      source.sha256,
      `Fuente estable ${source.path}`,
      errors
    );
  });

  baseline.renders.forEach(render => {
    const renderDir = path.join(projectDir, 'renders', render.id);
    const videoPath = path.join(renderDir, 'reel.mp4');
    const dataPath = path.join(renderDir, 'parlay-data.json');

    checkHash(videoPath, render.videoSha256, `Render ${render.id}`, errors);
    checkHash(dataPath, render.dataSha256, `Datos ${render.id}`, errors);

    if (fs.existsSync(videoPath) && fs.statSync(videoPath).size !== render.videoBytes) {
      errors.push(`Render ${render.id}: tamano distinto al de referencia`);
    }
  });

  if (errors.length > 0) {
    errors.forEach(error => console.error(`ERROR: ${error}`));
    console.error(`Referencia alterada: ${errors.length} diferencia(s).`);
    process.exitCode = 1;
  } else {
    console.log(
      `Referencia intacta: ${baseline.stableSources.length} fuentes y ` +
      `${baseline.renders.length} renders coinciden por SHA-256.`
    );
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
