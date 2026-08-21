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

  // Click on "Deportes" or "En Vivo" link/button
  const clicked = await page.evaluate(async () => {
    const links = Array.from(document.querySelectorAll('a, button, div, span'));
    const depLink = links.find(el => (el.innerText || '').trim().toLowerCase() === 'deportes' || (el.getAttribute('href') || '').includes('deportes') || (el.getAttribute('href') || '').includes('sports'));
    if (depLink) {
      depLink.click();
      return { found: true, tag: depLink.tagName, href: depLink.getAttribute('href') };
    }
    return { found: false };
  });

  console.log('Clicked Deportes:', clicked);
  await page.waitForTimeout(5000);

  // Check URL and content
  console.log('Current URL after click:', page.url());
  const domInfo = await page.evaluate(() => {
    const oddEls = Array.from(document.querySelectorAll('*')).filter(el => {
      const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
      return cls.includes('odd') || cls.includes('price') || cls.includes('selection') || cls.includes('betslip');
    });
    return {
      title: document.title,
      url: window.location.href,
      oddElsCount: oddEls.length,
      sampleOddEls: oddEls.slice(0, 10).map(e => ({ tag: e.tagName, cls: e.className, text: e.innerText.slice(0, 50) }))
    };
  });

  console.log('DOM Info:', JSON.stringify(domInfo, null, 2));

  await browser.close();
})();
