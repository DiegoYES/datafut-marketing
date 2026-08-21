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

  const testBetslipMount = await page.evaluate(async () => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (!wsdk) return { error: 'No WSDK' };

    const log = [];

    // 1. Init
    try {
      wsdk.init({
        integration: 'playdoit2',
        culture: 'es-ES',
        timezoneOffset: 360
      });
      log.push({ init: 'OK' });
    } catch(e) {
      log.push({ initErr: e.message });
    }

    // 2. Create betslip container
    const container = document.createElement('div');
    container.id = 'altenar-betslip-container';
    container.style.position = 'fixed';
    container.style.top = '100px';
    container.style.right = '20px';
    container.style.width = '400px';
    container.style.height = '600px';
    container.style.zIndex = '999999';
    container.style.background = '#fff';
    container.style.border = '2px solid red';
    document.body.appendChild(container);

    // 3. Add betslip widget
    try {
      const widget = wsdk.addWidget({
        widget: 'Betslip',
        container,
        culture: 'es-ES',
        timezoneOffset: 360,
        integration: 'playdoit2'
      });
      log.push({ addWidget: 'OK', widget: !!widget });
    } catch(e) {
      log.push({ addWidgetErr: e.message });
    }

    await new Promise(r => setTimeout(r, 4000));

    // 4. Check DOM inside container
    const betslipText = container.innerText;
    const betslipHTML = container.innerHTML.slice(0, 500);

    // 5. Test toggleSelection with an odd ID
    const testOddId = 4364386469; // Leones under 3.5
    try {
      wsdk.toggleSelections([testOddId]);
      log.push({ toggleSelections: 'OK' });
    } catch(e) {
      log.push({ toggleSelectionsErr: e.message });
    }

    await new Promise(r => setTimeout(r, 2000));

    const betslipTextAfterToggle = container.innerText;

    return {
      log,
      betslipTextBefore: betslipText,
      betslipTextAfterToggle
    };
  });

  console.log('Betslip Mount & Toggle Result:\n', JSON.stringify(testBetslipMount, null, 2));

  await browser.close();
})();
