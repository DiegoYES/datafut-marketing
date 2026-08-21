const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== SCRAPING ALL DATAFUT MATCHES FOR 2026-08-21 ===');
  const sessionPath = path.join(__dirname, '..', 'datafut-marketing-session.json');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: fs.existsSync(sessionPath) ? sessionPath : undefined,
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  // Navigate to calendar for 2026-08-21
  await page.goto('https://data-fut.com/calendario.html?fecha=2026-08-21', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3000);

  const matchLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="partido.html"]')).map(a => {
      const parent = a.closest('.tarjeta-partido, [class*="match"], .card, div') || a;
      return {
        url: a.href,
        text: a.innerText.replace(/\n+/g, ' ').trim(),
        fullCardText: parent.innerText.replace(/\n+/g, ' | ').trim()
      };
    });
  });

  // Deduplicate by URL
  const uniqueUrls = new Map();
  matchLinks.forEach(m => {
    if (!uniqueUrls.has(m.url)) uniqueUrls.set(m.url, m);
  });

  console.log(`Found ${uniqueUrls.size} unique match links in DataFut calendar for 2026-08-21.`);

  const matchesDetails = [];

  for (const [url, info] of uniqueUrls) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    const matchInfo = await page.evaluate((urlStr) => {
      // Get title, teams, league
      const headerText = document.querySelector('h1, h2, .titulo, .header-partido')?.innerText || document.title;
      const allText = document.body.innerText;

      // Extract pick cards
      const cards = Array.from(document.querySelectorAll('.tarjeta-pick, [class*="pick-card"], .card-pick, div')).filter(el => {
        const txt = el.innerText || '';
        return txt.includes('%') && (txt.includes('¿Por qué') || txt.includes('De dónde sale') || txt.includes('Guardar pick'));
      });

      const seen = new Set();
      const picks = [];

      for (const card of cards) {
        if (card.querySelectorAll('.tarjeta-pick, [class*="pick-card"], .card-pick').length > 1) continue;
        const lines = card.innerText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) continue;

        const marketTitle = lines[0];
        if (seen.has(marketTitle)) continue;
        seen.add(marketTitle);

        const pctLine = lines.find(l => /^\d+(\.\d+)?%$/.test(l));
        const percentage = pctLine ? parseFloat(pctLine.replace('%', '')) : null;
        const sampleLine = lines.find(l => l.includes('muestra'));

        const deDondeIdx = lines.findIndex(l => l.includes('De dónde sale'));
        let evidenceText = [];
        if (deDondeIdx !== -1 && lines[deDondeIdx + 1]) {
          evidenceText.push(lines[deDondeIdx + 1]);
        } else {
          const fuenteLine = lines.find(l => l.includes('Fuente local:') || l.includes('Fuente visitante:'));
          if (fuenteLine) evidenceText.push(fuenteLine);
        }

        picks.push({
          rawTitle: marketTitle,
          percentage,
          sampleLine: sampleLine || '',
          evidenceText
        });
      }

      return {
        url: urlStr,
        header: headerText,
        title: document.title,
        picks
      };
    }, url);

    console.log(` - URL: ${url} | Title: ${matchInfo.title} | Picks: ${matchInfo.picks.length}`);
    matchesDetails.push(matchInfo);
  }

  fs.writeFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), JSON.stringify(matchesDetails, null, 2));
  console.log(`Saved ${matchesDetails.length} matches details to scripts/datafut_2026_08_21_raw.json`);

  await browser.close();
})();
