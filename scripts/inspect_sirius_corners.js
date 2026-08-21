const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  const cornerMarkets = await page.evaluate(async () => {
    const res = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails?culture=es-ES&timezoneOffset=360&integration=playdoit2&eventId=17324791');
    const data = await res.json();
    const oddsMap = new Map();
    (data.odds || []).forEach(o => oddsMap.set(o.id, o));

    const markets = (data.markets || [])
      .filter(m => (m.name || '').toLowerCase().includes('córner') || (m.name || '').toLowerCase().includes('tiros de esquina') || (m.name || '').toLowerCase().includes('corner'))
      .map(m => {
        const allOddIds = [];
        if (m.desktopOddIds) m.desktopOddIds.forEach(col => col.forEach(oid => allOddIds.push(oid)));
        const odds = allOddIds.map(oid => oddsMap.get(oid)).filter(Boolean);
        return {
          id: m.id,
          name: m.name,
          odds: odds.map(o => `${o.name} -> price: ${o.price} (sv: ${o.sv})`)
        };
      });

    return markets;
  });

  console.log('CORNER MARKETS FOR SIRIUS VS HACKEN IN PLAYDOIT:');
  cornerMarkets.forEach(m => {
    console.log(`\nMarket: "${m.name}"`);
    m.odds.forEach(o => console.log(`   - ${o}`));
  });

  await browser.close();
})();
