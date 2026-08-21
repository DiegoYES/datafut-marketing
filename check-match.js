const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: 'datafut-session.json',
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();
  await page.goto('https://data-fut.com/partido.html?local=2072&visitante=403&liga=120&partido=1551307&fecha=2026-08-09#picks', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const matchData = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      title: document.title,
      fullText: text
    };
  });

  console.log('Match Page Content Summary:');
  console.log(matchData.fullText.slice(0, 3000));

  await browser.close();
})();
