const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  console.log('Navigating to PlayDoIt home...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  const wInfo = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script')).map(s => s.src).filter(Boolean);
    const altenarScripts = scripts.filter(s => s.toLowerCase().includes('altenar') || s.toLowerCase().includes('sb') || s.toLowerCase().includes('biahosted') || s.toLowerCase().includes('widget'));
    
    // Check Altenar WSDK
    const keys = Object.keys(window).filter(k => k.toLowerCase().includes('wsdk') || k.toLowerCase().includes('altenar') || k.toLowerCase().includes('sportsbook'));

    return {
      totalScripts: scripts.length,
      altenarScripts,
      keys
    };
  });

  console.log('Window Info:', JSON.stringify(wInfo, null, 2));
  await browser.close();
})();
