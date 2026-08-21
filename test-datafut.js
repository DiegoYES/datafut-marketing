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

  console.log('Título:', await page.title());
  console.log('URL:', page.url());

  await page.waitForTimeout(10000);

  await browser.close();
})();