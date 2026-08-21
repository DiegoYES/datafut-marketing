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
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navegando a PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Close cookie banner
  try {
    const cookieClose = await page.$('.cookie-banner button, [class*="cookie"] button, .asb-cookie-policy-close');
    if (cookieClose) await cookieClose.click();
  } catch(e) {}

  // Let's see what happens when we set window.location.hash or click on an event
  // Let's check how Altenar router works:
  const routerInfo = await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    return {
      hash: window.location.hash,
      href: window.location.href
    };
  });
  console.log('Router info:', routerInfo);

  // Toggle selections for Option 1
  const oddIds = [4328988920, 4351210204];
  await page.evaluate((ids) => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.toggleSelections) {
      wsdk.toggleSelections([]);
      wsdk.toggleSelections(ids);
    }
  }, oddIds);

  await page.waitForTimeout(3000);

  // Find the exact DOM element containing "BOLETO" or "Boleto"
  const boletoText = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const matches = all.filter(el => (el.innerText || '').includes('BOLETO') || (el.innerText || '').includes('Boleto'));
    return matches.map(m => ({ tag: m.tagName, class: m.className, text: m.innerText.substring(0, 50) }));
  });
  console.log('Boleto elements found:', boletoText);

  // Take screenshot
  const shotPath = path.join(capturesDir, 'debug_boleto_dom.png');
  await page.screenshot({ path: shotPath });

  await browser.close();
})();
