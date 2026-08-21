const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Check frames
  const frames = page.frames();
  console.log(`Page has ${frames.length} frames.`);
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    console.log(`Frame ${i}: ${f.url()}`);
    try {
      const betslipBtns = await f.$$('.asb-floating-button, button, [class*="betslip"]');
      console.log(`  Found ${betslipBtns.length} potential buttons in frame ${i}`);
    } catch(e) {}
  }

  // Also check if WSDK has open/show methods
  const wsdkMethods = await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (!wsdk) return 'no wsdk';
    return Object.keys(wsdk);
  });
  console.log('WSDK methods:', wsdkMethods);

  await browser.close();
})();
