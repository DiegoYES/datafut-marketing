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

  const initCheck = await page.evaluate(async () => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (!wsdk) return { error: 'No WSDK' };

    // Let's check how WSDK.init is called or what options it needs
    // Let's create container
    const container = document.createElement('div');
    container.id = 'sportsbook-container';
    document.body.appendChild(container);

    const log = [];

    // Check if WSDK.init was already called or needs to be called
    try {
      if (wsdk.init) {
        // Look at altenarWSDK properties
        const res = wsdk.init({
          integration: 'playdoit2',
          culture: 'es-ES',
          timezoneOffset: 360
        });
        log.push({ initRes: res });
      }
    } catch(e) {
      log.push({ initError: e.message });
    }

    return {
      log,
      wsdkKeys: Object.keys(wsdk)
    };
  });

  console.log('Init Check Result:\n', JSON.stringify(initCheck, null, 2));

  await browser.close();
})();
