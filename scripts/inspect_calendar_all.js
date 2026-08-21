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

  await page.goto('https://data-fut.com/calendario.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const calData = await page.evaluate(() => {
    const dates = Array.from(document.querySelectorAll('button, a, select option, [class*="date"], [class*="fecha"]')).map(e => e.innerText.trim()).filter(t => /\d{1,2}|hoy|mañana|ayer|ago|sep/i.test(t));
    const matchCards = Array.from(document.querySelectorAll('a[href*="partido.html"]')).map(a => ({
      text: a.innerText.replace(/\n+/g, ' | '),
      href: a.getAttribute('href')
    }));
    return {
      title: document.title,
      dates: dates.slice(0, 20),
      matchCardsCount: matchCards.length,
      matchCards
    };
  });

  console.log('Calendario Data:', JSON.stringify(calData, null, 2));

  await browser.close();
})();
