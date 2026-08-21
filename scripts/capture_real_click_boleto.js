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

  // Close promo banner in bottom left if present
  try {
    const promoClose = await page.$('button[class*="close"], .asb-modal-close, [class*="promo"] button, div[class*="close"]');
    if (promoClose) await promoClose.click();
  } catch(e) {}

  // 1. Search for Bohemians
  console.log('Buscando Bohemians Dublin...');
  const searchInput = await page.$('input[placeholder*="Ingrese el nombre"]');
  if (searchInput) {
    await searchInput.fill('Bohemians Dublin');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);

    const bohemiansResult = await page.$('text=Bohemians Dublín, text=Derry City');
    if (bohemiansResult) {
      await bohemiansResult.click();
      await page.waitForTimeout(3000);
    }
  }

  // Click on "Más de 1.5" in the Total goals market
  console.log('Seleccionando Más de 1.5 en Bohemians vs Derry City...');
  const over15Btn = await page.$('text=Más de 1.5, text=Más de 1,5');
  if (over15Btn) {
    await over15Btn.click();
    await page.waitForTimeout(2000);
  }

  // 2. Search for Jaguares
  console.log('Buscando Jaguares...');
  if (searchInput) {
    await searchInput.fill('');
    await searchInput.fill('Jaguares');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);

    const jaguaresResult = await page.$('text=Jaguares, text=Chico');
    if (jaguaresResult) {
      await jaguaresResult.click();
      await page.waitForTimeout(3000);
    }
  }

  // Click on "Más de 1.5" in Jaguares
  console.log('Seleccionando Más de 1.5 en Jaguares vs Chicó...');
  const jagOver15 = await page.$('text=Más de 1.5, text=Más de 1,5');
  if (jagOver15) {
    await jagOver15.click();
    await page.waitForTimeout(2000);
  }

  // Click the BOLETO bar to open
  console.log('Abriendo BOLETO...');
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const b = all.find(el => (el.innerText || '').trim().startsWith('BOLETO'));
    if (b) b.click();
  });

  await page.waitForTimeout(2000);

  // Switch to Parlay tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button, div, span, a'));
    const p = tabs.find(t => t.innerText && t.innerText.trim() === 'Parlay');
    if (p) p.click();
  });

  await page.waitForTimeout(2000);

  const shotPath = path.join(capturesDir, 'real_interactive_boleto_opcion_1.png');
  await page.screenshot({ path: shotPath });
  console.log(`[CAPTURA INTERACTIVA LISTA]: ${shotPath}`);

  await browser.close();
})();
