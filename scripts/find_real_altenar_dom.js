const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const capturesDir = path.join(__dirname, '..', 'captures', 'parlays_2026_08_21');
  if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  // Launch in headed or high-res to see real DOM
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navegando a PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Close cookies/promos
  try {
    const promo = await page.$('.cookie-banner button, [class*="close"]');
    if (promo) await promo.click();
  } catch(e) {}

  // Let's see how Altenar renders inside PlayDoIt:
  // On playdoit.mx, scroll down to the sportsbook area where the odds buttons are
  console.log('Scrolling down to sportsbook...');
  await page.evaluate(() => {
    window.scrollTo(0, 600);
  });
  await page.waitForTimeout(3000);

  // Toggle real selections via WSDK
  console.log('Inyectando selecciones en el WSDK real...');
  await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.toggleSelections) {
      wsdk.toggleSelections([4328988920, 4351210204]); // Bohemians + Jaguares
    }
  });

  await page.waitForTimeout(3000);

  // Now find the REAL Altenar betslip element in the DOM
  const realAltenarEls = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    return all.filter(el => {
      const c = (el.className || '').toString();
      const id = (el.id || '').toString();
      return c.includes('asb-') || id.includes('asb-') || c.includes('altenar') || id.includes('altenar');
    }).map(el => ({ tag: el.tagName, class: el.className, id: el.id, text: el.innerText ? el.innerText.substring(0, 60) : '' }));
  });

  console.log('Real Altenar elements found in DOM:', realAltenarEls.length);
  console.log(realAltenarEls.slice(0, 15));

  // Take screenshot of the real page
  await page.screenshot({ path: path.join(capturesDir, 'real_altenar_debug.png') });

  await browser.close();
})();
