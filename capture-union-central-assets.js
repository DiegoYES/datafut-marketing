const { chromium } = require('./node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, 'raw-union-central');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created directory:', dir);
  }

  console.log('--- CAPTURING UNIÓN SANTA FE VS CENTRAL CÓRDOBA ASSETS WITH MARKETING SESSION ---');
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

  // Match: Unión Santa Fe vs Central Córdoba (Liga Argentina)
  const matchUrl = 'https://data-fut.com/partido.html?local=441&visitante=1065&liga=128&partido=1493061&fecha=2026-08-10#picks';
  console.log('Navigating to:', matchUrl);
  await page.goto(matchUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Clean DOM of sensitive user info as required by SKILL.md rules
  await page.evaluate(() => {
    // Hide user profile, logout, admin or session bars if any
    const userSelectors = ['[class*="user"]', '[class*="profile"]', '[class*="avatar"]', '[href*="logout"]', '[href*="admin"]', 'header button', 'nav button'];
    userSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (el.innerText && (el.innerText.includes('marketing') || el.innerText.includes('Perfil') || el.innerText.includes('Salir'))) {
          el.style.display = 'none';
        }
      });
    });
  });

  // 1. Header Capture
  await page.evaluate(() => window.scrollTo(0, 0));
  const headerPath = path.join(dir, '01-match-header.png');
  await page.screenshot({ path: headerPath });
  console.log('Saved:', headerPath);

  // 2. Scroll to Stats / Evidence Table
  await page.evaluate(() => {
    const statsTable = document.querySelector('[class*="table"]') || document.querySelector('#picks') || document.body;
    statsTable.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(1500);

  const statsPath = path.join(dir, '02-stats-table.png');
  await page.screenshot({ path: statsPath });
  console.log('Saved:', statsPath);

  // 3. Scroll to Predictions Card
  await page.evaluate(() => {
    const picksSection = document.querySelector('#picks') || document.body;
    picksSection.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(1000);

  const predPath = path.join(dir, '03-prediction.png');
  await page.screenshot({ path: predPath });
  console.log('Saved:', predPath);

  console.log('--- CAPTURE COMPLETED SUCCESSFULLY ---');
  await browser.close();
})();
