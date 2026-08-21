const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

(async () => {
  const p1Dir = path.join(__dirname, '..', 'renders', '2026-08-21__parlay-de-datos__estudiantes-rio-cuarto-menos-de-2-5-goles-totales__audax-italiano-menos-de-10-5-corners-totales');
  const checkDir = path.join(p1Dir, 'final_verified_frames');
  if (!fs.existsSync(checkDir)) fs.mkdirSync(checkDir, { recursive: true });

  await new Promise(r => {
    const p = spawn(ffmpegPath, ['-y', '-i', path.join(p1Dir, 'reel.mp4'), '-vf', 'fps=0.2', path.join(checkDir, 'frame_%02d.png')]);
    p.on('close', r);
  });

  console.log('Frames extracted:', fs.readdirSync(checkDir));
})();
