const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1600, height: 1000 }
  });
  const page = await context.newPage();
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  const res = await page.evaluate(async () => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (!wsdk) return 'No WSDK';

    // Layout: main sports container on left, betslip on right
    document.body.innerHTML = `
      <div id="app-layout" style="display: flex; width: 100vw; height: 100vh; background: #0f172a; font-family: sans-serif;">
        <div id="sb-container" style="flex: 1; height: 100%; overflow: auto;"></div>
        <div id="bs-container" style="width: 420px; height: 100%; border-left: 2px solid #334155; overflow: auto; background: #1e293b;"></div>
      </div>
    `;

    // Initialize widgets
    if (wsdk.addSportsBook) {
      wsdk.addSportsBook({ container: document.querySelector('#sb-container') });
    }
    if (wsdk.addBetSlip) {
      wsdk.addBetSlip({ container: document.querySelector('#bs-container') });
    } else if (wsdk.addWidget) {
      wsdk.addWidget({ widget: 'BetSlip', container: document.querySelector('#bs-container') });
    }

    // Toggle selections for Option 1: Bohemians vs Derry (Más de 1.5) + Jaguares vs Chicó (Más de 1.5)
    if (wsdk.toggleSelections) {
      wsdk.toggleSelections([4328988920, 4351210204]);
    }

    return 'mounted';
  });

  console.log('Mount result:', res);
  await page.waitForTimeout(6000);

  const capturesDir = path.join(__dirname, '..', 'captures', 'parlays_2026_08_21');
  const shotPath = path.join(capturesDir, 'full_custom_layout_test.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved custom layout screenshot to:', shotPath);

  await browser.close();
})();
