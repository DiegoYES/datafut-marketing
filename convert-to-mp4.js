const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

(async () => {
  const rendersDir = path.join(__dirname, 'renders');
  const inputWebm = path.join(rendersDir, '01-datafut-promo-1080x1920.webm');
  const outputMp4 = path.join(rendersDir, '01-datafut-promo-1080x1920.mp4');

  console.log('--- CONVERTING WEBM TO MP4 ---');
  console.log('Input:', inputWebm);
  console.log('Output:', outputMp4);
  console.log('FFmpeg binary path:', ffmpegPath);

  if (!fs.existsSync(inputWebm)) {
    console.error('Error: Input WebM file does not exist.');
    process.exit(1);
  }

  // Convert WebM to MP4 (H.264 / AAC) with YUV420p pixel format for maximum compatibility across mobile devices & video players
  const cmd = `"${ffmpegPath}" -y -i "${inputWebm}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 "${outputMp4}"`;

  console.log('Executing FFmpeg conversion...');
  execSync(cmd, { stdio: 'inherit' });

  if (fs.existsSync(outputMp4)) {
    const sizeMb = (fs.statSync(outputMp4).size / (1024 * 1024)).toFixed(2);
    console.log('MP4 conversion completed successfully!');
    console.log('MP4 File Path:', outputMp4);
    console.log('MP4 File Size:', sizeMb + ' MB');
  } else {
    console.error('Error: MP4 output file was not created.');
  }
})();
