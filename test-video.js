const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const rendersDir = path.join(__dirname, 'renders');
  if (!fs.existsSync(rendersDir)) {
    fs.mkdirSync(rendersDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: rendersDir,
      size: { width: 1080, height: 1920 }
    },
    viewport: { width: 1080, height: 1920 }
  });

  const page = await context.newPage();
  await page.setContent('<html><body style="background:black;color:white;display:flex;align-items:center;justify-content:center;height:100vh;"><h1>TEST VIDEO</h1></body></html>');
  await page.waitForTimeout(2000);

  await page.close();
  await context.close();
  await browser.close();

  const files = fs.readdirSync(rendersDir);
  console.log('Files in renders dir:', files);
})();
