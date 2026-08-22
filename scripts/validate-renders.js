const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { readJson, validateParlayData } = require('./lib/validation');

const projectDir = path.resolve(__dirname, '..');
const rendersDir = path.join(projectDir, 'renders');
const requiredFiles = [
  'caption.txt',
  'metadata.json',
  'music.wav',
  'narration-manifest.json',
  'parlay-data.json',
  'reel.mp4',
  'source.webm'
];

function inspectMedia(filePath) {
  const result = spawnSync(
    ffmpegPath,
    ['-hide_banner', '-i', filePath],
    { encoding: 'utf8', windowsHide: true }
  );
  if (result.error) {
    return {
      hasVideo: null,
      hasAudio: null,
      width: null,
      height: null,
      durationSeconds: null,
      inspectionError: result.error.message
    };
  }
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const durationMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const resolutionMatch = output.match(/Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/);

  return {
    hasVideo: /Video:/.test(output),
    hasAudio: /Audio:/.test(output),
    width: resolutionMatch ? Number(resolutionMatch[1]) : null,
    height: resolutionMatch ? Number(resolutionMatch[2]) : null,
    durationSeconds: durationMatch
      ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
      : null,
    inspectionError: null
  };
}

function hasMp4Signature(filePath) {
  const handle = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    const bytesRead = fs.readSync(handle, header, 0, header.length, 0);
    return bytesRead === header.length && header.toString('ascii', 4, 8) === 'ftyp';
  } finally {
    fs.closeSync(handle);
  }
}

function validateRender(renderDir) {
  const name = path.basename(renderDir);
  const errors = [];
  const warnings = [];

  requiredFiles.forEach(fileName => {
    if (!fs.existsSync(path.join(renderDir, fileName))) {
      errors.push(`falta ${fileName}`);
    }
  });

  if (errors.length > 0) {
    return { name, errors, warnings };
  }

  const metadata = readJson(path.join(renderDir, 'metadata.json'));
  const parlayData = readJson(path.join(renderDir, 'parlay-data.json'));
  const dataValidation = validateParlayData(parlayData, { allowLegacyThreshold: true });
  errors.push(...dataValidation.errors.map(error => `parlay-data.json: ${error}`));
  warnings.push(...dataValidation.warnings.map(warning => `parlay-data.json: ${warning}`));

  if (metadata.status !== 'ready') {
    errors.push(`metadata.status es ${JSON.stringify(metadata.status)}, se esperaba "ready"`);
  }

  if (JSON.stringify(metadata.picks) !== JSON.stringify(parlayData.picks)) {
    errors.push('metadata.picks no coincide con parlay-data.json');
  }

  const reelPath = path.join(renderDir, 'reel.mp4');
  const reelSize = fs.statSync(reelPath).size;
  if (reelSize < 1024 * 1024) {
    errors.push(`reel.mp4 es demasiado pequeno (${reelSize} bytes)`);
  }
  if (!hasMp4Signature(reelPath)) {
    errors.push('reel.mp4 no tiene una firma MP4 valida');
  }

  const media = inspectMedia(reelPath);
  if (media.inspectionError) {
    warnings.push(
      `FFmpeg no pudo inspeccionar el MP4 (${media.inspectionError}); ` +
      'se verificaron firma, tamano y metadata'
    );
    if (!metadata.video || metadata.video.width !== 1080 || metadata.video.height !== 1920) {
      errors.push('metadata no confirma la resolucion vertical 1080x1920');
    }
    if (!metadata.video || metadata.video.audio !== true) {
      errors.push('metadata no confirma una pista de audio');
    }
  } else {
    if (!media.hasVideo) errors.push('reel.mp4 no contiene una pista de video detectable');
    if (!media.hasAudio) errors.push('reel.mp4 no contiene una pista de audio detectable');
    if (media.width !== 1080 || media.height !== 1920) {
      errors.push(`resolucion inesperada: ${media.width}x${media.height}; se esperaba 1080x1920`);
    }

    const expectedDuration = metadata.video && metadata.video.durationSeconds;
    if (!Number.isFinite(media.durationSeconds)) {
      errors.push('no se pudo leer la duracion de reel.mp4');
    } else if (Number.isFinite(expectedDuration) && Math.abs(media.durationSeconds - expectedDuration) > 0.25) {
      errors.push(
        `duracion ${media.durationSeconds.toFixed(2)}s no coincide con metadata ` +
        `${Number(expectedDuration).toFixed(2)}s`
      );
    }
  }

  if (metadata.files && metadata.files.narrationText) {
    const declaredNarration = path.join(renderDir, metadata.files.narrationText);
    if (!fs.existsSync(declaredNarration)) {
      warnings.push(`metadata declara ${metadata.files.narrationText}, pero el archivo no existe`);
    }
  }

  return { name, errors, warnings, media, reelSize };
}

if (!fs.existsSync(rendersDir)) {
  console.error(`ERROR: no existe ${rendersDir}`);
  process.exit(1);
}

const renderDirs = fs.readdirSync(rendersDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(rendersDir, entry.name));

if (renderDirs.length === 0) {
  console.error('ERROR: no hay paquetes en renders/.');
  process.exit(1);
}

let totalErrors = 0;
let totalWarnings = 0;

renderDirs.forEach(renderDir => {
  try {
    const result = validateRender(renderDir);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    const status = result.errors.length === 0 ? 'OK' : 'FALLO';
    const detail = result.media && Number.isFinite(result.media.durationSeconds)
      ? ` - ${result.media.width}x${result.media.height}, ${result.media.durationSeconds.toFixed(2)}s, ` +
        `${(result.reelSize / 1024 / 1024).toFixed(2)} MB`
      : result.reelSize
        ? ` - ${(result.reelSize / 1024 / 1024).toFixed(2)} MB`
      : '';
    console.log(`${status}: ${result.name}${detail}`);
    result.warnings.forEach(warning => console.warn(`  ADVERTENCIA: ${warning}`));
    result.errors.forEach(error => console.error(`  ERROR: ${error}`));
  } catch (error) {
    totalErrors += 1;
    console.error(`FALLO: ${path.basename(renderDir)} - ${error.message}`);
  }
});

if (totalErrors > 0) {
  console.error(`Validacion fallida: ${totalErrors} error(es), ${totalWarnings} advertencia(s).`);
  process.exitCode = 1;
} else {
  console.log(
    `Renders validos: ${renderDirs.length} paquete(s), ${totalWarnings} advertencia(s).`
  );
}
