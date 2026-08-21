const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  console.log('--- INSPECTING ALL PREDICTIONS ON DATAFUT ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: path.join(__dirname, 'datafut-session.json'),
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await page.goto('https://data-fut.com/', { waitUntil: 'networkidle' });

  // Get all match links
  const matches = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="partido.html"]'));
    return links.map(a => ({
      text: a.innerText.replace(/\n+/g, ' ').trim(),
      href: a.getAttribute('href')
    }));
  });

  console.log(`Found ${matches.length} matches on home page.\n`);

  const results = [];

  for (const m of matches) {
    const fullUrl = new URL(m.href, 'https://data-fut.com').href;
    await page.goto(fullUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const matchPicks = await page.evaluate(() => {
      const title = document.title;
      // Extract all text elements containing percentages or picks
      const pickCards = Array.from(document.querySelectorAll('[class*="pick"], [class*="card"], div')).filter(el => {
        const txt = el.innerText || '';
        return txt.includes('%') && (txt.includes(' Over ') || txt.includes(' Under ') || txt.includes(' anota') || txt.includes(' goles') || txt.includes('marca') || txt.includes('Córners') || txt.includes('Tarjetas') || txt.includes('Tiros'));
      }).map(el => el.innerText.replace(/\n+/g, ' ').trim());

      const fullPageText = document.body.innerText.replace(/\n+/g, ' ');

      return {
        title,
        pickCards: pickCards.slice(0, 10),
        fullPageTextSnippet: fullPageText.slice(0, 2000)
      };
    });

    results.push({
      matchText: m.text,
      href: m.href,
      details: matchPicks
    });
  }

  console.log('--- DETAILED MATCH RESULTS ---');
  results.forEach((r, idx) => {
    console.log(`\n=== MATCH [${idx}]: ${r.details.title} ===`);
    console.log('Home link info:', r.matchText);
    console.log('Pick Cards found:', r.details.pickCards);
  });

  await browser.close();
})();
