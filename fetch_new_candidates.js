const { chromium } = require('./node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('--- INSPECTING ALL DATAFUT MATCHES & PREDICTIONS FOR NEW REEL ---');
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
    return Array.from(document.querySelectorAll('a[href*="partido.html"]'))
      .map(a => ({
        text: a.innerText.replace(/\n+/g, ' ').trim(),
        href: a.getAttribute('href')
      }));
  });

  console.log(`Found ${matchLinks.length} match links on DataFut home.`);

  const detailedCandidates = [];

  for (let i = 0; i < matchLinks.length; i++) {
    const m = matchLinks[i];
    const fullUrl = new URL(m.href, 'https://data-fut.com').href;
    await page.goto(fullUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const matchData = await page.evaluate(() => {
      const pageTitle = document.title;
      const bodyText = document.body.innerText;

      // Extract match header (teams, league, date)
      const h1s = Array.from(document.querySelectorAll('h1, h2, h3')).map(e => e.innerText.trim());

      // Extract all card or pick elements
      const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="pick"], [class*="prediction"], div'))
        .map(c => (c.innerText || '').replace(/\n+/g, ' ').trim())
        .filter(txt => txt.includes('%') && (txt.includes('Over') || txt.includes('Under') || txt.includes('marca') || txt.includes('goles') || txt.includes('Córners') || txt.includes('Tarjetas')));

      // Extract stats table or summary text
      const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);

      return {
        pageTitle,
        h1s,
        cards: cards.slice(0, 10),
        linesSnippet: lines.slice(0, 40),
        fullBodySnippet: bodyText.slice(0, 2500)
      };
    });

    detailedCandidates.push({
      matchIndex: i + 1,
      matchText: m.text,
      url: fullUrl,
      title: matchData.pageTitle,
      headings: matchData.h1s,
      cards: matchData.cards,
      fullBody: matchData.fullBodySnippet
    });
  }

  const outputPath = path.join(__dirname, 'new_candidates_raw.json');
  fs.writeFileSync(outputPath, JSON.stringify(detailedCandidates, null, 2));
  console.log('Saved new candidates to:', outputPath);

  await browser.close();
})();
