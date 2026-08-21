const { chromium } = require('@playwright/test');
const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

(async () => {
  const rendersDir = path.join(__dirname, 'renders');
  if (!fs.existsSync(rendersDir)) {
    fs.mkdirSync(rendersDir, { recursive: true });
    console.log('Created directory:', rendersDir);
  }

  console.log('--- STARTING FIXED MOBILE PROMO VIDEO RENDERING ---');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-gpu-throttling',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });

  const context = await browser.newContext({
    recordVideo: {
      dir: rendersDir,
      size: { width: 1080, height: 1920 }
    },
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();
  const htmlPath = 'file:///' + path.join(__dirname, 'promo-video-mobile-fixed.html').replace(/\\/g, '/');
  console.log('Loading mobile video HTML animation:', htmlPath);

  await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });

  // WAIT FOR EXPLICIT RENDER_READY SIGNAL BEFORE RECORDING TIMELINE!
  console.log('Waiting for window.RENDER_READY signal...');
  await page.waitForFunction(() => window.RENDER_READY === true, { timeout: 10000 });
  console.log('window.RENDER_READY is TRUE! Starting 15s recording...');

  // Record 16 seconds for full timeline
  await page.waitForTimeout(16000);

  console.log('Finalizing WebM video file...');
  await page.close();
  await context.close();
  await browser.close();

  // Find recorded WebM video file and rename it to 03-...
  const files = fs.readdirSync(rendersDir);
  const webmFile = files.find(f => f.endsWith('.webm') && f.startsWith('page@'));

  if (webmFile) {
    const oldPath = path.join(rendersDir, webmFile);
    const newWebmPath = path.join(rendersDir, '03-datafut-promo-mobile-fixed-1080x1920.webm');
    if (fs.existsSync(newWebmPath)) {
      fs.unlinkSync(newWebmPath);
    }
    fs.renameSync(oldPath, newWebmPath);
    const webmSizeMb = (fs.statSync(newWebmPath).size / (1024 * 1024)).toFixed(2);
    console.log('Fixed WebM Video render completed!');
    console.log('WebM File Path:', newWebmPath);
    console.log('WebM File Size:', webmSizeMb + ' MB');

    // Convert WebM to MP4 using ffmpeg-static
    const newMp4Path = path.join(rendersDir, '03-datafut-promo-mobile-fixed-1080x1920.mp4');
    console.log('\n--- CONVERTING FIXED WEBM TO MP4 ---');
    const cmd = `"${ffmpegPath}" -y -i "${newWebmPath}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 "${newMp4Path}"`;
    execSync(cmd, { stdio: 'inherit' });

    if (fs.existsSync(newMp4Path)) {
      const mp4SizeMb = (fs.statSync(newMp4Path).size / (1024 * 1024)).toFixed(2);
      console.log('Fixed MP4 conversion completed successfully!');
      console.log('MP4 File Path:', newMp4Path);
      console.log('MP4 File Size:', mp4SizeMb + ' MB');
    }
  } else {
    console.error('Error: WebM file not found in renders folder.');
  }

  console.log('--- FIXED RENDER SCRIPT COMPLETED ---');
})();
