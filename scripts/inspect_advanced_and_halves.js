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

  const url = 'https://data-fut.com/partido.html?local=13975&visitante=146&liga=72&partido=1520820&fecha=2026-08-20';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const sectionsInfo = await page.evaluate(() => {
    // Find all headings, tabs, accordions, buttons
    const allHeaders = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, button, nav a, [role="tab"]'))
      .map(e => e.innerText.trim())
      .filter(t => t.length > 0 && t.length < 50);

    // Look specifically for anything containing "avanzad", "producci", "tiempo", "jugador", "córner", "tarjeta", "falta", "tiro"
    const relevantElements = Array.from(document.querySelectorAll('*'))
      .filter(e => {
        const t = (e.innerText || '').toLowerCase();
        return t.includes('producción') || t.includes('avanzada') || t.includes('1er tiempo') || t.includes('2do tiempo') || t.includes('primer tiempo') || t.includes('segundo tiempo');
      })
      .map(e => ({
        tag: e.tagName,
        className: e.className,
        text: e.innerText.slice(0, 100).replace(/\n+/g, ' ')
      }));

    return {
      allHeaders: Array.from(new Set(allHeaders)),
      relevantElements: relevantElements.slice(0, 15)
    };
  });

  console.log('Sections / Headers:', sectionsInfo.allHeaders);
  console.log('Advanced / Halves elements found:', sectionsInfo.relevantElements);

  await browser.close();
})();
