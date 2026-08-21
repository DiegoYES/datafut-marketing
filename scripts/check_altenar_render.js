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

  console.log('Navigating to https://www.playdoit.mx/sports ...');
  await page.goto('https://www.playdoit.mx/sports', { waitUntil: 'networkidle', timeout: 45000 });
  
  // Wait up to 15 seconds to see if Altenar renders
  console.log('Waiting for Altenar sportsbook elements...');
  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    const check = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const text = document.body.innerText;
      const inputs = document.querySelectorAll('input');
      const hasAltenar = !!document.querySelector('.asb-pos-abs, .asb-main, [class*="asb-"], [class*="sportsbook"], [id*="sportsbook"], [id*="altenar"]');
      return {
        elementsCount: allElements.length,
        textLength: text.length,
        inputsCount: inputs.length,
        hasAltenar,
        sampleText: text.slice(0, 300).replace(/\n+/g, ' ')
      };
    });
    console.log(`[${s * 1.5}s] elements: ${check.elementsCount}, textLength: ${check.textLength}, hasAltenar: ${check.hasAltenar}`);
    if (check.hasAltenar || check.textLength > 1000) {
      console.log('Altenar/Sportsbook rendered!');
      break;
    }
  }

  // Check what HTML elements exist inside body
  const bodyStructure = await page.evaluate(() => {
    return {
      bodyHTML: document.body.innerHTML.slice(0, 2000),
      rootExists: !!document.getElementById('root'),
      appExists: !!document.getElementById('app'),
      appHTML: document.getElementById('app')?.outerHTML?.slice(0, 500) || 'none',
      rootHTML: document.getElementById('root')?.outerHTML?.slice(0, 500) || 'none'
    };
  });

  console.log('Body Structure:', bodyStructure);

  await page.screenshot({ path: path.join(__dirname, 'playdoit_status.png'), fullPage: true });

  await browser.close();
})();
