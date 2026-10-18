const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { readJson } = require('./scripts/lib/validation');
const { validateCertifiedParlayData } = require('./scripts/lib/certified-content');
const { killStaleAutomationChrome } = require('./scripts/lib/chrome-hygiene');

(async () => {
  const projectDir = __dirname;
  killStaleAutomationChrome(['playwright'], 'render');

  const htmlPath = path.join(
    projectDir,
    'parlay-video-template.html'
  );

  const dataPath = path.join(
    projectDir,
    'parlay-data.json'
  );

  const audioDir = path.join(
    projectDir,
    'parlay-audio'
  );

  const manifestPath = path.join(
    audioDir,
    'narration-manifest.json'
  );

  const rendersDir = path.join(
    projectDir,
    'renders'
  );

  const certifiedData = readJson(dataPath);
  const certification = validateCertifiedParlayData(certifiedData, projectDir);
  certification.warnings.forEach(warning => console.warn(`ADVERTENCIA: ${warning}`));
  if (certification.errors.length > 0) {
    throw new Error(
      `RENDER BLOQUEADO: el contenido no procede del pipeline certificado:\n- ${certification.errors.join('\n- ')}`
    );
  }

  // =========================================================
  // CONFIGURACIÓN DE MÚSICA
  // =========================================================

  const MUSIC_PRESETS = {
    analysis: {
      file: 'datafut-music-analysis.wav',
      volume: 0.14
    },

    energy: {
      file: 'datafut-music-energy.wav',
      volume: 0.15
    },

    tension: {
      file: 'datafut-music-tension.wav',
      volume: 0.13
    }
  };

  // =========================================================
  // FUNCIONES AUXILIARES
  // =========================================================

  function slugify(text) {
    return String(text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, 'y')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
  }

  function ensureExists(filePath, description) {
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `No existe ${description}: ${filePath}`
      );
    }
  }

  function createUniquePackageDirectory(baseName) {
    let version = 1;

    let packageName =
      baseName;

    let packageDir = path.join(
      rendersDir,
      packageName
    );

    while (fs.existsSync(packageDir)) {
      version++;

      packageName =
        `${baseName}__v${version}`;

      packageDir = path.join(
        rendersDir,
        packageName
      );
    }

    fs.mkdirSync(
      packageDir,
      {
        recursive: true
      }
    );

    return {
      packageName,
      packageDir,
      version
    };
  }

  function runFfmpeg(args) {
    return new Promise(
      (resolve, reject) => {
        const process =
          spawn(
            ffmpegPath,
            args,
            {
              stdio: 'inherit'
            }
          );

        process.on(
          'close',
          code => {
            if (code === 0) {
              resolve();
            }

            else {
              reject(
                new Error(
                  `FFmpeg terminó con código ${code}`
                )
              );
            }
          }
        );

        process.on(
          'error',
          reject
        );
      }
    );
  }

  // =========================================================
  // VALIDACIÓN DE ARCHIVOS
  // =========================================================

  ensureExists(
    htmlPath,
    'parlay-video-template.html'
  );

  ensureExists(
    dataPath,
    'parlay-data.json'
  );

  ensureExists(
    manifestPath,
    'narration-manifest.json'
  );

  if (!fs.existsSync(rendersDir)) {
    fs.mkdirSync(
      rendersDir,
      {
        recursive: true
      }
    );
  }

  // =========================================================
  // CARGAR DATOS
  // =========================================================

  const parlayData =
    JSON.parse(
      fs.readFileSync(
        dataPath,
        'utf8'
      )
    );

  const narrationManifest =
    JSON.parse(
      fs.readFileSync(
        manifestPath,
        'utf8'
      )
    );

  // =========================================================
  // VALIDAR PARLAY
  // =========================================================

  if (
    !Array.isArray(parlayData.picks) ||
    ![2, 3].includes(parlayData.picks.length)
  ) {
    throw new Error(
      'parlay-data.json debe contener 2 o 3 picks.'
    );
  }

  parlayData.picks.forEach(
    (pick, index) => {
      if (
        typeof pick.percentage !== 'number' ||
        Number.isNaN(pick.percentage)
      ) {
        throw new Error(
          `Pick ${index + 1}: percentage debe ser número.`
        );
      }

      if (
        !Array.isArray(pick.evidence) ||
        pick.evidence.length !== 2
      ) {
        throw new Error(
          `Pick ${index + 1}: debe contener exactamente 2 evidencias.`
        );
      }
    }
  );

  // =========================================================
  // VALIDAR PRESET DE MÚSICA
  // =========================================================

  const musicPreset =
    parlayData.musicPreset ||
    'energy';

  if (
    !Object.prototype.hasOwnProperty.call(
      MUSIC_PRESETS,
      musicPreset
    )
  ) {
    throw new Error(
      `musicPreset inválido: "${musicPreset}". ` +
      'Valores permitidos: analysis, energy, tension.'
    );
  }

  const musicConfig =
    MUSIC_PRESETS[musicPreset];

  const musicPath = path.join(
    projectDir,
    musicConfig.file
  );

  ensureExists(
    musicPath,
    `música del preset "${musicPreset}"`
  );

  // =========================================================
  // VALIDAR MANIFEST DE NARRACIÓN
  // =========================================================

  if (
    !Array.isArray(narrationManifest.blocks) ||
    ![4, 5].includes(narrationManifest.blocks.length)
  ) {
    throw new Error(
      'narration-manifest.json debe contener 4 o 5 bloques.'
    );
  }

  const expectedBlockIds = narrationManifest.blocks.length === 4
    ? ['intro', 'pick1', 'pick2', 'outro']
    : ['intro', 'pick1', 'pick2', 'pick3', 'outro'];

  narrationManifest.blocks.forEach(
    (block, index) => {
      if (
        block.id !== expectedBlockIds[index]
      ) {
        throw new Error(
          `Bloque de narración incorrecto. ` +
          `Se esperaba "${expectedBlockIds[index]}" ` +
          `y llegó "${block.id}".`
        );
      }

      if (
        typeof block.startSeconds !== 'number' ||
        typeof block.durationSeconds !== 'number' ||
        typeof block.endSeconds !== 'number'
      ) {
        throw new Error(
          `Bloque "${block.id}" contiene tiempos inválidos.`
        );
      }

      const audioPath = path.join(
        audioDir,
        block.audio
      );

      ensureExists(
        audioPath,
        `audio del bloque ${block.id}`
      );
    }
  );

  if (
    typeof narrationManifest.totalVideoDurationSeconds !== 'number' ||
    narrationManifest.totalVideoDurationSeconds <= 0
  ) {
    throw new Error(
      'totalVideoDurationSeconds inválido en narration-manifest.json.'
    );
  }

  const totalVideoDurationSeconds =
    narrationManifest.totalVideoDurationSeconds;

  const totalVideoDurationMs =
    Math.ceil(
      totalVideoDurationSeconds * 1000
    );

  // =========================================================
  // NOMBRE DEL PAQUETE
  // =========================================================

  const dateSlug =
    slugify(
      parlayData.date
    );

  const pickSlugs =
    parlayData.picks.map(
      pick =>
        slugify(
          `${pick.homeTeam}-${pick.market}`
        )
    );

  const basePackageName =
    `${dateSlug}__parlay-de-datos__${pickSlugs.join('__')}`;

  const {
    packageName,
    packageDir,
    version
  } = createUniquePackageDirectory(
    basePackageName
  );

  // =========================================================
  // ARCHIVOS DEL PAQUETE
  // =========================================================

  const webmPath = path.join(
    packageDir,
    'source.webm'
  );

  const mp4Path = path.join(
    packageDir,
    'reel.mp4'
  );

  const captionPath = path.join(
    packageDir,
    'caption.txt'
  );

  const metadataPath = path.join(
    packageDir,
    'metadata.json'
  );

  const parlayDataCopyPath = path.join(
    packageDir,
    'parlay-data.json'
  );

  const narrationManifestCopyPath = path.join(
    packageDir,
    'narration-manifest.json'
  );

  const narrationTextCopyPath = path.join(
    packageDir,
    'narration.txt'
  );

  const musicCopyPath = path.join(
    packageDir,
    'music.wav'
  );

  // =========================================================
  // DISCLAIMER
  // =========================================================

  const disclaimer =
    '⚠️ Las probabilidades mostradas son estimaciones estadísticas basadas en datos históricos y no garantizan resultados futuros.';

  // =========================================================
  // CAPTION
  // =========================================================

  const captionLines = [];

  captionLines.push(
    '📊 PARLAY DE DATOS'
  );

  captionLines.push('');

  captionLines.push(
    `${parlayData.picks.length} picks respaldados individualmente por estadísticas de DataFut:`
  );

  captionLines.push('');

  parlayData.picks.forEach(
    (pick, index) => {
      captionLines.push(
        `${index + 1}️⃣ ${pick.homeTeam} vs ${pick.awayTeam}`
      );

      captionLines.push(
        `📈 ${pick.market}: ${pick.percentage}%`
      );

      captionLines.push(
        `• ${pick.evidence[0].label}: ` +
        `${pick.evidence[0].value} ` +
        `${pick.evidence[0].detail}`
      );

      captionLines.push(
        `• ${pick.evidence[1].label}: ` +
        `${pick.evidence[1].value} ` +
        `${pick.evidence[1].detail}`
      );

      captionLines.push('');
    }
  );

  captionLines.push(
    'Cada porcentaje representa el respaldo individual del modelo para ese mercado.'
  );

  captionLines.push('');

  captionLines.push(
    'No representa la probabilidad conjunta de la combinación.'
  );

  captionLines.push('');

  captionLines.push(
    'Más estadísticas y análisis en data-fut.com'
  );

  captionLines.push('');

  captionLines.push(
    disclaimer
  );

  captionLines.push('');

  captionLines.push(
    '#DataFut #Futbol #Estadisticas #AnalisisDeportivo #ParlayDeDatos'
  );

  const caption =
    captionLines.join('\n');

  // =========================================================
  // METADATA
  // =========================================================

  const metadata = {
    id:
      packageName,

    format:
      'parlay-de-datos',

    status:
      'rendering',

    disclaimer,

    probabilityNotice:
      'Los porcentajes corresponden a respaldos individuales. No se calcula ni comunica una probabilidad conjunta del parlay.',

    voice: {
      provider:
        'edge-tts',

      voice:
        narrationManifest.voice,

      rate:
        narrationManifest.rate
    },

    music: {
      preset:
        musicPreset,

      source:
        musicConfig.file,

      packageFile:
        'music.wav',

      volume:
        musicConfig.volume
    },

    platforms: [
      'instagram-reels',
      'tiktok',
      'youtube-shorts'
    ],

    date:
      parlayData.date,

    title:
      parlayData.title,

    picks:
      parlayData.picks,

    narration: {
      totalAudioDurationSeconds:
        narrationManifest.totalAudioDurationSeconds,

      totalVideoDurationSeconds:
        narrationManifest.totalVideoDurationSeconds,

      blocks:
        narrationManifest.blocks
    },

    files: {
      video:
        'reel.mp4',

      source:
        'source.webm',

      caption:
        'caption.txt',

      parlayData:
        'parlay-data.json',

      narrationManifest:
        'narration-manifest.json',

      narrationText:
        'narration.txt',

      music:
        'music.wav'
    },

    publish: {
      instagram:
        false,

      tiktok:
        false,

      youtubeShorts:
        false
    },

    version,

    generatedAt:
      new Date().toISOString()
  };

  // =========================================================
  // GUARDAR ARCHIVOS DEL PAQUETE
  // =========================================================

  fs.writeFileSync(
    captionPath,
    caption,
    'utf8'
  );

  fs.writeFileSync(
    metadataPath,
    JSON.stringify(
      metadata,
      null,
      2
    ),
    'utf8'
  );

  fs.copyFileSync(
    dataPath,
    parlayDataCopyPath
  );

  fs.copyFileSync(
    manifestPath,
    narrationManifestCopyPath
  );

  fs.copyFileSync(
    musicPath,
    musicCopyPath
  );

  const narrationTextPath = path.join(
    audioDir,
    'narration.txt'
  );

  if (
    fs.existsSync(
      narrationTextPath
    )
  ) {
    fs.copyFileSync(
      narrationTextPath,
      narrationTextCopyPath
    );
  }

  // =========================================================
  // INFORMACIÓN
  // =========================================================

  console.log('');
  console.log('========================================');
  console.log(' DATAFUT PARLAY VOICE + MUSIC RENDERER');
  console.log('========================================');
  console.log('');

  parlayData.picks.forEach(
    (pick, index) => {
      console.log(
        `Pick ${index + 1}: ${pick.homeTeam} vs ${pick.awayTeam}`
      );

      console.log(
        `Mercado: ${pick.market}`
      );

      console.log(
        `Respaldo: ${pick.percentage}%`
      );

      console.log('');
    }
  );

  console.log(
    `Voz: ${narrationManifest.voice}`
  );

  console.log(
    `Velocidad: ${narrationManifest.rate}`
  );

  console.log('');

  console.log(
    `Música: ${musicPreset}`
  );

  console.log(
    `Archivo música: ${musicConfig.file}`
  );

  console.log(
    `Volumen música: ${Math.round(musicConfig.volume * 100)}%`
  );

  console.log('');

  console.log(
    `Duración audio: ${narrationManifest.totalAudioDurationSeconds}s`
  );

  console.log(
    `Duración video: ${totalVideoDurationSeconds}s`
  );

  console.log('');

  console.log(
    `Paquete: ${packageName}`
  );

  console.log(
    `Destino: ${packageDir}`
  );

  console.log('');

  // =========================================================
  // SERVIDOR LOCAL
  // =========================================================

  const server =
    http.createServer(
      (req, res) => {
        try {
          let requestPath =
            decodeURIComponent(
              req.url.split('?')[0]
            );

          if (
            requestPath === '/' ||
            requestPath === ''
          ) {
            requestPath =
              '/parlay-video-template.html';
          }

          const relativePath =
            requestPath.replace(
              /^\/+/,
              ''
            );

          const requestedFile =
            path.resolve(
              projectDir,
              relativePath
            );

          const resolvedProjectDir =
            path.resolve(
              projectDir
            );

          if (
            requestedFile !== resolvedProjectDir &&
            !requestedFile.startsWith(
              resolvedProjectDir +
              path.sep
            )
          ) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
          }

          if (
            !fs.existsSync(
              requestedFile
            )
          ) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }

          const extension =
            path
              .extname(
                requestedFile
              )
              .toLowerCase();

          const contentTypes = {
            '.html':
              'text/html; charset=utf-8',

            '.json':
              'application/json; charset=utf-8',

            '.js':
              'text/javascript; charset=utf-8',

            '.css':
              'text/css; charset=utf-8',

            '.png':
              'image/png',

            '.jpg':
              'image/jpeg',

            '.jpeg':
              'image/jpeg',

            '.webp':
              'image/webp',

            '.svg':
              'image/svg+xml',

            '.mp3':
              'audio/mpeg',

            '.wav':
              'audio/wav',

            '.srt':
              'application/x-subrip; charset=utf-8'
          };

          const contentType =
            contentTypes[extension] ||
            'application/octet-stream';

          res.writeHead(
            200,
            {
              'Content-Type':
                contentType,

              'Cache-Control':
                'no-store'
            }
          );

          fs
            .createReadStream(
              requestedFile
            )
            .pipe(res);
        }

        catch (error) {
          console.error(
            'Error del servidor local:',
            error
          );

          res.writeHead(500);

          res.end(
            'Internal Server Error'
          );
        }
      }
    );

  await new Promise(
    resolve => {
      server.listen(
        0,
        '127.0.0.1',
        resolve
      );
    }
  );

  const address =
    server.address();

  const port =
    address.port;

  const templateUrl =
    `http://127.0.0.1:${port}/parlay-video-template.html`;

  console.log(
    `Template local: ${templateUrl}`
  );

  console.log('');

  // =========================================================
  // PLAYWRIGHT
  // =========================================================

  const browser =
    await chromium.launch({
      headless: true,

      args: [
        '--disable-gpu-throttling',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

  const context =
    await browser.newContext({
      viewport: {
        width: 1080,
        height: 1920
      },

      deviceScaleFactor:
        1,

      recordVideo: {
        dir:
          packageDir,

        size: {
          width:
            1080,

          height:
            1920
        }
      }
    });

  const page =
    await context.newPage();

  let video;

  try {
    // =======================================================
    // CARGAR TEMPLATE
    // =======================================================

    await page.goto(
      templateUrl,
      {
        waitUntil:
          'networkidle'
      }
    );

    console.log(
      'Esperando RENDER_READY...'
    );

    await page.waitForFunction(
      () =>
        window.RENDER_READY === true ||
        window.RENDER_ERROR,
      {
        timeout:
          15000
      }
    );

    const renderError =
      await page.evaluate(
        () =>
          window.RENDER_ERROR
      );

    if (renderError) {
      throw new Error(
        `Error del template: ${renderError}`
      );
    }

    // =======================================================
    // CONFIRMAR DURACIÓN HTML
    // =======================================================

    const templateDurationMs =
      await page.evaluate(
        () =>
          window.RENDER_DURATION_MS
      );

    if (
      typeof templateDurationMs !== 'number' ||
      templateDurationMs <= 0
    ) {
      throw new Error(
        'El template no expuso una duración válida en window.RENDER_DURATION_MS.'
      );
    }

    const durationDifference =
      Math.abs(
        templateDurationMs -
        totalVideoDurationMs
      );

    if (
      durationDifference > 100
    ) {
      throw new Error(
        `La duración del template (${templateDurationMs} ms) ` +
        `no coincide con el manifest (${totalVideoDurationMs} ms).`
      );
    }

    console.log(
      `Template listo: ${(templateDurationMs / 1000).toFixed(2)} segundos.`
    );

    // =======================================================
    // GRABACIÓN
    // =======================================================

    console.log(
      'Grabando Reel sincronizado con narración...'
    );

    await page.waitForTimeout(
      templateDurationMs + 400
    );

    video =
      page.video();

    if (!video) {
      throw new Error(
        'Playwright no creó el video.'
      );
    }

    console.log(
      'Finalizando grabación...'
    );

    await page.close();

    await context.close();

    await browser.close();

    const playwrightVideoPath =
      await video.path();

    ensureExists(
      playwrightVideoPath,
      'video generado por Playwright'
    );

    fs.renameSync(
      playwrightVideoPath,
      webmPath
    );

    console.log('');

    console.log(
      `WEBM: ${webmPath}`
    );

    // =======================================================
    // PREPARAR AUDIOS DE VOZ
    // =======================================================

    const narrationInputs = [];

    narrationManifest.blocks.forEach(
      block => {
        const audioPath =
          path.join(
            audioDir,
            block.audio
          );

        narrationInputs.push(
          '-i',
          audioPath
        );
      }
    );

    // =======================================================
    // FILTROS DE VOZ
    // =======================================================

    /*
      Input 0:
      video WEBM

      Inputs 1-5:
      bloques de narración

      Input 6:
      música
    */

    const delayFilters = [];

    narrationManifest.blocks.forEach(
      (block, index) => {
        const ffmpegInputIndex =
          index + 1;

        const delayMs =
          Math.round(
            block.startSeconds * 1000
          );

        delayFilters.push(
          `[${ffmpegInputIndex}:a]` +
          `adelay=${delayMs}:all=1,` +
          `aresample=48000` +
          `[voice${index}]`
        );
      }
    );

    const voiceInputs =
      narrationManifest.blocks
        .map(
          (_, index) =>
            `[voice${index}]`
        )
        .join('');

    // =======================================================
    // FILTRO COMPLETO DE AUDIO
    // =======================================================

    const musicInputIndex =
      narrationManifest.blocks.length + 1;

    const audioFilter = [
      ...delayFilters,

      `${voiceInputs}` +
      `amix=` +
      `inputs=${narrationManifest.blocks.length}:` +
      `duration=longest:` +
      `normalize=0,` +
      `volume=1.0` +
      `[voiceMix]`,

      `[${musicInputIndex}:a]` +
      `aresample=48000,` +
      `volume=${musicConfig.volume}` +
      `[music]`,

      `[voiceMix][music]` +
      `amix=` +
      `inputs=2:` +
      `duration=longest:` +
      `normalize=0,` +
      `alimiter=limit=0.95` +
      `[finalAudio]`
    ]
      .join(';');

    // =======================================================
    // FFMPEG: VIDEO + VOZ + MÚSICA
    // =======================================================

    console.log('');

    console.log(
      'Mezclando voz + música...'
    );

    const ffmpegArgs = [
      '-y',

      '-i',
      webmPath,

      ...narrationInputs,

      '-i',
      musicPath,

      '-filter_complex',
      audioFilter,

      '-map',
      '0:v:0',

      '-map',
      '[finalAudio]',

      '-c:v',
      'libx264',

      '-preset',
      'medium',

      '-crf',
      '18',

      '-pix_fmt',
      'yuv420p',

      '-c:a',
      'aac',

      '-b:a',
      '192k',

      '-ar',
      '48000',

      '-movflags',
      '+faststart',

      '-t',
      String(
        totalVideoDurationSeconds
      ),

      mp4Path
    ];

    await runFfmpeg(
      ffmpegArgs
    );

    ensureExists(
      mp4Path,
      'reel.mp4'
    );

    // =======================================================
    // FINALIZAR METADATA
    // =======================================================

    metadata.status =
      'ready';

    metadata.renderCompletedAt =
      new Date().toISOString();

    metadata.video = {
      width:
        1080,

      height:
        1920,

      durationSeconds:
        totalVideoDurationSeconds,

      format:
        'mp4',

      codec:
        'h264',

      audio:
        true,

      audioCodec:
        'aac',

      voice:
        narrationManifest.voice,

      voiceRate:
        narrationManifest.rate,

      musicPreset,

      musicVolume:
        musicConfig.volume,

      sizeMb:
        Number(
          (
            fs
              .statSync(
                mp4Path
              )
              .size /
            (1024 * 1024)
          ).toFixed(2)
        )
    };

    fs.writeFileSync(
      metadataPath,
      JSON.stringify(
        metadata,
        null,
        2
      ),
      'utf8'
    );

    // =======================================================
    // RESULTADO
    // =======================================================

    console.log('');
    console.log('========================================');
    console.log(' PARLAY CON VOZ + MÚSICA LISTO');
    console.log('========================================');
    console.log('');

    console.log(
      `📁 ${packageDir}`
    );

    console.log('');

    console.log(
      `🎙️ Voz: ${narrationManifest.voice}`
    );

    console.log(
      `⚡ Velocidad: ${narrationManifest.rate}`
    );

    console.log(
      `🎵 Música: ${musicPreset}`
    );

    console.log(
      `🔉 Música: ${Math.round(musicConfig.volume * 100)}%`
    );

    console.log(
      `⏱️ Duración: ${totalVideoDurationSeconds}s`
    );

    console.log('');

    console.log(
      'Archivos del paquete:'
    );

    console.log(
      '  🎬 reel.mp4'
    );

    console.log(
      '  🎞️ source.webm'
    );

    console.log(
      '  📝 caption.txt'
    );

    console.log(
      '  📋 metadata.json'
    );

    console.log(
      '  📊 parlay-data.json'
    );

    console.log(
      '  🎙️ narration.txt'
    );

    console.log(
      '  ⏱️ narration-manifest.json'
    );

    console.log(
      '  🎵 music.wav'
    );

    console.log('');
  }

  catch (error) {
    console.error('');

    console.error(
      'ERROR DURANTE EL RENDER:'
    );

    console.error(
      error
    );

    metadata.status =
      'error';

    metadata.error =
      String(
        error?.message ??
        error
      );

    fs.writeFileSync(
      metadataPath,
      JSON.stringify(
        metadata,
        null,
        2
      ),
      'utf8'
    );

    try {
      await page.close();
    }
    catch {}

    try {
      await context.close();
    }
    catch {}

    try {
      await browser.close();
    }
    catch {}

    throw error;
  }

  finally {
    await new Promise(
      resolve => {
        server.close(
          resolve
        );
      }
    );

    console.log(
      'Servidor local cerrado.'
    );
  }
})();
