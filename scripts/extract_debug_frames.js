const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

(async () => {
  const videoDir = path.join(__dirname, '..', 'renders', 'parlay_2026-08-21_estudiantes-r-o-cuarto_vs_audax-italiano');
  const videoPath = path.join(videoDir, 'parlay-vertical-1080x1920.mp4');
  const debugFramesDir = path.join(videoDir, 'debug_check_frames');
  if (!fs.existsSync(debugFramesDir)) fs.mkdirSync(debugFramesDir, { recursive: true });

  console.log('Extrayendo fotogramas clave del video...');

  // Extract frames at 1s, 5s, 10s, 15s, 20s
  await new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-y',
      '-i', videoPath,
      '-vf', 'fps=1',
      path.join(debugFramesDir, 'frame_%02d.png')
    ]);
    proc.on('close', code => code === 0 ? resolve() : reject(code));
  });

  const frames = fs.readdirSync(debugFramesDir);
  console.log(`Extraídos ${frames.length} fotogramas de depuración:`);
  frames.forEach(f => console.log(`- ${f}`));
})();
