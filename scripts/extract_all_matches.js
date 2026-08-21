const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const sessionPath = path.join(__dirname, '..', 'datafut-marketing-session.json');
  const context = await browser.newContext({
    storageState: fs.existsSync(sessionPath) ? sessionPath : undefined,
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  // 1. Home page matches
  await page.goto('https://data-fut.com/', { waitUntil: 'networkidle' });
  const homeLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="partido.html"]')).map(a => ({
      source: 'home',
      text: a.innerText.replace(/\n+/g, ' | ').trim(),
      href: a.getAttribute('href')
    }));
  });

  // 2. Calendario matches
  await page.goto('https://data-fut.com/calendario.html', { waitUntil: 'networkidle' });
  // Click on JUE 20 if clickable
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, div, span, a'));
    const jue = buttons.find(b => b.innerText.includes('JUE') || (b.innerText.includes('20') && b.innerText.includes('partidos')));
    if (jue) jue.click();
  });
  await page.waitForTimeout(1500);

  const calLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="partido.html"]')).map(a => ({
      source: 'calendario',
      text: a.innerText.replace(/\n+/g, ' | ').trim(),
      href: a.getAttribute('href')
    }));
  });

  // Combine and deduplicate match URLs
  const allLinksMap = new Map();
  [...homeLinks, ...calLinks].forEach(item => {
    if (item.href) {
      // Normalize href
      const fullUrl = new URL(item.href, 'https://data-fut.com').href;
      const urlObj = new URL(fullUrl);
      const partidoParam = urlObj.searchParams.get('partido');
      if (partidoParam && !allLinksMap.has(partidoParam)) {
        allLinksMap.set(partidoParam, {
          url: fullUrl,
          text: item.text,
          partidoId: partidoParam
        });
      }
    }
  });

  console.log(`Found ${allLinksMap.size} unique matches:`);
  for (const [id, m] of allLinksMap) {
    console.log(`ID ${id}: ${m.text.slice(0, 100)} -> ${m.url}`);
  }

  await browser.close();
})();
