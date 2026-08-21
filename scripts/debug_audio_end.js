const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

(async () => {
  const p1Dir = path.join(__dirname, '..', 'renders', '2026-08-21__parlay-de-datos__estudiantes-rio-cuarto-menos-de-2-5-goles-totales__audax-italiano-menos-de-10-5-corners-totales__v3');
  const mp4 = path.join(p1Dir, 'reel.mp4');

  // Let's dump audio from the last 6 seconds of reel.mp4
  const outWav = path.join(p1Dir, 'last_6s_audio.wav');
  await new Promise(r => {
    const proc = spawn(ffmpegPath, ['-y', '-sseof', '-6', '-i', mp4, outWav]);
    proc.on('close', r);
  });

  console.log('Audio extracted to:', outWav);
})();
