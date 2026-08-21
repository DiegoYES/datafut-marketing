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

  // Search Brazil, Colombia, Libertadores, Sudamericana tournaments in PlayDoIt
  const searchTournaments = await page.evaluate(async () => {
    const res = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetSportMenu?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66');
    const data = await res.json();
    
    // Find categories for Brazil, Colombia, International Clubs (Libertadores/Sudamericana)
    const relevantCats = (data.categories || []).filter(c => {
      const n = (c.name || '').toLowerCase();
      return n.includes('brasil') || n.includes('brazil') || n.includes('colombia') || n.includes('internacional') || n.includes('conmebol') || n.includes('sudam');
    });

    const relevantChamps = [];
    (data.champs || []).forEach(ch => {
      const n = (ch.name || '').toLowerCase();
      if (
        n.includes('serie b') || n.includes('brasileirao') || 
        n.includes('libertadores') || n.includes('sudamericana') || 
        n.includes('colombia') || n.includes('primera b')
      ) {
        relevantChamps.push(ch);
      }
    });

    // For each relevant champ, fetch events
    const champEvents = [];
    for (const ch of relevantChamps) {
      try {
        const evRes = await fetch(`https://sb2frontend-altenar2.biahosted.com/api/widget/GetUpcoming?culture=es-ES&timezoneOffset=360&integration=playdoit2&champId=${ch.id}&count=50`);
        if (evRes.ok) {
          const evData = await evRes.json();
          (evData.events || []).forEach(e => {
            champEvents.push({
              champId: ch.id,
              champName: ch.name,
              id: e.id,
              name: e.name,
              startDate: e.startDate
            });
          });
        }
      } catch(e) {}
    }

    return {
      relevantCats: relevantCats.map(c => ({ id: c.id, name: c.name })),
      relevantChamps: relevantChamps.map(c => ({ id: c.id, name: c.name })),
      champEvents
    };
  });

  console.log('Relevant Champs in PlayDoIt:', JSON.stringify(searchTournaments.relevantChamps, null, 2));
  console.log(`Found ${searchTournaments.champEvents.length} events in relevant tournaments:`);
  searchTournaments.champEvents.forEach(ev => {
    console.log(` - [${ev.champName}] ${ev.name} (ID: ${ev.id}, Date: ${ev.startDate})`);
  });

  fs.writeFileSync(path.join(__dirname, 'playdoit_relevant_tournaments_events.json'), JSON.stringify(searchTournaments, null, 2));

  await browser.close();
})();
