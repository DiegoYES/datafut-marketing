const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { readJson } = require('./scripts/lib/validation');
const { validateCertifiedContent } = require('./scripts/lib/certified-content');

(async () => {
  const projectDir = __dirname;

  const htmlPath = path.join(
    projectDir,
    'promo-video-template.html'
  );

  const dataPath = path.join(
    projectDir,
    'promo-data.json'
  );

  const audioDir = path.join(
    projectDir,
    'promo-audio'
  );

  const narrationManifestPath = path.join(
    audioDir,
    'narration-manifest.json'
  );

  const rendersDir = path.join(
    projectDir,
    'renders'
  );

  const certification = validateCertifiedContent(readJson(dataPath), projectDir);
  certification.warnings.forEach(warning => console.warn(`ADVERTENCIA: ${warning}`));
  if (certification.errors.length > 0) {
    throw new Error(
      `RENDER BLOQUEADO: el pick individual no procede del pipeline certificado:\n- ${certification.errors.join('\n- ')}`
    );
  }

  // =========================================================
  // MÚSICA
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

    while (
      fs.existsSync(
        packageDir
      )
    ) {
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
            } else {
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
  // COMPROBACIONES
  // =========================================================

  ensureExists(
    htmlPath,
    'promo-video-template.html'
  );

  ensureExists(
    dataPath,
    'promo-data.json'
  );

  ensureExists(
    narrationManifestPath,
    'promo-audio/narration-manifest.json'
  );

  if (
    !fs.existsSync(
      rendersDir
    )
  ) {
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

  const promoData =
    JSON.parse(
      fs.readFileSync(
        dataPath,
        'utf8'
      )
    );

  const narrationManifest =
    JSON.parse(
      fs.readFileSync(
        narrationManifestPath,
        'utf8'
      )
    );

  // =========================================================
  // VALIDAR PROMO
  // =========================================================

  const requiredFields = [
    'date',
    'league',
    'homeTeam',
    'awayTeam',
    'market',
    'percentage',
    'sampleText',
    'evidence'
  ];

  for (
    const field
    of requiredFields
  ) {
    if (
      promoData[field] === undefined ||
      promoData[field] === null
    ) {
      throw new Error(
        `Falta el campo obligatorio "${field}" en promo-data.json`
      );
    }
  }

  if (
    typeof promoData.percentage !== 'number' ||
    Number.isNaN(
      promoData.percentage
    )
  ) {
    throw new Error(
      'percentage debe ser un número.'
    );
  }

  if (
    !Array.isArray(
      promoData.evidence
    ) ||
    promoData.evidence.length < 2
  ) {
    throw new Error(
      'promo-data.json debe contener al menos dos evidencias.'
    );
  }

  // =========================================================
  // VALIDAR NARRACIÓN
  // =========================================================

  if (
    !Array.isArray(
      narrationManifest.blocks
    ) ||
    narrationManifest.blocks.length !== 4
  ) {
    throw new Error(
      'narration-manifest.json debe contener exactamente 4 bloques.'
    );
  }

  const expectedBlockIds = [
    'intro',
    'market',
    'evidence',
    'outro'
  ];

  narrationManifest.blocks.forEach(
    (block, index) => {
      if (
        block.id !==
        expectedBlockIds[index]
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

      const audioPath =
        path.join(
          audioDir,
          block.audio
        );

      ensureExists(
        audioPath,
        `audio del bloque ${block.id}`
      );

      const subtitlePath =
        path.join(
          audioDir,
          block.subtitles
        );

      ensureExists(
        subtitlePath,
        `subtítulos del bloque ${block.id}`
      );
    }
  );

  if (
    typeof narrationManifest.totalVideoDurationSeconds !== 'number' ||
    narrationManifest.totalVideoDurationSeconds <= 0
  ) {
    throw new Error(
      'totalVideoDurationSeconds inválido.'
    );
  }

  const totalVideoDurationSeconds =
    narrationManifest
      .totalVideoDurationSeconds;

  const totalVideoDurationMs =
    Math.ceil(
      totalVideoDurationSeconds *
      1000
    );

  // =========================================================
  // PRESET DE MÚSICA
  // =========================================================

  const musicPreset =
    promoData.musicPreset ||
    'analysis';

  if (
    !Object.prototype
      .hasOwnProperty
      .call(
        MUSIC_PRESETS,
        musicPreset
      )
  ) {
    throw new Error(
      `musicPreset inválido: "${musicPreset}". ` +
      'Permitidos: analysis, energy, tension.'
    );
  }

  const musicConfig =
    MUSIC_PRESETS[
      musicPreset
    ];

  const musicPath =
    path.join(
      projectDir,
      musicConfig.file
    );

  ensureExists(
    musicPath,
    `música "${musicPreset}"`
  );

  // =========================================================
  // NOMBRE DEL PAQUETE
  // =========================================================

  const dateSlug =
    slugify(
      promoData.date
    );

  const homeSlug =
    slugify(
      promoData.homeTeam
    );

  const awaySlug =
    slugify(
      promoData.awayTeam
    );

  const marketSlug =
    slugify(
      promoData.market
    );

  const basePackageName =
    `${dateSlug}__${homeSlug}-vs-${awaySlug}__${marketSlug}`;

  const {
    packageName,
    packageDir,
    version
  } =
    createUniquePackageDirectory(
      basePackageName
    );

  // =========================================================
  // ARCHIVOS DEL PAQUETE
  // =========================================================

  const webmPath =
    path.join(
      packageDir,
      'source.webm'
    );

  const mp4Path =
    path.join(
      packageDir,
      'reel.mp4'
    );

  const captionPath =
    path.join(
      packageDir,
      'caption.txt'
    );

  const metadataPath =
    path.join(
      packageDir,
      'metadata.json'
    );

  const promoDataCopyPath =
    path.join(
      packageDir,
      'promo-data.json'
    );

  const narrationManifestCopyPath =
    path.join(
      packageDir,
      'narration-manifest.json'
    );

  const narrationTextCopyPath =
    path.join(
      packageDir,
      'narration.txt'
    );

  const musicCopyPath =
    path.join(
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

  const evidence1 =
    promoData.evidence[0];

  const evidence2 =
    promoData.evidence[1];

  const caption =
`👀 Ojo con ${promoData.homeTeam} vs ${promoData.awayTeam}.

📊 DataFut detecta un ${promoData.percentage}% de respaldo para ${promoData.market.toLowerCase()}.

📈 ${evidence1.team}: ${evidence1.value} ${evidence1.label.toLowerCase()}.
📈 ${evidence2.team}: ${evidence2.value} ${evidence2.label.toLowerCase()}.

¿Se cumplirá hoy? ⚽

Más estadísticas y análisis en data-fut.com

${disclaimer}

#DataFut #Futbol #Estadisticas #AnalisisDeportivo`;

  // =========================================================
  // METADATA
  // =========================================================

  const metadata = {
    id:
      packageName,

    format:
      'ojo-con-este-partido',

    status:
      'rendering',

    disclaimer,

    platforms: [
      'instagram-reels',
      'tiktok',
      'youtube-shorts'
    ],

    date:
      promoData.date,

    league:
      promoData.league,

    match: {
      homeTeam:
        promoData.homeTeam,

      awayTeam:
        promoData.awayTeam,

      display:
        `${promoData.homeTeam} vs ${promoData.awayTeam}`
    },

    prediction: {
      market:
        promoData.market,

      percentage:
        promoData.percentage,

      sampleText:
        promoData.sampleText
    },

    evidence:
      promoData.evidence,

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

    narration: {
      totalAudioDurationSeconds:
        narrationManifest
          .totalAudioDurationSeconds,

      totalVideoDurationSeconds:
        narrationManifest
          .totalVideoDurationSeconds,

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

      promoData:
        'promo-data.json',

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
  // GUARDAR ARCHIVOS
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
    promoDataCopyPath
  );

  fs.copyFileSync(
    narrationManifestPath,
    narrationManifestCopyPath
  );

  fs.copyFileSync(
    musicPath,
    musicCopyPath
  );

  const narrationTextPath =
    path.join(
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
  // INFO
  // =========================================================

  console.log('');
  console.log('========================================');
  console.log(' DATAFUT PROMO VOICE + MUSIC RENDERER');
  console.log('========================================');
  console.log('');

  console.log(
    `Partido: ${promoData.homeTeam} vs ${promoData.awayTeam}`
  );

  console.log(
    `Mercado: ${promoData.market}`
  );

  console.log(
    `Respaldo: ${promoData.percentage}%`
  );

  console.log('');

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
    `Volumen música: ${Math.round(musicConfig.volume * 100)}%`
  );

  console.log('');

  console.log(
    `Duración narración: ${narrationManifest.totalAudioDurationSeconds}s`
  );

  console.log(
    `Duración video: ${totalVideoDurationSeconds}s`
  );

  console.log('');

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
              '/promo-video-template.html';
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
    `http://127.0.0.1:${port}/promo-video-template.html`;

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
        width:
          1080,

        height:
          1920
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
    // DURACIÓN
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
        'El template no expuso una duración válida.'
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
        `Duración del template (${templateDurationMs} ms) ` +
        `no coincide con el manifest (${totalVideoDurationMs} ms).`
      );
    }

    console.log(
      `Template listo: ${(templateDurationMs / 1000).toFixed(2)}s`
    );

    // =======================================================
    // GRABAR
    // =======================================================

    console.log(
      'Grabando Reel con subtítulos...'
    );

    await page.waitForTimeout(
      templateDurationMs +
      400
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
    // INPUTS DE VOZ
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

    /*
      FFmpeg:

      Input 0:
      video

      Input 1:
      intro

      Input 2:
      market

      Input 3:
      evidence

      Input 4:
      outro

      Input 5:
      music
    */

    const delayFilters = [];

    narrationManifest.blocks.forEach(
      (block, index) => {
        const inputIndex =
          index +
          1;

        const delayMs =
          Math.round(
            block.startSeconds *
            1000
          );

        delayFilters.push(
          `[${inputIndex}:a]` +
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
    // MEZCLA AUDIO
    // =======================================================

    const audioFilter = [
      ...delayFilters,

      `${voiceInputs}` +
      `amix=` +
      `inputs=${narrationManifest.blocks.length}:` +
      `duration=longest:` +
      `normalize=0,` +
      `volume=1.0` +
      `[voiceMix]`,

      `[5:a]` +
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
    ].join(';');

    // =======================================================
    // FFMPEG FINAL
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
    // METADATA FINAL
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

      subtitles:
        true,

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
    console.log(' OJO CON ESTE PARTIDO LISTO');
    console.log('========================================');
    console.log('');

    console.log(
      `📁 ${packageDir}`
    );

    console.log('');

    console.log(
      `⚽ ${promoData.homeTeam} vs ${promoData.awayTeam}`
    );

    console.log(
      `📊 ${promoData.market} — ${promoData.percentage}%`
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
      `💬 Subtítulos: sí`
    );

    console.log(
      `⏱️ Duración: ${totalVideoDurationSeconds}s`
    );

    console.log('');

    console.log(
      'Archivos:'
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
      '  📊 promo-data.json'
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
