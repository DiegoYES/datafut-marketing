const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const capturesDir = path.join(__dirname, '..', 'captures', 'parlays_2026_08_21');
  if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navegando a PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(4000);

  // Click on "Fútbol" in the sports bar
  const futbolBtn = await page.$('text=Fútbol, [class*="sports"] >> text=Fútbol');
  if (futbolBtn) {
    console.log('Clicking Fútbol...');
    await futbolBtn.click();
    await page.waitForTimeout(3000);
  }

  // Check what sports navigation happened
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  const shotPath = path.join(capturesDir, 'sports_view_after_click.png');
  await page.screenshot({ path: shotPath });
  console.log('Screenshot saved to:', shotPath);

  await browser.close();
})();
