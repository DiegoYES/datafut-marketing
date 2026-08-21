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
  console.log('Navigating to PlayDoIt sports...');
  await page.goto('https://www.playdoit.mx/sports', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(6000);

  // Take screenshot of sports page
  await page.screenshot({ path: path.join(__dirname, 'playdoit_sports_initial.png') });

  // Inspect all buttons or clickable elements
  const elements = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button, a, div, span'))
      .filter(el => {
        const cls = el.className && typeof el.className === 'string' ? el.className : '';
        const txt = el.innerText || '';
        return cls.includes('odd') || cls.includes('price') || cls.includes('selection') || cls.includes('asb') || txt.includes('+') || txt.includes('-') || txt.includes('Cupón') || txt.includes('Betslip');
      })
      .map(el => ({
        tag: el.tagName,
        cls: el.className,
        text: (el.innerText || '').slice(0, 50).replace(/\n+/g, ' ')
      }));

    return {
      count: all.length,
      sample: all.slice(0, 30)
    };
  });

  console.log('Clickable/Odd elements:', JSON.stringify(elements, null, 2));

  await browser.close();
})();
