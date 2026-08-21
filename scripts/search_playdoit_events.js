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

  // Search all events in Altenar database
  const searchTeams = [
    'Athletic', 'CRB', 
    'Novorizontino', 'America', 'América',
    'LDU', 'Quito', 'Mirassol',
    'Corinthians', 'Rosario',
    'Macará', 'Macara', 'Santos',
    'Leones', 'Cundinamarca',
    'Cartagena', 'Bogotá', 'Bogota'
  ];

  const searchResults = await page.evaluate(async (terms) => {
    const foundEvents = [];
    const eventMap = new Map();

    // 1. Check all champs / sport menu for soccer
    try {
      const menuRes = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetSportMenu?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66');
      const menuData = await menuRes.json();
      
      // Get all champ IDs
      const champIds = (menuData.champs || []).map(c => c.id || c.Id);
      
      // Query events for key champs or upcoming
      const upRes = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetUpcoming?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66&count=100');
      const upData = await upRes.json();
      (upData.events || []).forEach(e => {
        eventMap.set(e.id, { id: e.id, name: e.name, champId: e.champId, startDate: e.startDate });
      });

      const liveRes = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetLivenow?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66&count=100');
      const liveData = await liveRes.json();
      (liveData.events || []).forEach(e => {
        eventMap.set(e.id, { id: e.id, name: e.name, champId: e.champId, startDate: e.startDate, isLive: true });
      });

    } catch (e) {}

    // Also search specific search endpoint if available: GetSearchResults or Search
    for (const term of terms) {
      try {
        const sRes = await fetch(`https://sb2frontend-altenar2.biahosted.com/api/widget/Search?culture=es-ES&timezoneOffset=360&integration=playdoit2&searchTerm=${encodeURIComponent(term)}`);
        if (sRes.ok) {
          const sData = await sRes.json();
          (sData.events || []).forEach(e => {
            eventMap.set(e.id, { id: e.id, name: e.name, champId: e.champId, startDate: e.startDate });
          });
        }
      } catch(e) {}
    }

    return Array.from(eventMap.values());
  }, searchTeams);

  console.log(`Found ${searchResults.length} events matching search across PlayDoIt:`);
  searchResults.forEach(ev => {
    console.log(` - ID: ${ev.id} | Name: ${ev.name} | Date: ${ev.startDate} ${ev.isLive ? '(LIVE)' : ''}`);
  });

  // Save all matches found
  fs.writeFileSync(path.join(__dirname, 'playdoit_all_found_events.json'), JSON.stringify(searchResults, null, 2));

  await browser.close();
})();
