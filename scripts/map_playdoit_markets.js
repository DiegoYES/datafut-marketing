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

  const eventIds = [16807924, 17281413, 17414465];

  const marketDump = await page.evaluate(async (ids) => {
    const data = {};
    for (const id of ids) {
      try {
        const res = await fetch(`https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails?culture=es-ES&timezoneOffset=360&integration=playdoit2&eventId=${id}`);
        const json = await res.json();
        
        // Map all markets with their odds
        const oddsMap = new Map();
        (json.odds || []).forEach(o => {
          oddsMap.set(o.id, o);
        });

        const detailedMarkets = (json.markets || []).map(m => {
          // Collect all odds for this market
          const allOddIds = [];
          if (m.desktopOddIds) {
            m.desktopOddIds.forEach(col => col.forEach(oid => allOddIds.push(oid)));
          }
          const oddsInfo = allOddIds.map(oid => {
            const oddObj = oddsMap.get(oid);
            return oddObj ? {
              id: oddObj.id,
              name: oddObj.name,
              price: oddObj.price,
              sv: oddObj.sv,
              typeId: oddObj.typeId
            } : null;
          }).filter(Boolean);

          return {
            id: m.id,
            name: m.name,
            shortName: m.shortName,
            sv: m.sv,
            typeId: m.typeId,
            odds: oddsInfo
          };
        });

        data[id] = {
          event: json.event || {},
          totalMarkets: detailedMarkets.length,
          markets: detailedMarkets
        };
      } catch (err) {
        data[id] = { error: err.message };
      }
    }
    return data;
  }, eventIds);

  console.log('--- DETAILED MARKET SUMMARY ---');
  for (const [id, info] of Object.entries(marketDump)) {
    console.log(`\nEvent ID ${id}: ${info.event.name} (${info.totalMarkets} markets)`);
    // Print all market names
    const names = info.markets.map(m => m.name);
    console.log('Market names:', names.slice(0, 30));
    
    // Look specifically for total goals, corners, shots, cards, fouls
    const totalGoals = info.markets.find(m => m.name === 'Total' || m.name === 'Goles Totales');
    console.log('Total Goals market:', totalGoals ? JSON.stringify(totalGoals, null, 2) : 'Not found');

    const cornersMarkets = info.markets.filter(m => m.name.toLowerCase().includes('córner') || m.name.toLowerCase().includes('corner'));
    console.log('Corners markets count:', cornersMarkets.length);
    cornersMarkets.slice(0, 5).forEach(m => console.log(' - Corner Market:', m.name, m.odds));

    const cardsMarkets = info.markets.filter(m => m.name.toLowerCase().includes('tarjeta'));
    console.log('Cards markets count:', cardsMarkets.length);
    cardsMarkets.slice(0, 5).forEach(m => console.log(' - Card Market:', m.name, m.odds));

    const shotsMarkets = info.markets.filter(m => m.name.toLowerCase().includes('tiro'));
    console.log('Shots markets count:', shotsMarkets.length);

    const foulsMarkets = info.markets.filter(m => m.name.toLowerCase().includes('falta'));
    console.log('Fouls markets count:', foulsMarkets.length);
  }

  fs.writeFileSync(path.join(__dirname, 'detailed_playdoit_markets_dump.json'), JSON.stringify(marketDump, null, 2));

  await browser.close();
})();
