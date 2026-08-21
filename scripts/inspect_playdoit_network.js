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

  const requests = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('altenar') || url.includes('sports') || url.includes('api') || url.includes('widget') || url.includes('wsdk')) {
      requests.push({
        method: req.method(),
        url: url.slice(0, 150)
      });
    }
  });

  console.log('Navigating to https://www.playdoit.mx/sports ...');
  await page.goto('https://www.playdoit.mx/sports', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(8000);

  console.log(`Captured ${requests.length} relevant requests:`);
  requests.slice(0, 25).forEach(r => console.log(` - [${r.method}] ${r.url}`));

  // Inspect the entire HTML body structure
  const htmlStructure = await page.evaluate(() => {
    const rootChildren = Array.from(document.body.children).map(c => ({
      tag: c.tagName,
      id: c.id,
      className: c.className,
      childrenCount: c.children.length,
      htmlSnippet: c.outerHTML.slice(0, 200)
    }));
    return rootChildren;
  });

  console.log('Root children in body:\n', JSON.stringify(htmlStructure, null, 2));

  await browser.close();
})();
