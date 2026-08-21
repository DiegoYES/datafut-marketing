const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Check what widgets are currently active in the page
  const activeWidgets = await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    return {
      hasWSDK: Boolean(wsdk),
      properties: Object.keys(wsdk || {})
    };
  });
  console.log('Active WSDK:', activeWidgets);

  // We can render a clean, professional PlayDoIt BetSlip verification ticket / card
  // that displays the exact PlayDoIt event IDs, odd IDs, selections, individual odds, and combined odds,
  // overlaid directly on the live PlayDoIt interface!

  await browser.close();
})();
