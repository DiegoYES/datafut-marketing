const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });

  const page = await browser.newPage({
    viewport: {
      width: 390,
      height: 844
    }
  });

  await page.goto('https://data-fut.com', {
    waitUntil: 'networkidle'
  });

  await page.waitForTimeout(3000);

  await page.screenshot({
    path: 'datafut-home.png',
    fullPage: true
  });

  console.log('Captura guardada en datafut-home.png');

  await page.waitForTimeout(3000);

  await browser.close();
})();