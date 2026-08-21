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

  console.log('Navigating to PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Test fetching event details directly through page.evaluate (using the page's cookies and origin)
  const eventIds = [
    { name: 'LDU Quito vs Mirassol', id: 16807924 },
    { name: 'Macara vs Santos', id: 17281413 },
    { name: 'Leones FC vs Real Cundinamarca', id: 17414465 }
  ];

  const results = await page.evaluate(async (events) => {
    const out = [];
    for (const ev of events) {
      try {
        const url = `https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails?culture=es-ES&timezoneOffset=360&integration=playdoit2&eventId=${ev.id}`;
        const res = await fetch(url);
        const data = await res.json();
        out.push({
          name: ev.name,
          id: ev.id,
          status: res.status,
          marketsCount: data.markets ? data.markets.length : 0,
          oddsCount: data.odds ? data.odds.length : 0,
          marketNames: data.markets ? data.markets.map(m => m.name || m.Name).slice(0, 20) : [],
          sampleMarkets: data.markets ? data.markets.slice(0, 10) : [],
          sampleOdds: data.odds ? data.odds.slice(0, 10) : []
        });
      } catch (err) {
        out.push({ name: ev.name, id: ev.id, error: err.message });
      }
    }
    return out;
  }, eventIds);

  console.log('Event Details Query Results:\n', JSON.stringify(results, null, 2));

  await browser.close();
})();
