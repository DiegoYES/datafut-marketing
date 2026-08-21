const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const capturesDir = path.join(__dirname, '..', 'captures', 'parlays_2026_08_21');
  if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('[PLAYDOIT] Navegando...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Test clicking floating betslip button
  // Select odd IDs for Option 1: Bohemians (+1.5 goles) + Jaguares (+1.5 goles)
  const oddIds = [4328988920, 4351210204];

  await page.evaluate((ids) => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.toggleSelections) {
      wsdk.toggleSelections([]);
      wsdk.toggleSelections(ids);
    }
  }, oddIds);

  await page.waitForTimeout(2000);

  // Click the red circle button in bottom right
  const clicked = await page.evaluate(() => {
    // Find element at bottom right around x=1850, y=950
    const el = document.elementFromPoint(1850, 950);
    if (el) {
      el.click();
      return { success: true, tag: el.tagName, class: el.className };
    }
    return { success: false };
  });

  console.log('Clicked result:', clicked);
  await page.waitForTimeout(3000);

  const testPath = path.join(capturesDir, 'test_betslip_opened.png');
  await page.screenshot({ path: testPath });
  console.log('Screenshot saved to:', testPath);

  await browser.close();
})();
