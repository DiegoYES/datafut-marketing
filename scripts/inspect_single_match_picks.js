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

  // Test extracting all predictions from Athletic Club vs CRB
  const url = 'https://data-fut.com/partido.html?local=13975&visitante=146&liga=72&partido=1520820&fecha=2026-08-20';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const rawPicks = await page.evaluate(() => {
    // Get team names from header
    const homeTeam = document.querySelector('.equipo-local, .local-name, h1, h2')?.innerText?.trim() || '';
    const awayTeam = document.querySelector('.equipo-visitante, .visitante-name')?.innerText?.trim() || '';
    
    // Find all pick elements
    const cards = Array.from(document.querySelectorAll('.tarjeta-pick, [class*="pick-card"], .card-pick, div')).filter(el => {
      const txt = el.innerText || '';
      return txt.includes('%') && (txt.includes('¿Por qué') || txt.includes('Guardar pick') || txt.includes('De dónde sale'));
    });

    // Extract detailed card structures
    return cards.map(c => {
      return {
        html: c.innerHTML.slice(0, 300),
        text: c.innerText.trim()
      };
    });
  });

  console.log(`Extracted ${rawPicks.length} raw pick containers.`);
  console.log('Sample pick structure:\n', rawPicks[0]?.text);
  console.log('\nSample pick 2:\n', rawPicks[1]?.text);
  console.log('\nSample pick 3:\n', rawPicks[2]?.text);
  console.log('\nSample pick 4:\n', rawPicks[3]?.text);

  await browser.close();
})();
