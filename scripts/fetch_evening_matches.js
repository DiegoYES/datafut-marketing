const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('=== BUSCANDO PARTIDOS DE HOY 21/08/2026 DESPUÉS DE LAS 17:00 CDMX ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Query Altenar events for sportId 66 (Soccer)
  const events = await page.evaluate(async () => {
    // Get upcoming soccer events
    const res = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetSportEvents?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66');
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const data = await res.json();
    return data;
  });

  console.log(`Eventos totales de fútbol recibidos de Altenar:`, Array.isArray(events.events) ? events.events.length : 'no array');

  // Let's filter events starting today after 17:00 CDMX (which is 23:00 UTC on 2026-08-21 or later)
  // CDMX is UTC-6, so 17:00 CDMX = 23:00 UTC.
  const targetDateStr = '2026-08-21';

  const eveningEvents = [];

  if (events && events.events) {
    const champsMap = new Map();
    (events.championships || []).forEach(c => champsMap.set(c.id, c.name));
    const catsMap = new Map();
    (events.categories || []).forEach(cat => catsMap.set(cat.id, cat.name));

    for (const ev of events.events) {
      const startDate = new Date(ev.startDate);
      // Format to CDMX time
      const cdmxHours = (startDate.getUTCHours() - 6 + 24) % 24;
      const cdmxMinutes = startDate.getUTCMinutes();
      const cdmxDateStr = new Date(startDate.getTime() - 6 * 3600 * 1000).toISOString().split('T')[0];

      if (cdmxDateStr === targetDateStr && cdmxHours >= 17) {
        eveningEvents.push({
          id: ev.id,
          name: ev.name,
          champName: champsMap.get(ev.championshipId) || '',
          catName: catsMap.get(ev.catId) || '',
          timeCDMX: `${String(cdmxHours).padStart(2, '0')}:${String(cdmxMinutes).padStart(2, '0')}`,
          utcDate: ev.startDate
        });
      }
    }
  }

  console.log(`Partidos de hoy después de las 17:00 CDMX encontrados en PlayDoIt: ${eveningEvents.length}\n`);
  eveningEvents.forEach(e => {
    console.log(`- [${e.id}] ${e.name} (${e.timeCDMX} CDMX | ${e.catName} - ${e.champName})`);
  });

  fs.writeFileSync(path.join(__dirname, 'evening_matches_2026_08_21.json'), JSON.stringify(eveningEvents, null, 2));

  await browser.close();
})();
