const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

(async () => {
  const p1Dir = path.join(__dirname, '..', 'renders', '2026-08-21__parlay-de-datos__estudiantes-rio-cuarto-menos-de-2-5-goles-totales__audax-italiano-menos-de-10-5-corners-totales');
  const p2Dir = path.join(__dirname, '..', 'renders', '2026-08-21__parlay-de-datos__audax-italiano-mas-de-1-5-goles-totales__san-diego-wave-menos-de-3-5-goles-totales');

  const check1 = path.join(p1Dir, 'check_frames');
  const check2 = path.join(p2Dir, 'check_frames');
  if (!fs.existsSync(check1)) fs.mkdirSync(check1, { recursive: true });
  if (!fs.existsSync(check2)) fs.mkdirSync(check2, { recursive: true });

  await new Promise(r => {
    const p = spawn(ffmpegPath, ['-y', '-i', path.join(p1Dir, 'reel.mp4'), '-vf', 'fps=0.5', path.join(check1, 'frame_%02d.png')]);
    p.on('close', r);
  });

  await new Promise(r => {
    const p = spawn(ffmpegPath, ['-y', '-i', path.join(p2Dir, 'reel.mp4'), '-vf', 'fps=0.5', path.join(check2, 'frame_%02d.png')]);
    p.on('close', r);
  });

  console.log('Video 1 frames:', fs.readdirSync(check1));
  console.log('Video 2 frames:', fs.readdirSync(check2));
})();
