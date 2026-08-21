const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const upcomingData = await page.evaluate(async () => {
    const res = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetUpcoming?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66');
    const data = await res.json();
    return data;
  });

  const champsMap = new Map();
  (upcomingData.champs || []).forEach(c => champsMap.set(c.id, c.name));
  const catsMap = new Map();
  (upcomingData.categories || []).forEach(cat => catsMap.set(cat.id, cat.name));

  console.log(`Eventos totales: ${upcomingData.events.length}`);

  // Today is 2026-08-21
  const todayEvening = [];

  for (const ev of upcomingData.events) {
    const d = new Date(ev.startDate);
    // CDMX is UTC-6
    const cdmxMs = d.getTime() - 6 * 3600 * 1000;
    const cdmxDate = new Date(cdmxMs);
    const dateStr = cdmxDate.toISOString().split('T')[0];
    const hours = cdmxDate.getUTCHours();
    const minutes = cdmxDate.getUTCMinutes();

    if (dateStr === '2026-08-21' && hours >= 17) {
      todayEvening.push({
        id: ev.id,
        name: ev.name,
        category: catsMap.get(ev.catId) || '',
        championship: champsMap.get(ev.champId) || '',
        timeCDMX: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
        startDateUTC: ev.startDate
      });
    }
  }

  console.log(`\nPartidos de hoy 21/08/2026 después de las 17:00 CDMX: ${todayEvening.length}\n`);
  todayEvening.forEach(e => {
    console.log(`- [${e.id}] ${e.name} (${e.timeCDMX} CDMX | ${e.category} - ${e.championship})`);
  });

  fs.writeFileSync(path.join(__dirname, 'evening_matches_2026_08_21.json'), JSON.stringify(todayEvening, null, 2));

  await browser.close();
})();
