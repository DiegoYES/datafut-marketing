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

  const fnInfo = await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    return {
      initStr: wsdk.init ? wsdk.init.toString() : null,
      addSportsBookStr: wsdk.addSportsBook ? wsdk.addSportsBook.toString() : null,
      addWidgetStr: wsdk.addWidget ? wsdk.addWidget.toString() : null,
      setStr: wsdk.set ? wsdk.set.toString() : null
    };
  });

  console.log('Function Signatures:\n', JSON.stringify(fnInfo, null, 2));

  await browser.close();
})();
