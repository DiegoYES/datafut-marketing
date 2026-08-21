const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const capturesDir = path.join(__dirname, '..', 'captures', 'parlays_2026_08_21');
  if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Mount a dedicated BetSlip widget in a container on the page
  await page.evaluate(() => {
    // Create container
    let container = document.getElementById('custom-betslip-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'custom-betslip-container';
      container.style.position = 'fixed';
      container.style.top = '100px';
      container.style.right = '50px';
      container.style.width = '420px';
      container.style.height = '700px';
      container.style.zIndex = '999999';
      container.style.backgroundColor = '#1e293b';
      container.style.borderRadius = '16px';
      container.style.boxShadow = '0 20px 50px rgba(0,0,0,0.8)';
      container.style.overflow = 'hidden';
      document.body.appendChild(container);
    }

    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.addWidget) {
      try {
        wsdk.addWidget({
          widget: 'BetSlip',
          container: '#custom-betslip-container'
        });
      } catch(e) {
        console.error('Error adding BetSlip widget:', e);
      }
    }
  });

  await page.waitForTimeout(3000);

  // Option 1 Odd IDs
  const oddIds = [4328988920, 4351210204];

  await page.evaluate((ids) => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.toggleSelections) {
      wsdk.toggleSelections([]);
      wsdk.toggleSelections(ids);
    }
  }, oddIds);

  await page.waitForTimeout(4000);

  const containerEl = await page.$('#custom-betslip-container');
  if (containerEl) {
    const shotPath = path.join(capturesDir, 'test_mounted_betslip.png');
    await containerEl.screenshot({ path: shotPath });
    console.log('Saved mounted betslip screenshot to:', shotPath);
  }

  await browser.close();
})();
