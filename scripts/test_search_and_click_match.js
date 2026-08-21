const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const capturesDir = path.join(__dirname, '..', 'captures', 'parlays_2026_08_21');
  if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('Navegando a PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(4000);

  // Close cookie banner
  try {
    const cookieClose = await page.$('.cookie-banner button, [class*="cookie"] button, .asb-cookie-policy-close');
    if (cookieClose) await cookieClose.click();
  } catch(e) {}

  // Find the search input on the left
  const searchInput = await page.$('input[placeholder*="Ingrese el nombre"], input[placeholder*="equipo"], .asb-search-input, input[type="search"]');
  console.log('Search input found:', Boolean(searchInput));

  if (searchInput) {
    await searchInput.fill('Aldosivi');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Look for search results
    const resultItem = await page.$('text=Aldosivi, text=Union de Santa Fe, [class*="search-result"]');
    if (resultItem) {
      console.log('Clicking search result...');
      await resultItem.click();
      await page.waitForTimeout(4000);
    }
  }

  // Toggle selections for Option 1: Bohemians + Jaguares
  await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.toggleSelections) {
      wsdk.toggleSelections([4328988920, 4351210204]);
    }
  });

  await page.waitForTimeout(3000);

  // Take screenshot
  const shotPath = path.join(capturesDir, 'search_match_result.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved screenshot to:', shotPath);

  await browser.close();
})();
