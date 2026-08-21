const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome'
  }).catch(async () => {
    return await chromium.launch({ headless: false });
  });

  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  console.log('Navigating to https://www.playdoit.mx/ ...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(6000);

  // Close cookie popup if present
  try {
    const closeBtn = await page.$('button:has-text("✕"), .cookie-close');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch(e) {}

  // Check Altenar / Sportsbook DOM elements
  const sportsbookDetails = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    
    // Check all elements with class names containing asb or sb
    const sbElements = Array.from(document.querySelectorAll('[class*="asb-"], [class*="sportsbook"], [class*="event"], [class*="match"], [class*="bet"]'))
      .map(el => ({
        tag: el.tagName,
        className: el.className,
        text: el.innerText.slice(0, 100).replace(/\n+/g, ' ')
      }));

    // Find all links / sport categories
    const sportsNav = Array.from(document.querySelectorAll('a, button, span, div'))
      .filter(el => {
        const t = (el.innerText || '').toLowerCase();
        return (t.includes('fútbol') || t.includes('hoy') || t.includes('en vivo') || t.includes('destacados')) && el.children.length === 0;
      })
      .map(el => ({ tag: el.tagName, text: el.innerText.trim(), className: el.className }));

    return {
      bodyLength: bodyText.length,
      bodyPreview: bodyText.slice(0, 1500).replace(/\n+/g, ' | '),
      sbElementsCount: sbElements.length,
      sbSample: sbElements.slice(0, 15),
      sportsNav: sportsNav.slice(0, 20)
    };
  });

  console.log('Sportsbook Details Body Length:', sportsbookDetails.bodyLength);
  console.log('Sports Nav Items:', sportsbookDetails.sportsNav);
  console.log('SB Elements Count:', sportsbookDetails.sbElementsCount);
  console.log('SB Sample:', sportsbookDetails.sbSample.slice(0, 5));
  console.log('\nBody text snippet:\n', sportsbookDetails.bodyPreview);

  await page.screenshot({ path: path.join(__dirname, 'playdoit_root_sportsbook.png'), fullPage: false });

  await browser.close();
})();
