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

  // Search terms for 21/08 matches (>= 15:00 CDMX)
  const targetTerms = [
    'Estudiantes Rio Cuarto', 'San Lorenzo',
    'Aldosivi', 'Union Santa Fe',
    'Italiano', 'Union La Calera', 'Calera',
    'Jaguares', 'Chico', 'Boyaca',
    'The Strongest', 'Universitario de Vinto', 'Vinto',
    'Liverpool', 'Cerro',
    'Albion', 'Boston River',
    'San Diego Wave', 'Utah Royals',
    'Real Santander', 'Yumbo', 'Internacional de Palmira',
    'Patriotas', 'Depor', 'Atletico FC'
  ];

  const searchResults = await page.evaluate(async (terms) => {
    // 1. GetUpcoming
    const upRes = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetUpcoming?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66&count=2000');
    const upData = await upRes.json();
    const allEvents = upData.events || [];

    const matchedEvents = new Map();

    for (const ev of allEvents) {
      const evNameLow = (ev.name || '').toLowerCase();
      for (const t of terms) {
        if (evNameLow.includes(t.toLowerCase())) {
          matchedEvents.set(ev.id, {
            id: ev.id,
            name: ev.name,
            startDate: ev.startDate,
            champId: ev.champId,
            matchedTerm: t
          });
        }
      }
    }

    return Array.from(matchedEvents.values());
  }, targetTerms);

  console.log(`\nFound ${searchResults.length} matching events in PlayDoIt for 2026-08-21 (>= 15:00 CDMX):`);
  searchResults.forEach(ev => {
    console.log(` - [ID: ${ev.id}] ${ev.name} | Date: ${ev.startDate} (Matched: ${ev.matchedTerm})`);
  });

  fs.writeFileSync(path.join(__dirname, 'playdoit_target_events_21.json'), JSON.stringify(searchResults, null, 2));

  await browser.close();
})();
