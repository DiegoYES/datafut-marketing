const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const sessionPath = path.join(__dirname, '..', 'datafut-marketing-session.json');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: fs.existsSync(sessionPath) ? sessionPath : undefined,
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  // Search DataFut for Tepatitlan, Morelia, Alianza, Olimpia, Firpo, Alajuelense
  console.log('Searching DataFut for tonight matches...');
  await page.goto('https://data-fut.com/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3000);

  const searchResults = await page.evaluate(async () => {
    // Check search bar or input if exists
    const allLinks = Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.href }));
    const terms = ['tepatitlan', 'morelia', 'tlaxcala', 'correcaminos', 'alianza', 'olimpia', 'firpo', 'alajuelense', 'expansion', 'expansión'];
    
    const matched = allLinks.filter(l => {
      const t = l.text.toLowerCase();
      const h = l.href.toLowerCase();
      return terms.some(term => t.includes(term) || h.includes(term));
    });

    return {
      matched,
      allLinksCount: allLinks.length
    };
  });

  console.log('Search Results in DataFut:\n', JSON.stringify(searchResults, null, 2));

  // Check the full calendar for 2026-08-20 and 2026-08-21
  const cal20 = await page.evaluate(async () => {
    try {
      const res = await fetch('https://data-fut.com/api/partidos?fecha=2026-08-20');
      if (res.ok) return await res.json();
    } catch(e) {}
    return null;
  });

  const cal21 = await page.evaluate(async () => {
    try {
      const res = await fetch('https://data-fut.com/api/partidos?fecha=2026-08-21');
      if (res.ok) return await res.json();
    } catch(e) {}
    return null;
  });

  console.log('API Partidos 20:', cal20 ? cal20.length : 'no api');
  console.log('API Partidos 21:', cal21 ? cal21.length : 'no api');

  await browser.close();
})();
