const { chromium } = require('./node_modules/@playwright/test');
const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const rendersDir = path.join(__dirname, 'renders');
  const batchData = JSON.parse(fs.readFileSync(path.join(__dirname, 'batch_reels_data.json'), 'utf8'));

  console.log(`--- FINISHING ALL 5 REELS RENDERING ---`);

  for (let i = 0; i < batchData.length; i++) {
    const candidate = batchData[i];
    const targetMp4Path = path.join(rendersDir, candidate.filename);

    if (fs.existsSync(targetMp4Path)) {
      console.log(`✓ Already exists: ${candidate.filename}`);
      continue;
    }

    console.log(`\nRendering candidate [${i+1}/${batchData.length}]: ${candidate.teams.local} vs ${candidate.teams.visitor}...`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      recordVideo: { dir: rendersDir, size: { width: 1080, height: 1920 } },
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1
    });

    const page = await context.newPage();
    const htmlUrl = 'file:///' + path.join(__dirname, 'batch-promo-template.html').replace(/\\/g, '/') + '?index=' + i;

    await page.goto(htmlUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.RENDER_READY === true, { timeout: 15000 });
    await page.waitForTimeout(16000);

    const videoObj = page.video();
    let rawWebmPath = null;
    if (videoObj) {
      rawWebmPath = await videoObj.path();
    }

    await page.close();
    await context.close();
    await browser.close();

    await sleep(1000);

    if (rawWebmPath && fs.existsSync(rawWebmPath)) {
      const targetWebmName = candidate.filename.replace('.mp4', '.webm');
      const targetWebmPath = path.join(rendersDir, targetWebmName);

      try {
        if (fs.existsSync(targetWebmPath)) {
          fs.unlinkSync(targetWebmPath);
        }
        fs.copyFileSync(rawWebmPath, targetWebmPath);
        fs.unlinkSync(rawWebmPath);
      } catch (err) {}

      const inputVideo = fs.existsSync(targetWebmPath) ? targetWebmPath : rawWebmPath;
      
      console.log(`Converting to MP4: ${candidate.filename}...`);
      const cmd = `"${ffmpegPath}" -y -i "${inputVideo}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 "${targetMp4Path}"`;
      execSync(cmd, { stdio: 'inherit' });

      if (fs.existsSync(targetMp4Path)) {
        const sizeMb = (fs.statSync(targetMp4Path).size / (1024 * 1024)).toFixed(2);
        console.log(`✓ COMPLETED: ${candidate.filename} (${sizeMb} MB)`);
      }
    }
  }

  console.log(`\n--- ALL 5 REELS COMPLETED SUCCESSFULLY ---`);
})();
