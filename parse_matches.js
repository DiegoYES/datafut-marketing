const { chromium } = require('./node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const sessionPath = path.join(__dirname, 'datafut-marketing-session.json');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: fs.existsSync(sessionPath) ? sessionPath : undefined,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await page.goto('https://data-fut.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const matchLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .filter(a => (a.getAttribute('href') || '').includes('partido.html'))
      .map(a => ({
        text: a.innerText.replace(/\n+/g, ' ').trim(),
        url: new URL(a.getAttribute('href'), 'https://data-fut.com').href
      }));
  });

  const parsedCandidates = [];

  for (const m of matchLinks) {
    await page.goto(m.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const info = await page.evaluate(() => {
      const title = document.title;
      // Get team names, competition, predictions, stats
      const bodyText = document.body.innerText;
      
      // Look for cards, percentages, probabilities, stats
      const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);
      
      return {
        title,
        linesSnippet: lines.filter(l => l.includes('%') || l.includes('Over') || l.includes('Under') || l.includes('VS') || l.includes(' vs ') || l.includes('Goles') || l.includes('Córners') || l.includes('Tarjetas') || l.includes('Promedio') || l.includes('Probabilidad')).slice(0, 30),
        fullTextSnippet: bodyText.slice(0, 3000)
      };
    });

    parsedCandidates.push({
      match: m.text,
      url: m.url,
      info
    });
  }

  const outputPath = 'C:\\Users\\diego\\.gemini\\antigravity-cli\\brain\\f5772625-0356-463f-a141-bc967521689d\\candidates_summary.json';
  fs.writeFileSync(outputPath, JSON.stringify(parsedCandidates, null, 2));
  console.log('Done writing summary to', outputPath);

  await browser.close();
})();
