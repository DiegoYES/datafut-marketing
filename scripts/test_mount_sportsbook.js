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

  // Inspect Altenar initialization in the page
  const res = await page.evaluate(async () => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (!wsdk) return 'No WSDK';

    // Mount SportsBook widget into a visible div
    let sbDiv = document.createElement('div');
    sbDiv.id = 'full-altenar-sportsbook';
    sbDiv.style.width = '100%';
    sbDiv.style.height = '1000px';
    sbDiv.style.position = 'relative';
    sbDiv.style.zIndex = '99999';
    document.body.prepend(sbDiv);

    if (wsdk.addSportsBook) {
      wsdk.addSportsBook({
        container: sbDiv,
        props: {
          sportId: 66,
          page: 'upcoming'
        }
      });
      return 'addSportsBook called';
    } else if (wsdk.addWidget) {
      wsdk.addWidget({
        widget: 'SportsBook',
        container: sbDiv
      });
      return 'addWidget SportsBook called';
    }
    return 'none';
  });

  console.log('Result:', res);
  await page.waitForTimeout(5000);

  const capturesDir = path.join(__dirname, '..', 'captures', 'parlays_2026_08_21');
  await page.screenshot({ path: path.join(capturesDir, 'sportsbook_mounted_test.png') });
  console.log('Screenshot saved.');

  await browser.close();
})();
