const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  
  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('response', resp => {
    const url = resp.url();
    if (url.includes('altenar') || url.includes('sport') || url.includes('widget') || url.includes('api')) {
      console.log('PAGE RESP:', resp.status(), url.slice(0, 100));
    }
  });

  console.log('Navigating to https://www.playdoit.mx/ ...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(8000);

  // Check window object for Altenar / WSDK
  const windowCheck = await page.evaluate(() => {
    const keys = [];
    for (let k in window) {
      if (k.toLowerCase().includes('wsdk') || k.toLowerCase().includes('altenar') || k.toLowerCase().includes('sports') || k.toLowerCase().includes('bet')) {
        keys.push(k);
      }
    }
    return {
      keys,
      rootHTML: document.getElementById('root')?.innerHTML?.slice(0, 1000) || 'none'
    };
  });

  console.log('Window Check:', windowCheck);

  await browser.close();
})();
