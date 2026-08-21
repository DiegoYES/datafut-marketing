const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navegando a data-fut.com...');
  await page.goto('https://data-fut.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Look for match links on data-fut.com
  const matchLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="match"], a[href*="partido"], a[href*="stats"]'));
    return anchors.map(a => ({ text: a.innerText.trim(), href: a.href }));
  });

  console.log(`Enlaces de partidos encontrados en data-fut.com: ${matchLinks.length}`);
  matchLinks.forEach(m => console.log(`- ${m.text} -> ${m.href}`));

  await browser.close();
})();
