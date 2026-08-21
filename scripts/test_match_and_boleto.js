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
  await page.waitForTimeout(5000);

  // 1. Search "Aldosivi"
  const searchInput = await page.$('input[placeholder*="Ingrese el nombre"]');
  if (searchInput) {
    await searchInput.fill('Aldosivi');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Click first search result (at x=80, y=240)
    console.log('Haciendo clic en el resultado de búsqueda de Aldosivi...');
    await page.mouse.click(80, 240);
    await page.waitForTimeout(4000);
  }

  // 2. Set the selections in betslip via WSDK
  await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.toggleSelections) {
      wsdk.toggleSelections([]);
      // Select Aldosivi vs Union (Menos de 6.5 tarjetas) + Bohemians vs Derry (Más de 1.5 goles)
      wsdk.toggleSelections([4374915968, 4328988920]);
    }
  });

  await page.waitForTimeout(3000);

  // 3. Look for the BOLETO bar at the bottom of the match view and click it
  await page.evaluate(() => {
    // Look for any element whose text includes "BOLETO"
    const all = Array.from(document.querySelectorAll('*'));
    const boletoBar = all.find(el => {
      const t = (el.innerText || '').trim();
      return (t.startsWith('BOLETO') || t.startsWith('Boleto')) && el.offsetHeight > 0 && el.offsetHeight < 70;
    });
    if (boletoBar) {
      boletoBar.click();
    } else {
      // Click at the bottom center of the screen
      const bottomCenterEl = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 30);
      if (bottomCenterEl) bottomCenterEl.click();
    }
  });

  await page.waitForTimeout(3000);

  // Switch to Parlay tab
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const pTab = all.find(el => (el.innerText || '').trim() === 'Parlay' && el.offsetHeight > 0);
    if (pTab) pTab.click();
  });

  await page.waitForTimeout(2000);

  const shotPath = path.join(capturesDir, 'real_match_view_with_boleto.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved to:', shotPath);

  await browser.close();
})();
