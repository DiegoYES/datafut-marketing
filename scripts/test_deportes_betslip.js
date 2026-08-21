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
  await page.goto('https://www.playdoit.mx/deportes', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Toggle selections for Option 1
  const oddIds = [4328988920, 4351210204];
  await page.evaluate((ids) => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.toggleSelections) {
      wsdk.toggleSelections([]);
      wsdk.toggleSelections(ids);
    }
  }, oddIds);

  await page.waitForTimeout(3000);

  // Inspect all elements that appeared
  const betslipInfo = await page.evaluate(() => {
    const allEls = Array.from(document.querySelectorAll('*'));
    const matched = allEls.filter(el => {
      const c = el.className && typeof el.className === 'string' ? el.className.toLowerCase() : '';
      const id = el.id ? el.id.toLowerCase() : '';
      return c.includes('betslip') || id.includes('betslip') || c.includes('coupon') || id.includes('coupon') || c.includes('selection');
    });

    return matched.map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      rect: el.getBoundingClientRect(),
      textSnippet: el.innerText.substring(0, 100).replace(/\n/g, ' ')
    }));
  });

  console.log(`Found ${betslipInfo.length} betslip elements:`, JSON.stringify(betslipInfo, null, 2));

  // Screenshot the entire right sidebar or the page
  const capturesDir = path.join(__dirname, '..', 'captures', 'parlays_2026_08_21');
  if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

  const shotPath = path.join(capturesDir, 'test_deportes_betslip.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved screenshot to:', shotPath);

  await browser.close();
})();
