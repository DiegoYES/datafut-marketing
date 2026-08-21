const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navegando a PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  const altenarDetails = await page.evaluate(() => {
    const el = document.getElementById('altenar');
    if (!el) return 'No #altenar div';
    return {
      innerHTML: el.innerHTML.substring(0, 500),
      childCount: el.children.length,
      children: Array.from(el.children).map(c => ({ tag: c.tagName, class: c.className, id: c.id }))
    };
  });

  console.log('Altenar container details:', JSON.stringify(altenarDetails, null, 2));

  await browser.close();
})();
