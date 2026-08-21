const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const capturesDir = path.join(__dirname, '..', 'captures', 'parlays_2026_08_21');
  if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Create local HTML that initializes Altenar WSDK with PlayDoIt integration in full screen
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>PlayDoIt SportsBook</title>
      <script src="https://sb2frontend-altenar2.biahosted.com/api/widget/GetWidgetBundle?culture=es-ES&timezoneOffset=360&integration=playdoit2"></script>
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #e11d48; }
        #sportsbook { width: 100%; height: 100%; }
      </style>
    </head>
    <body>
      <div id="sportsbook"></div>
      <script>
        window.onload = function() {
          const wsdk = window.WSDK || window.altenarWSDK;
          if (wsdk && wsdk.init) {
            wsdk.init({
              integration: 'playdoit2',
              culture: 'es-ES',
              timezoneOffset: 360
            });
            if (wsdk.addSportsBook) {
              wsdk.addSportsBook({
                container: document.getElementById('sportsbook'),
                props: {
                  sportId: 66,
                  page: 'event',
                  eventId: 17300447
                }
              });
            }
          }
        };
      </script>
    </body>
    </html>
  `;

  const htmlPath = path.join(__dirname, 'altenar_playdoit_standalone.html');
  fs.writeFileSync(htmlPath, htmlContent);

  console.log('Cargando standalone Altenar SportsBook...');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(6000);

  // Parlays to capture
  const parlays = [
    {
      id: 'opcion_1_doble_goles',
      name: 'Opción 1: Doble Goles (Bohemians + Jaguares)',
      oddIds: [4328988920, 4351210204],
      eventId: 16315255
    },
    {
      id: 'opcion_2_doble_argentina',
      name: 'Opción 2: Doble Argentina (Aldosivi + Estudiantes)',
      oddIds: [4374915968, 4326891143],
      eventId: 17300447
    },
    {
      id: 'opcion_3_triple_sudamericano',
      name: 'Opción 3: Triple Sudamericano (Colombia + Argentina + Chile)',
      oddIds: [4351210204, 4326891143, 4365932796],
      eventId: 17382142
    }
  ];

  for (const p of parlays) {
    console.log(`Configurando selecciones para ${p.name}...`);

    // Toggle selections
    await page.evaluate((ids) => {
      const wsdk = window.WSDK || window.altenarWSDK;
      if (wsdk && wsdk.toggleSelections) {
        wsdk.toggleSelections([]);
        wsdk.toggleSelections(ids);
      }
    }, p.oddIds);

    await page.waitForTimeout(3000);

    // Click the BOLETO bar to expand the ticket
    await page.evaluate(() => {
      // Find element containing "BOLETO" or "Boleto"
      const els = Array.from(document.querySelectorAll('*'));
      const boleto = els.find(el => {
        const t = (el.innerText || '').trim();
        return (t.startsWith('BOLETO') || t.startsWith('Boleto')) && el.offsetHeight > 0 && el.offsetHeight < 80;
      });
      if (boleto) boleto.click();
    });

    await page.waitForTimeout(2000);

    // Switch to "Parlay" tab if needed
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button, div, span, a'));
      const parlayTab = tabs.find(t => t.innerText && t.innerText.trim() === 'Parlay');
      if (parlayTab) parlayTab.click();
    });

    await page.waitForTimeout(1500);

    const shotPath = path.join(capturesDir, `${p.id}_boleto_oficial.png`);
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
})();
