const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Testing PlayDoIt in HEADED mode (headless: false)...');
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome' // or default chromium
  }).catch(async () => {
    return await chromium.launch({ headless: false });
  });

  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();
  try {
    console.log('Navigating to https://www.playdoit.mx/sports ...');
    await page.goto('https://www.playdoit.mx/sports', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    const title = await page.title();
    const url = page.url();
    console.log('Page Title:', title);
    console.log('Page URL:', url);

    const bodySnippet = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 1000) : '');
    console.log('Body snippet:\n', bodySnippet);

    // Check frames
    const frames = page.frames();
    console.log(`Found ${frames.length} frames.`);
    for (let i = 0; i < frames.length; i++) {
      console.log(`Frame ${i}: ${frames[i].url()}`);
    }

  } catch(e) {
    console.error('Error in headed mode:', e);
  } finally {
    await browser.close();
  }
})();
