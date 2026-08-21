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

  const mountResult = await page.evaluate(async () => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (!wsdk) return { error: 'No WSDK' };

    // Create a container for the SportsBook / Betslip
    let container = document.getElementById('altenar-test-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'altenar-test-container';
      container.style.width = '1000px';
      container.style.height = '800px';
      container.style.position = 'fixed';
      container.style.bottom = '0';
      container.style.right = '0';
      container.style.zIndex = '99999';
      container.style.background = '#fff';
      document.body.appendChild(container);
    }

    const log = [];

    // Try adding sportsbook widget
    try {
      if (wsdk.addSportsBook) {
        const sb = wsdk.addSportsBook({
          container,
          culture: 'es-ES',
          timezoneOffset: 360,
          integration: 'playdoit2'
        });
        log.push({ addSportsBookSuccess: true, sbKeys: sb ? Object.keys(sb) : [] });
      }
    } catch(e) {
      log.push({ addSportsBookError: e.message });
    }

    // Try adding betslip widget directly if addWidget exists
    try {
      if (wsdk.addWidget) {
        const w = wsdk.addWidget({
          widget: 'Betslip',
          container,
          culture: 'es-ES',
          timezoneOffset: 360,
          integration: 'playdoit2'
        });
        log.push({ addWidgetSuccess: true, wKeys: w ? Object.keys(w) : [] });
      }
    } catch(e) {
      log.push({ addWidgetError: e.message });
    }

    await new Promise(r => setTimeout(r, 4000));

    // Check what elements were added inside container
    const childElements = Array.from(container.querySelectorAll('*')).map(el => ({
      tag: el.tagName,
      className: el.className,
      text: (el.innerText || '').slice(0, 100).replace(/\n+/g, ' ')
    }));

    return {
      log,
      childCount: childElements.length,
      sampleChildren: childElements.slice(0, 15)
    };
  });

  console.log('Mount Result:\n', JSON.stringify(mountResult, null, 2));

  await browser.close();
})();
