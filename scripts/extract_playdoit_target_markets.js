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

  const targets = [
    { key: 'Athletic Club vs CRB', terms: ['Athletic', 'CRB'] },
    { key: 'Novorizontino vs América Mineiro', terms: ['Novorizontino', 'America Mineiro', 'América Mineiro'] },
    { key: 'LDU Quito vs Mirassol', terms: ['LDU', 'Mirassol', '16807924'] },
    { key: 'Corinthians vs Rosario Central', terms: ['Corinthians', 'Rosario'] },
    { key: 'Macará vs Santos', terms: ['Macará', 'Macara', '17281413'] },
    { key: 'Leones FC vs Real Cundinamarca', terms: ['Leones', 'Cundinamarca', '17414465'] },
    { key: 'Real Cartagena vs Bogotá FC', terms: ['Cartagena', 'Bogota', 'Bogotá'] }
  ];

  const matchDetailsMap = await page.evaluate(async (targetList) => {
    const results = {};

    for (const t of targetList) {
      results[t.key] = {
        found: false,
        eventId: null,
        eventName: null,
        startDate: null,
        markets: [],
        odds: []
      };

      // Search each term
      let foundEvent = null;
      for (const term of t.terms) {
        if (/^\d+$/.test(term)) {
          // Direct ID
          foundEvent = { id: parseInt(term) };
          break;
        }
        try {
          const res = await fetch(`https://sb2frontend-altenar2.biahosted.com/api/widget/Search?culture=es-ES&timezoneOffset=360&integration=playdoit2&searchTerm=${encodeURIComponent(term)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.events && data.events.length > 0) {
              // Find matching event
              const match = data.events.find(e => {
                const n = (e.name || '').toLowerCase();
                const d = e.startDate || '';
                return (n.includes(term.toLowerCase()) || term.toLowerCase().split(' ').every(w => n.includes(w))) && d.includes('2026-08-20');
              }) || data.events.find(e => {
                const n = (e.name || '').toLowerCase();
                return n.includes(term.toLowerCase());
              });
              if (match) {
                foundEvent = match;
                break;
              }
            }
          }
        } catch(e) {}
      }

      if (foundEvent) {
        try {
          const detRes = await fetch(`https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails?culture=es-ES&timezoneOffset=360&integration=playdoit2&eventId=${foundEvent.id}`);
          if (detRes.ok) {
            const detData = await detRes.json();
            results[t.key] = {
              found: true,
              eventId: foundEvent.id,
              eventName: detData.event ? detData.event.name : (foundEvent.name || 'Unknown'),
              startDate: detData.event ? detData.event.startDate : foundEvent.startDate,
              champName: detData.event ? detData.event.champName : foundEvent.champName,
              markets: detData.markets || [],
              odds: detData.odds || []
            };
          }
        } catch(e) {
          results[t.key].error = e.message;
        }
      }
    }

    return results;
  }, targets);

  console.log('\n--- PLAYDOIT LIVE MATCH COVERAGE ---');
  for (const [k, v] of Object.entries(matchDetailsMap)) {
    console.log(`\nMatch: ${k}`);
    console.log(`  Found in PlayDoIt: ${v.found} (ID: ${v.eventId}, Name: "${v.eventName}", Date: ${v.startDate})`);
    console.log(`  Markets Count: ${v.markets.length} | Odds Count: ${v.odds.length}`);
    if (v.markets.length > 0) {
      console.log(`  Sample Market Names:`, v.markets.map(m => m.name || m.Name).slice(0, 10));
    }
  }

  fs.writeFileSync(path.join(__dirname, 'playdoit_all_match_markets.json'), JSON.stringify(matchDetailsMap, null, 2));

  await browser.close();
})();
