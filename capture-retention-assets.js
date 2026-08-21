const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, 'raw-retention');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created directory:', dir);
  }

  console.log('--- CAPTURING RETENTION MARKETING ASSETS ---');
  const browser = await chromium.launch({ headless: true });
  
  const context = await browser.newContext({
    storageState: path.join(__dirname, 'datafut-session.json'),
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();

  // Match: Banfield vs Belgrano (Liga Argentina)
  const matchUrl = 'https://data-fut.com/partido.html?local=449&visitante=440&liga=128&partido=1493049&fecha=2026-08-10#picks';
  console.log('Navigating to Banfield vs Belgrano:', matchUrl);
  await page.goto(matchUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Header Capture
  await page.evaluate(() => window.scrollTo(0, 0));
  const headerPath = path.join(dir, '01-match-header.png');
  await page.screenshot({ path: headerPath });
  console.log('Saved:', headerPath);

  // 2. Prediction Section
  await page.evaluate(() => {
    const picksSection = document.querySelector('#picks') || document.body;
    picksSection.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(1500);

  const predPath = path.join(dir, '02-prediction.png');
  await page.screenshot({ path: predPath });
  console.log('Saved:', predPath);

  // 3. Open evidence breakdown if available
  await page.evaluate(() => {
    const whyBtn = Array.from(document.querySelectorAll('button, a, div')).find(el => el.innerText && el.innerText.includes('¿Por qué'));
    if (whyBtn) whyBtn.click();
  });
  await page.waitForTimeout(1000);

  const evidencePath = path.join(dir, '03-evidence.png');
  await page.screenshot({ path: evidencePath });
  console.log('Saved:', evidencePath);

  console.log('--- CAPTURE COMPLETED ---');
  await browser.close();
})();
