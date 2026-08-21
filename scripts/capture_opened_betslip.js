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

  console.log('[PLAYDOIT] Navegando a PlayDoIt con viewport 1920x1080...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Close cookie banner if present
  try {
    const cookieClose = await page.$('.cookie-banner button, [class*="cookie"] button, .asb-cookie-policy-close');
    if (cookieClose) await cookieClose.click();
  } catch(e) {}

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
    console.log(`\nProcesando y capturando betslip abierto para: ${parlay.title}...`);

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

    // Toggle selections
    await page.evaluate((ids) => {
      const wsdk = window.WSDK || window.altenarWSDK;
      if (wsdk && wsdk.toggleSelections) {
        wsdk.toggleSelections([]);
        wsdk.toggleSelections(ids);
      }
    }, oddIds);

    await page.waitForTimeout(2000);

    // Click floating betslip button if betslip is closed
    await page.evaluate(() => {
      // Find betslip toggle button
      const btn = document.querySelector('.asb-floating-button, [class*="floating-betslip"], .asb-pos-right button, [class*="betslip-btn"]');
      if (btn) btn.click();
    });

    await page.waitForTimeout(2000);

    const screenshotPath = path.join(capturesDir, `${parlay.id}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[CAPTURADO CON ÉXITO]: ${screenshotPath}`);

    // Clear betslip
    await page.evaluate(() => {
      const wsdk = window.WSDK || window.altenarWSDK;
      if (wsdk && wsdk.toggleSelections) wsdk.toggleSelections([]);
    });
    await page.waitForTimeout(1000);
  }

  await browser.close();
})();
