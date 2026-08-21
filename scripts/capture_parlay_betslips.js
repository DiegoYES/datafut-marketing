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

  console.log('[PLAYDOIT] Navegando a PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Initialize Altenar WSDK if available
  await page.evaluate(() => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (wsdk && wsdk.init) {
      wsdk.init({ integration: 'playdoit2', culture: 'es-ES', timezoneOffset: 360 });
    }
  });

  // Parlay definitions to capture:
  const parlaysToCapture = [
    {
      id: 'opcion_1_doble_goles_internacionales',
      title: 'Opción 1: Doble Goles Internacionales (Bohemians + Jaguares)',
      picks: [
        { eventId: 16315255, match: 'Bohemians vs Derry City', mktName: 'Total', dir: 'más de', line: 1.5 },
        { eventId: 17382142, match: 'Jaguares vs Boyacá Chicó', mktName: 'Total', dir: 'más de', line: 1.5 }
      ]
    },
    {
      id: 'opcion_2_doble_argentina_control',
      title: 'Opción 2: Doble Argentina Control (Aldosivi + Estudiantes)',
      picks: [
        { eventId: 17300447, match: 'Aldosivi vs Unión Santa Fe', mktName: 'Total de tarjetas', dir: 'menos de', line: 6.5 },
        { eventId: 17300449, match: 'Estudiantes Río Cuarto vs San Lorenzo', mktName: 'Total', dir: 'menos de', line: 2.5 }
      ]
    },
    {
      id: 'opcion_3_triple_sudamericano',
      title: 'Opción 3: Triple Sudamericano (Colombia + Argentina + Chile)',
      picks: [
        { eventId: 17382142, match: 'Jaguares vs Boyacá Chicó', mktName: 'Total', dir: 'más de', line: 1.5 },
        { eventId: 17300449, match: 'Estudiantes Río Cuarto vs San Lorenzo', mktName: 'Total', dir: 'menos de', line: 2.5 },
        { eventId: 16335538, match: 'Audax Italiano vs Unión La Calera', mktName: 'Total Tiros De Esquina', dir: 'menos de', line: 10.5 }
      ]
    }
  ];

  for (const parlay of parlaysToCapture) {
    console.log(`\nProcesando y capturando: ${parlay.title}...`);

    // 1. Fetch exact odd IDs from PlayDoIt API
    const oddIds = await page.evaluate(async (picks) => {
      const ids = [];
      for (const p of picks) {
        const res = await fetch(`https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails?culture=es-ES&timezoneOffset=360&integration=playdoit2&eventId=${p.eventId}`);
        const data = await res.json();
        const oddsMap = new Map();
        (data.odds || []).forEach(o => oddsMap.set(o.id, o));

        const targetMkt = (data.markets || []).find(m => m.name.trim().toLowerCase() === p.mktName.toLowerCase());
        if (targetMkt) {
          const allOddIds = [];
          if (targetMkt.desktopOddIds) targetMkt.desktopOddIds.forEach(col => col.forEach(oid => allOddIds.push(oid)));
          const odds = allOddIds.map(oid => oddsMap.get(oid)).filter(Boolean);

          const exactOdd = odds.find(o => {
            const n = o.name.toLowerCase();
            const sv = parseFloat(o.sv || '0');
            return n.startsWith(p.dir) && Math.abs(sv - p.line) < 0.01;
          });

          if (exactOdd) ids.push(exactOdd.id);
        }
      }
      return ids;
    }, parlay.picks);

    console.log(`Odd IDs obtenidos:`, oddIds);

    // 2. Put selections in betslip
    await page.evaluate((ids) => {
      const wsdk = window.WSDK || window.altenarWSDK;
      if (wsdk && wsdk.toggleSelections) {
        wsdk.toggleSelections([]); // clear
        wsdk.toggleSelections(ids); // add
      }
    }, oddIds);

    await page.waitForTimeout(3000);

    // 3. Take screenshot of the page / betslip
    const screenshotPath = path.join(capturesDir, `${parlay.id}.png`);
    
    // Check if betslip container exists to clip or screenshot full page
    const betslipEl = await page.$('.asb-betslip, [class*="betslip"], .asb-pos-right, #asb-betslip-container');
    if (betslipEl) {
      await betslipEl.screenshot({ path: screenshotPath });
    } else {
      await page.screenshot({ path: screenshotPath, fullPage: false });
    }

    console.log(`[CAPTURADO] Guardado en: ${screenshotPath}`);

    // Clear betslip
    await page.evaluate(() => {
      const wsdk = window.WSDK || window.altenarWSDK;
      if (wsdk && wsdk.toggleSelections) wsdk.toggleSelections([]);
    });
    await page.waitForTimeout(1000);
  }

  await browser.close();
  console.log(`\nTodas las capturas completadas en: ${capturesDir}`);
})();
