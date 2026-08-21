const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });

  // Carga la sesión que guardamos anteriormente
  const context = await browser.newContext({
    storageState: 'datafut-session.json',
    viewport: {
      width: 390,
      height: 844
    }
  });

  const page = await context.newPage();

  await page.goto('https://data-fut.com', {
    waitUntil: 'networkidle'
  });

  console.log('URL:', page.url());
  console.log('Título:', await page.title());

  // Lo dejamos abierto para que puedas comprobar
  // visualmente si apareces con la sesión iniciada.
  await page.waitForTimeout(15000);

  await browser.close();
})();