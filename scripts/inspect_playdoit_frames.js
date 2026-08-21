const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navigating to PlayDoIt Sports...');
  await page.goto('https://www.playdoit.mx/sports', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(4000);

  // Check frames
  const frames = page.frames();
  console.log(`Found ${frames.length} frames.`);
  frames.forEach((f, idx) => {
    console.log(`Frame ${idx}: name="${f.name()}", url="${f.url()}"`);
  });

  // Check interactive elements on main page and all frames
  for (let idx = 0; idx < frames.length; idx++) {
    const f = frames[idx];
    try {
      const text = await f.evaluate(() => document.body ? document.body.innerText.slice(0, 500) : 'empty');
      console.log(`\nFrame ${idx} (${f.name()}): ${text.replace(/\n+/g, ' ')}`);
    } catch(e) {
      console.log(`Frame ${idx} error reading body:`, e.message);
    }
  }

  // Check search bar or sport tabs
  const searchInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input[type="text"], input[type="search"], input[placeholder]')).map(i => ({
      placeholder: i.placeholder,
      id: i.id,
      name: i.name,
      className: i.className
    }));
  });
  console.log('Search inputs:', searchInputs);

  await browser.close();
})();
