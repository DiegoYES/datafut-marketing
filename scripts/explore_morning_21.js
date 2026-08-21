const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== CHECKING MORNING MATCHES ON 2026-08-21 (00:00 - 15:00 CDMX / 06:00 - 21:00 UTC) ===');

  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('[PLAYDOIT] Navigating to sportsbook...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // 1. Get all upcoming soccer events
  const playdoitEvents = await page.evaluate(async () => {
    const res = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetUpcoming?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66&count=2000');
    const data = await res.json();
    return (data.events || []).map(e => ({
      id: e.id,
      name: e.name,
      startDate: e.startDate,
      champId: e.champId
    }));
  });

  // Target morning window: 2026-08-21T06:00:00Z to 2026-08-21T21:00:00Z (00:00 to 15:00 CDMX)
  const morningStart = new Date('2026-08-21T06:00:00Z').getTime();
  const morningEnd = new Date('2026-08-21T21:00:00Z').getTime();

  const morningPlayDoIt = playdoitEvents.filter(e => {
    const t = new Date(e.startDate).getTime();
    return t >= morningStart && t < morningEnd;
  });

  console.log(`\nPlayDoIt Soccer Events in Morning Window (00:00 - 15:00 CDMX): ${morningPlayDoIt.length}`);

  // List of potential matches from DataFut scraped for 21/08 morning
  const candidatesDataFut = [
    { name: 'Aldosivi vs. Union de Santa Fe', terms: ['Aldosivi', 'Union de Santa Fe', 'Santa Fe'], dfMatch: 'Aldosivi vs Union Santa Fe' },
    { name: 'Alianza Atletico vs Sporting Cristal', terms: ['Alianza Atletico', 'Sporting Cristal', 'Cristal'], dfMatch: 'Alianza Atletico vs Sporting Cristal' },
    { name: 'FC Cajamarca vs Atletico Grau', terms: ['Cajamarca', 'Grau', 'Atletico Grau'], dfMatch: 'FC Cajamarca vs Atletico Grau' },
    { name: 'Dundalk vs Galway United', terms: ['Dundalk', 'Galway'], dfMatch: 'Dundalk vs Galway United' },
    { name: 'Bohemians vs Derry City', terms: ['Bohemians', 'Derry'], dfMatch: 'Bohemians vs Derry City' },
    { name: 'Drogheda United vs St Patrick\'s Athl.', terms: ['Drogheda', 'Patrick'], dfMatch: 'Drogheda United vs St Patrick\'s Athl.' },
    { name: 'Shamrock Rovers vs Shelbourne', terms: ['Shamrock', 'Shelbourne'], dfMatch: 'Shamrock Rovers vs Shelbourne' },
    { name: 'Sligo Rovers vs Waterford', terms: ['Sligo', 'Waterford'], dfMatch: 'Sligo Rovers vs Waterford' },
    { name: 'Sirius vs BK Hacken', terms: ['Sirius', 'Hacken'], dfMatch: 'Sirius vs BK Hacken' },
    { name: 'SJK vs Lahti', terms: ['SJK', 'Lahti'], dfMatch: 'SJK vs Lahti' },
    { name: 'San Telmo vs Deportivo Moron', terms: ['San Telmo', 'Moron'], dfMatch: 'San Telmo vs Deportivo Moron' },
    { name: 'Albion vs Boston River', terms: ['Albion', 'Boston River'], dfMatch: 'Albion FC vs Boston River' }
  ];

  const matched = [];
  for (const c of candidatesDataFut) {
    const found = morningPlayDoIt.find(ev => {
      const n = ev.name.toLowerCase();
      return c.terms.some(t => n.includes(t.toLowerCase()));
    });
    if (found) {
      matched.push({
        playdoitId: found.id,
        playdoitName: found.name,
        startDate: found.startDate,
        ...c
      });
    }
  }

  console.log(`\nMatches present in BOTH DataFut and PlayDoIt for morning of 21/08: ${matched.length}`);
  matched.forEach(m => {
    // Calculate CDMX time
    const d = new Date(m.startDate);
    const cdmxHours = (d.getUTCHours() - 6 + 24) % 24;
    const cdmxMinutes = String(d.getUTCMinutes()).padStart(2, '0');
    console.log(` - [ID: ${m.playdoitId}] ${m.playdoitName} | Hora CDMX: ${cdmxHours}:${cdmxMinutes} | DataFut: ${m.dfMatch}`);
  });

  fs.writeFileSync(path.join(__dirname, 'morning_21_matched.json'), JSON.stringify(matched, null, 2));

  await browser.close();
})();
