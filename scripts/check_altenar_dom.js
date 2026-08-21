const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

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

  // Check what happens when we click an odd button on the live page
  const oddBtn = await page.$('.asb-btn-odd, [class*="odd-btn"], button[class*="price"], .asb-pos-selection');
  console.log('Found odd button in DOM:', Boolean(oddBtn));
  if (oddBtn) {
    await oddBtn.click();
    await page.waitForTimeout(3000);
  }

  // Check where betslip is
  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(el => (el.className && typeof el.className === 'string' && el.className.toLowerCase().includes('asb-')) || (el.id && el.id.toLowerCase().includes('asb-')))
      .map(el => ({ id: el.id, className: el.className, tag: el.tagName }));
  });

  console.log('Altenar elements:', elements.slice(0, 30));

  // Add the betslip widget using WSDK.addWidget if available
  const addWidgetResult = await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.addWidget) {
      // Check signature or try adding BetSlip widget
      return 'addWidget exists';
    }
    return 'no addWidget';
  });
  console.log('WSDK addWidget status:', addWidgetResult);

  await browser.close();
})();
