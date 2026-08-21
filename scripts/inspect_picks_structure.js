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

  // Test Corinthians vs Rosario Central
  const sampleUrl = 'https://data-fut.com/partido.html?local=131&visitante=437&liga=13&partido=1547767&fecha=2026-08-20';
  await page.goto(sampleUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const matchData = await page.evaluate(() => {
    // Check window variables
    let futbolPicksData = null;
    try {
      if (typeof FutbolPicks !== 'undefined') {
        futbolPicksData = FutbolPicks;
      }
    } catch(e) {}

    // Check all pick cards rendered in DOM
    const pickCards = Array.from(document.querySelectorAll('.pick-card, .tarjeta-pick, [class*="pick"]')).map(el => {
      return {
        className: el.className,
        text: el.innerText.replace(/\n+/g, ' | ')
      };
    });

    // Check what tabs/categories exist in picks section
    const pickTabs = Array.from(document.querySelectorAll('#picks button, .picks-container button, [data-categoria], [data-tab]')).map(el => ({
      text: el.innerText.trim(),
      dataset: { ...el.dataset }
    }));

    return {
      futbolPicksData: typeof futbolPicksData === 'object' ? Object.keys(futbolPicksData || {}) : typeof futbolPicksData,
      pickCardsCount: pickCards.length,
      sampleCards: pickCards.slice(0, 10),
      pickTabs
    };
  });

  console.log('Inspection result:', JSON.stringify(matchData, null, 2));

  // Let's also inspect all picks in detail from DOM
  const detailedPicks = await page.evaluate(() => {
    // Look for all elements that contain percentage
    const allDivs = Array.from(document.querySelectorAll('div, section, article'));
    const cards = allDivs.filter(d => {
      const txt = d.innerText || '';
      return (
        d.classList.contains('tarjeta-pick') ||
        (txt.includes('%') && (txt.includes('Guardar pick') || txt.includes('¿Por qué')))
      ) && d.children.length > 0 && d.children.length < 15;
    });

    return cards.map(c => c.innerText.replace(/\n+/g, ' | ')).slice(0, 20);
  });

  console.log('Detailed picks count:', detailedPicks.length);
  console.log('Sample picks:', detailedPicks.slice(0, 10));

  await browser.close();
})();
