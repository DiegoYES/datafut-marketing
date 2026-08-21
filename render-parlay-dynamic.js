const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

(async () => {
  const projectDir = __dirname;
  const htmlPath = path.join(projectDir, 'parlay-video-template.html');
  const dataPath = path.join(projectDir, 'parlay-data.json');
  const audioDir = path.join(projectDir, 'parlay-audio');
  const manifestPath = path.join(audioDir, 'narration-manifest.json');
  const rendersDir = path.join(projectDir, 'renders');

  if (!fs.existsSync(rendersDir)) fs.mkdirSync(rendersDir, { recursive: true });

  const parlayData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const narrationManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const picksCount = parlayData.picks.length;

  console.log(`Iniciando render dinámico de parlay (${picksCount} picks)...`);

  // Target output directory
  const videoSlug = `parlay_${parlayData.date}_${parlayData.picks.map(p => p.homeTeam.toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('_vs_')}`;
  const packageDir = path.join(rendersDir, videoSlug);
  if (!fs.existsSync(packageDir)) fs.mkdirSync(packageDir, { recursive: true });

  const rawFramesDir = path.join(packageDir, 'frames');
  if (fs.existsSync(rawFramesDir)) fs.rmSync(rawFramesDir, { recursive: true, force: true });
  fs.mkdirSync(rawFramesDir, { recursive: true });

  // 1. Build combined audio
  console.log('Concatenando pistas de audio...');
  const combinedAudioPath = path.join(packageDir, 'voice-track.mp3');
  const audioListFile = path.join(packageDir, 'audio-concat-list.txt');
  
  const concatLines = narrationManifest.blocks.map(b => `file '${path.join(audioDir, b.audio).replace(/\\/g, '/')}'`);
  fs.writeFileSync(audioListFile, concatLines.join('\n'));

  await new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', audioListFile,
      '-c', 'copy',
      combinedAudioPath
    ]);
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg audio concat error: ${code}`)));
  });

  // 2. Start local HTTP server for rendering
  const server = http.createServer((req, res) => {
    const filePath = path.join(projectDir, decodeURIComponent(req.url.replace(/^\//, '')));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.writeHead(200);
      fs.createReadStream(filePath).pipe(res);
    } else if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(htmlPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise(r => server.listen(8099, r));
  console.log('Servidor HTTP iniciado en puerto 8099.');

  // 3. Launch browser and render frames
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1
  });

  await page.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Inject parlay data into template
  await page.evaluate(({ data, manifest }) => {
    // Populate data
    const titleEl = document.getElementById('parlayTitle');
    if (titleEl) titleEl.innerText = data.title;
    const subEl = document.getElementById('parlaySubtitle');
    if (subEl) subEl.innerText = data.subtitle;

    // Picks
    data.picks.forEach((p, idx) => {
      const num = idx + 1;
      const lEl = document.getElementById(`pick${num}League`);
      if (lEl) lEl.innerText = p.league;
      const mEl = document.getElementById(`pick${num}Match`);
      if (mEl) mEl.innerText = `${p.homeTeam} vs ${p.awayTeam}`;
      const mktEl = document.getElementById(`pick${num}Market`);
      if (mktEl) mktEl.innerText = p.market;
      const pctEl = document.getElementById(`pick${num}Percentage`);
      if (pctEl) pctEl.innerText = `${p.percentage}%`;
      const sEl = document.getElementById(`pick${num}Sample`);
      if (sEl) sEl.innerText = p.sampleText;

      (p.evidence || []).forEach((ev, eIdx) => {
        const eNum = eIdx + 1;
        const lbl = document.getElementById(`pick${num}Evidence${eNum}Label`);
        if (lbl) lbl.innerText = ev.label;
        const val = document.getElementById(`pick${num}Evidence${eNum}Value`);
        if (val) val.innerText = ev.value;
        const det = document.getElementById(`pick${num}Evidence${eNum}Detail`);
        if (det) det.innerText = ev.detail;
      });

      // Summary scene item
      const sumM = document.getElementById(`summaryPick${num}Match`);
      if (sumM) sumM.innerText = `${p.homeTeam} vs ${p.awayTeam}`;
      const sumMkt = document.getElementById(`summaryPick${num}Market`);
      if (sumMkt) sumMkt.innerText = p.market;
      const sumPct = document.getElementById(`summaryPick${num}Percentage`);
      if (sumPct) sumPct.innerText = `${p.percentage}%`;
    });

    if (data.picks.length === 2) {
      const row3 = document.getElementById('summaryRow3') || document.getElementById('summaryPick3Card');
      if (row3) row3.style.display = 'none';
      const scene4 = document.getElementById('scene4');
      if (scene4) scene4.style.display = 'none';
    }

    window.__MANIFEST__ = manifest;
    window.__PICKS_COUNT__ = data.picks.length;
  }, { data: parlayData, manifest: narrationManifest });

  const fps = 30;
  const totalDuration = narrationManifest.totalDurationSeconds || 24;
  const totalFrames = Math.ceil(totalDuration * fps);

  console.log(`Renderizando ${totalFrames} fotogramas a ${fps} fps (~${totalDuration.toFixed(1)}s)...`);

  for (let frame = 0; frame < totalFrames; frame++) {
    const currentTime = frame / fps;

    await page.evaluate(({ time, manifest, picksCount }) => {
      // Find current active block
      let activeBlock = manifest.blocks[0];
      for (const b of manifest.blocks) {
        if (time >= b.startSeconds) activeBlock = b;
      }

      // Hide all scenes
      const scenes = document.querySelectorAll('.scene');
      scenes.forEach(s => s.classList.remove('active'));

      // Activate corresponding scene
      if (activeBlock.id === 'intro') {
        const s1 = document.getElementById('scene1');
        if (s1) s1.classList.add('active');
      } else if (activeBlock.id === 'pick1') {
        const s2 = document.getElementById('scene2');
        if (s2) s2.classList.add('active');
      } else if (activeBlock.id === 'pick2') {
        const s3 = document.getElementById('scene3');
        if (s3) s3.classList.add('active');
      } else if (activeBlock.id === 'pick3') {
        const s4 = document.getElementById('scene4');
        if (s4) s4.classList.add('active');
      } else if (activeBlock.id === 'outro') {
        const s5 = document.getElementById('scene5');
        if (s5) s5.classList.add('active');
      }

      // Subtitles
      const subBox = document.getElementById('dynamicSubtitles');
      if (subBox) {
        subBox.innerText = activeBlock.text;
      }
    }, { time: currentTime, manifest: narrationManifest, picksCount });

    const frameFile = path.join(rawFramesDir, `frame_${String(frame).padStart(5, '0')}.png`);
    await page.screenshot({ path: frameFile });

    if (frame % 90 === 0) {
      console.log(`Progreso: ${Math.round((frame / totalFrames) * 100)}% (${frame}/${totalFrames})`);
    }
  }

  await browser.close();
  server.close();

  // 4. Compile video with ffmpeg
  console.log('Compilando video final con FFmpeg y música de fondo...');
  const finalVideoPath = path.join(packageDir, 'parlay-vertical-1080x1920.mp4');
  const musicPath = path.join(projectDir, 'datafut-music-energy.wav');

  await new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-r', String(fps),
      '-i', path.join(rawFramesDir, 'frame_%05d.png'),
      '-i', combinedAudioPath
    ];

    if (fs.existsSync(musicPath)) {
      args.push('-i', musicPath);
      args.push(
        '-filter_complex',
        '[1:a]volume=1.0[a1];[2:a]volume=0.15,aloop=loop=-1:size=2e+09[a2];[a1][a2]amix=inputs=2:duration=first[aout]',
        '-map', '0:v',
        '-map', '[aout]'
      );
    } else {
      args.push('-c:a', 'aac', '-b:a', '192k');
    }

    args.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-shortest',
      finalVideoPath
    );

    const proc = spawn(ffmpegPath, args);
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg video render error: ${code}`)));
  });

  // Clean raw frames
  fs.rmSync(rawFramesDir, { recursive: true, force: true });

  console.log(`\n======================================================`);
  console.log(`¡VIDEO RENDERIZADO CON ÉXITO!`);
  console.log(`Ruta del video: ${finalVideoPath}`);
  console.log(`======================================================\n`);
})();
