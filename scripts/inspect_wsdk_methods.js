const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  console.log('Navigating to PlayDoIt home...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  const wsdkMethods = await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (!wsdk) return { error: 'No WSDK' };

    const props = {};
    for (const key of Object.keys(wsdk)) {
      props[key] = typeof wsdk[key];
    }

    // Check betslip or addSelection or coupon
    return {
      keys: Object.keys(wsdk),
      props,
      altenarWSDKKeys: window.altenarWSDK ? Object.keys(window.altenarWSDK) : []
    };
  });

  console.log('WSDK Methods & Properties:\n', JSON.stringify(wsdkMethods, null, 2));
  await browser.close();
})();
