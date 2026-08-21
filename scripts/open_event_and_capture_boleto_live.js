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

  // Close cookie banner and popups
  try {
    const closeBtns = await page.$$('.cookie-banner button, [class*="close"], .asb-cookie-policy-close');
    for (const b of closeBtns) {
      if (await b.isVisible()) await b.click();
    }
  } catch(e) {}

  const parlays = [
    {
      id: 'opcion_1_doble_goles_nativo',
      name: 'Opción 1: Bohemians (+1.5) + Jaguares (+1.5)',
      searchTerm: 'Bohemians',
      oddIds: [4328988920, 4351210204]
    },
    {
      id: 'opcion_2_doble_argentina_nativo',
      name: 'Opción 2: Aldosivi (-6.5 tarjetas) + Estudiantes (-2.5 goles)',
      searchTerm: 'Aldosivi',
      oddIds: [4374915968, 4326891143]
    },
    {
      id: 'opcion_3_triple_sudamericano_nativo',
      name: 'Opción 3: Jaguares (+1.5) + Estudiantes (-2.5) + Audax (-10.5 corners)',
      searchTerm: 'Jaguares',
      oddIds: [4351210204, 4326891143, 4365932796]
    }
  ];

  for (const parlay of parlays) {
    console.log(`\n--- Procesando ${parlay.name} ---`);

    // 1. Search and open match page
    const searchInput = await page.$('input[placeholder*="Ingrese el nombre"], input[placeholder*="equipo"], .asb-search-input');
    if (searchInput) {
      await searchInput.fill('');
      await searchInput.fill(parlay.searchTerm);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2500);

      const result = await page.$(`text=${parlay.searchTerm}`);
      if (result) {
        await result.click();
        await page.waitForTimeout(3000);
      }
    }

    // 2. Set selections in betslip
    await page.evaluate((ids) => {
      const wsdk = window.WSDK || window.altenarWSDK;
      if (wsdk && wsdk.toggleSelections) {
        wsdk.toggleSelections([]);
        wsdk.toggleSelections(ids);
      }
    }, parlay.oddIds);

    await page.waitForTimeout(2000);

    // 3. Click the bottom BOLETO bar to expand it
    await page.evaluate(() => {
      // Find element containing "BOLETO" or "Boleto"
      const all = Array.from(document.querySelectorAll('*'));
      const boleto = all.find(el => {
        const t = (el.innerText || '').trim();
        return (t.startsWith('BOLETO') || t.startsWith('Boleto')) && el.offsetHeight > 0 && el.offsetHeight < 80;
      });
      if (boleto) boleto.click();
    });

    await page.waitForTimeout(2000);

    // 4. Click the "Parlay" tab in the ticket
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button, div, span, a'));
      const parlayTab = tabs.find(t => t.innerText && t.innerText.trim() === 'Parlay');
      if (parlayTab) parlayTab.click();
    });

    await page.waitForTimeout(1500);

    // 5. Take screenshot
    const shotPath = path.join(capturesDir, `${parlay.id}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`[CAPTURADO]: ${shotPath}`);

    // Clear
    await page.evaluate(() => {
      const wsdk = window.WSDK || window.altenarWSDK;
      if (wsdk && wsdk.toggleSelections) wsdk.toggleSelections([]);
    });
    await page.waitForTimeout(1000);
  }

  await browser.close();
  console.log('\nTodas las capturas nativas completadas.');
})();
