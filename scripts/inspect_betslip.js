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
  console.log('Navigating to PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Inspect frames and DOM for betslip elements and Altenar widget
  const info = await page.evaluate(async () => {
    // Look for sports iframe or altenar elements
    const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
      src: f.src,
      id: f.id,
      name: f.name
    }));

    // Find any betslip buttons or elements
    const buttons = Array.from(document.querySelectorAll('button, div, span, a'))
      .filter(el => (el.innerText || '').toLowerCase().includes('cupón') || (el.innerText || '').toLowerCase().includes('betslip') || (el.className && typeof el.className === 'string' && el.className.includes('betslip')))
      .map(el => ({
        tag: el.tagName,
        className: el.className,
        text: el.innerText.trim().slice(0, 50)
      }));

    return {
      title: document.title,
      url: window.location.href,
      iframes,
      buttons: buttons.slice(0, 15)
    };
  });

  console.log('Page info:', JSON.stringify(info, null, 2));

  // Check child frames
  console.log('\nChecking page.frames()...');
  for (const frame of page.frames()) {
    console.log(`Frame URL: ${frame.url()} | Name: ${frame.name()}`);
    try {
      const fInfo = await frame.evaluate(() => {
        const oddButtons = Array.from(document.querySelectorAll('.asb-btn-odd, [class*="odd"], [class*="price"], [class*="selection"]')).length;
        const betslip = Array.from(document.querySelectorAll('[class*="betslip"], [class*="coupon"], [class*="asb-betslip"]')).map(e => e.className);
        return { oddButtons, betslip };
      });
      console.log('  Frame details:', fInfo);
    } catch(e) {}
  }

  await browser.close();
})();
