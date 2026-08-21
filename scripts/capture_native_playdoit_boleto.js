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

  console.log('[PLAYDOIT] Navegando a PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Close cookie banner if present
  try {
    const cookieClose = await page.$('.cookie-banner button, [class*="cookie"] button, .asb-cookie-policy-close');
    if (cookieClose) await cookieClose.click();
  } catch(e) {}

  const parlays = [
    {
      id: 'parlay_1_goles_internacionales',
      title: 'Parlay 1: Bohemians (+1.5 goles) + Jaguares (+1.5 goles)',
      oddIds: [4328988920, 4351210204]
    },
    {
      id: 'parlay_2_argentina_control',
      title: 'Parlay 2: Aldosivi (-6.5 tarjetas) + Estudiantes (-2.5 goles)',
      oddIds: [4374915968, 4326891143]
    },
    {
      id: 'parlay_3_triple_sudamericano',
      title: 'Parlay 3: Jaguares (+1.5 goles) + Estudiantes (-2.5 goles) + Audax (-10.5 corners)',
      oddIds: [4351210204, 4326891143, 4365932796]
    }
  ];

  for (const parlay of parlays) {
    console.log(`\nCapturando boleto nativo para: ${parlay.title}...`);

    // 1. Toggle selections
    await page.evaluate((ids) => {
      const wsdk = window.WSDK || window.altenarWSDK;
      if (wsdk && wsdk.toggleSelections) {
        wsdk.toggleSelections([]);
        wsdk.toggleSelections(ids);
      }
    }, parlay.oddIds);

    await page.waitForTimeout(2000);

    // 2. Open the native boleto drawer
    await page.evaluate(() => {
      // Find the bottom BOLETO bar or header element and click it to open
      const elements = Array.from(document.querySelectorAll('*'));
      const boletoTrigger = elements.find(el => {
        const txt = (el.innerText || '').trim();
        return (txt.startsWith('BOLETO') || txt.startsWith('Boleto')) && el.offsetHeight > 0 && el.offsetHeight < 80;
      });

      if (boletoTrigger) {
        boletoTrigger.click();
      } else {
        // Try finding any element with class asb-betslip
        const betslip = document.querySelector('.asb-betslip-header, [class*="betslip-header"], [class*="coupon-header"]');
        if (betslip) betslip.click();
      }
    });

    await page.waitForTimeout(2000);

    // 3. Switch to "Parlay" tab if visible
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button, div, span, a'));
      const parlayTab = tabs.find(t => t.innerText && t.innerText.trim() === 'Parlay');
      if (parlayTab) parlayTab.click();
    });

    await page.waitForTimeout(1500);

    // 4. Screenshot the full page with the native boleto open
    const shotPath = path.join(capturesDir, `${parlay.id}_nativo.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`[CAPTURADO CON ÉXITO]: ${shotPath}`);

    // Clear
    await page.evaluate(() => {
      const wsdk = window.WSDK || window.altenarWSDK;
      if (wsdk && wsdk.toggleSelections) wsdk.toggleSelections([]);
    });
    await page.waitForTimeout(1000);
  }

  await browser.close();
  console.log(`\nTodas las capturas nativas completadas.`);
})();
