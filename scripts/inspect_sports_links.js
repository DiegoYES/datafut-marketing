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
  console.log('Navigating to https://www.playdoit.mx/sports ...');
  await page.goto('https://www.playdoit.mx/sports', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(6000);

  // Take screenshot
  await page.screenshot({ path: path.join(__dirname, 'playdoit_sports_full.png') });

  // List all links in the top menu or page
  const menuLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.innerText.trim(),
      href: a.href
    })).filter(l => l.text.length > 0);
    return links;
  });

  console.log('Menu links on /sports:', JSON.stringify(menuLinks, null, 2));

  await browser.close();
})();
