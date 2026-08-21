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

  // Test odd IDs from verified candidates:
  // e.g. DF-001 (Leones FC under 3.5: 4364386469), DF-002 (Athletic under 3.5: 4356869545)
  const testOdd1 = 4364386469;
  const testOdd2 = 4356869545;

  const testResult = await page.evaluate(async ({ id1, id2 }) => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (!wsdk) return { error: 'No WSDK' };

    const eventsLog = [];

    // Subscribe to all possible channels/events
    const channels = ['betslip', 'selections', 'coupon', 'bet', 'odds', 'system', 'multiple'];
    for (const ch of channels) {
      try {
        wsdk.subscribe(ch, (data) => {
          eventsLog.push({ channel: ch, data });
        });
      } catch(e) {}
    }

    // Toggle selections
    try {
      wsdk.toggleSelections([{ id: id1 }, { id: id2 }]);
    } catch(e) {
      eventsLog.push({ toggleError: e.message });
    }

    // Also check if toggleSelections accepts array of IDs directly
    try {
      wsdk.toggleSelections([id1, id2]);
    } catch(e) {
      eventsLog.push({ toggleIdError: e.message });
    }

    await new Promise(r => setTimeout(r, 3000));

    return {
      eventsLog
    };
  }, { id1: testOdd1, id2: testOdd2 });

  console.log('WSDK Test Result:\n', JSON.stringify(testResult, null, 2));

  await browser.close();
})();
