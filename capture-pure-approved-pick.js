const { chromium } = require('./node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, 'raw-union-central');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log('--- CAPTURING STRICT APPROVED PICK ONLY (UNDER 3.5 - 73.1%) ---');
  const browser = await chromium.launch({ headless: true });
  const sessionPath = path.join(__dirname, 'datafut-marketing-session.json');

  const context = await browser.newContext({
    storageState: fs.existsSync(sessionPath) ? sessionPath : undefined,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();
  const matchUrl = 'https://data-fut.com/partido.html?local=441&visitante=1065&liga=128&partido=1493061&fecha=2026-08-10#picks';
  await page.goto(matchUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Filter DOM so ONLY Menos de 3.5 goles 73.1% is visible, hide all other picks, cards, user headers, etc.
  await page.evaluate(() => {
    // 1. Remove all header/nav/user elements
    const userSelectors = ['header', 'nav', 'aside', '[class*="user"]', '[class*="profile"]', '[class*="avatar"]', '[class*="admin"]', '[href*="logout"]'];
    userSelectors.forEach(s => document.querySelectorAll(s).forEach(e => e.remove()));

    // Remove buttons containing Salir or marketing
    document.querySelectorAll('button, a, div, span').forEach(e => {
      const t = (e.innerText || '').trim();
      if (t.includes('marketing') || t.includes('Premium') || t.includes('Salir') || t.includes('2912222')) {
        e.remove();
      }
    });

    // 2. Hide any pick or card that contains other percentages like 53.8% or Over 1.5
    const allPickCards = Array.from(document.querySelectorAll('[class*="card"], [class*="pick"], div'));
    allPickCards.forEach(el => {
      const txt = el.innerText || '';
      if ((txt.includes('53.8%') || txt.includes('Over 1.5') || txt.includes('Más de 1.5')) && !txt.includes('73.1%')) {
        el.style.display = 'none';
      }
    });
  });

  await page.waitForTimeout(500);

  // Take screenshot of the pure approved pick element
  const pickCard = await page.locator('text=73.1%').locator('xpath=../..');
  if (await pickCard.count() > 0) {
    await pickCard.first().screenshot({ path: path.join(dir, 'v4-approved-pick-card.png') });
    console.log('Saved v4-approved-pick-card.png');
  } else {
    console.log('Pick card locator fallback...');
    await page.screenshot({ path: path.join(dir, 'v4-approved-pick-card.png') });
  }

  await browser.close();
})();
